import React, { useEffect, useRef, useState } from 'react';
import { Layout, Button, message, Card, Input, Form, Select, Divider, Typography } from 'antd';
import { Graph, Node } from '@antv/x6';
import { Stencil } from '@antv/x6-plugin-stencil';
import { Transform } from '@antv/x6-plugin-transform';
import { Selection } from '@antv/x6-plugin-selection';
import { Keyboard } from '@antv/x6-plugin-keyboard';
import { SaveOutlined, ClearOutlined, DeploymentUnitOutlined } from '@ant-design/icons';
import driver from '../../services/neo4j';

const { Content, Sider } = Layout;
const { Title, Text } = Typography;
const { Option } = Select;

// 注册本体专用图形
Graph.registerNode('meta-type', {
  inherit: 'rect',
  width: 240,
  height: 160,
  attrs: {
    body: { fill: '#f0f5ff', stroke: '#2f54eb', strokeWidth: 2, rx: 6, ry: 6 },
    label: { text: '设备类型 (Type)', fill: '#2f54eb', fontSize: 14, fontWeight: 'bold', refY: -20 }
  },
  ports: { groups: { in: { position: 'top' }, out: { position: 'bottom' } } },
  data: { type: 'MetaType', name: 'NewType' }
});

Graph.registerNode('meta-chamber', {
  inherit: 'circle',
  width: 80,
  height: 80,
  attrs: {
    body: { fill: '#fff7e6', stroke: '#fa8c16', strokeWidth: 2 },
    label: { text: '腔室', fill: '#fa8c16', fontSize: 12 }
  },
  data: { type: 'MetaChamber', name: 'ShellSide' }
});

const OntologyDesigner: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stencilRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);
  const [selectedCell, setSelectedCell] = useState<any>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    if (!containerRef.current || !stencilRef.current) return;

    const graph = new Graph({
      container: containerRef.current,
      grid: true,
      panning: true,
      mousewheel: true,
      connecting: {
        router: 'manhattan',
        connector: { name: 'rounded', args: { radius: 8 } },
        anchor: 'center',
        connectionPoint: 'boundary',
        allowBlank: false,
        createEdge() {
          return this.createEdge({
            shape: 'edge',
            attrs: {
              line: { stroke: '#595959', strokeWidth: 2, targetMarker: 'classic' }
            },
            labels: [{ attrs: { label: { text: 'RELATION' } } }],
            data: { type: 'MetaRelation', relType: 'HEAT_EXCHANGE' }
          });
        }
      },
      embedding: {
        enabled: true,
        findParent({ node }) {
          const bbox = node.getBBox();
          return this.getNodes().filter((n) => {
            const data = n.getData();
            // 只有 MetaType 可以作为父节点
            return data && data.type === 'MetaType' && n.getBBox().containsRect(bbox);
          });
        },
      },
    });

    graphRef.current = graph;

    graph.use(new Transform({ resizing: true }));
    graph.use(new Selection({ enabled: true, showNodeSelectionBox: true }));
    graph.use(new Keyboard({ enabled: true }));

    graph.bindKey('backspace', () => {
      const cells = graph.getSelectedCells();
      if (cells.length) graph.removeCells(cells);
    });

    graph.on('cell:click', ({ cell }) => {
      setSelectedCell(cell);
      const data = cell.getData() || {};
      const label = cell.isNode() ? cell.attr('label/text') : (cell.getLabelAt(0)?.attrs?.label?.text || '');
      form.setFieldsValue({ ...data, label });
    });

    graph.on('blank:click', () => {
      setSelectedCell(null);
    });

    // Stencil
    const stencil = new Stencil({
      title: '本体组件',
      target: graph,
      stencilGraphWidth: 200,
      stencilGraphHeight: 180,
      groups: [{ title: '基础元素', name: 'basic' }],
      layoutOptions: { columns: 1, columnWidth: 180, rowHeight: 100 },
    });
    stencilRef.current.appendChild(stencil.container);

    const typeNode = graph.createNode({ shape: 'meta-type', label: '设备类型' });
    const chamberNode = graph.createNode({ shape: 'meta-chamber', label: '腔室' });
    stencil.load([typeNode, chamberNode], 'basic');

    return () => {
      graph.dispose();
    };
  }, []);

  const handleFormChange = (changedValues: any, allValues: any) => {
    if (!selectedCell) return;
    selectedCell.setData({ ...selectedCell.getData(), ...allValues });
    
    if (selectedCell.isNode()) {
      if (allValues.label) selectedCell.attr('label/text', allValues.label);
    } else if (selectedCell.isEdge()) {
      if (allValues.relType) {
        selectedCell.setLabelAt(0, { attrs: { label: { text: allValues.relType } } });
      }
    }
  };

  const handleSaveOntology = async () => {
    if (!graphRef.current) return;
    const nodes = graphRef.current.getNodes();
    const edges = graphRef.current.getEdges();

    // 1. 找到设备类型节点 (Container)
    const typeNodes = nodes.filter(n => n.getData()?.type === 'MetaType');
    if (typeNodes.length === 0) {
      message.error('请至少拖入一个“设备类型”节点');
      return;
    }

    const session = driver.session();
    const tx = session.beginTransaction();

    try {
      for (const typeNode of typeNodes) {
        const typeData = typeNode.getData();
        const typeId = typeData.name || 'UnknownType';
        const typeLabel = typeNode.attr('label/text');

        // A. 创建设备类型节点
        await tx.run(`
          MERGE (t:Meta:Type {id: $id})
          SET t.name = $name
          MERGE (c:Meta:Concept {id: 'Equipment'})
          MERGE (t)-[:IS_A]->(c)
        `, { id: typeId, name: typeLabel });

        // B. 处理子节点 (腔室)
        const children = typeNode.getChildren();
        if (children) {
          for (const child of children) {
            if (child.getData()?.type === 'MetaChamber') {
              const chamberId = child.getData().name;
              const chamberLabel = child.attr('label/text');

              // 创建腔室节点
              await tx.run(`
                MERGE (c:Meta:Chamber {id: $id})
                SET c.name = $name
              `, { id: chamberId, name: chamberLabel });

              // 建立包含关系
              await tx.run(`
                MATCH (t:Meta:Type {id: $typeId}), (c:Meta:Chamber {id: $chamberId})
                MERGE (t)-[:HAS_CHAMBER]->(c)
              `, { typeId, chamberId });
            }
          }
        }
      }

      // C. 处理内部物理关系 (Edges)
      for (const edge of edges) {
        const source = edge.getSourceNode();
        const target = edge.getTargetNode();
        const relType = edge.getData()?.relType || 'RELATED_TO';

        if (source && target && source.getData().type === 'MetaChamber' && target.getData().type === 'MetaChamber') {
           const srcId = source.getData().name;
           const tgtId = target.getData().name;
           
           // 仅当两个腔室都属于同一个 Type 时才建立关系 (简化逻辑)
           // 这里直接建立腔室间的通用物理关系
           await tx.run(`
             MATCH (s:Meta:Chamber {id: $srcId}), (t:Meta:Chamber {id: $tgtId})
             MERGE (s)-[r:${relType}]->(t)
           `, { srcId, tgtId });
        }
      }

      await tx.commit();
      message.success('本体知识库已更新！');
    } catch (e) {
      console.error(e);
      await tx.rollback();
      message.error('保存失败');
    } finally {
      await session.close();
    }
  };

  return (
    <Layout style={{ height: '100%' }}>
      <Sider width={200} style={{ background: '#fff', borderRight: '1px solid #eee' }}>
        <div ref={stencilRef} style={{ height: '100%', position: 'relative' }} />
      </Sider>
      <Content style={{ background: '#f0f2f5', position: 'relative' }}>
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
        <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 100 }}>
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveOntology}>保存本体到 Neo4j</Button>
        </div>
      </Content>
      <Sider width={300} style={{ background: '#fff', borderLeft: '1px solid #eee', padding: 16 }}>
        <Title level={4}>属性配置</Title>
        {selectedCell ? (
          <Form form={form} layout="vertical" onValuesChange={handleFormChange}>
            <Form.Item label="显示名称 (Label)" name="label">
              <Input />
            </Form.Item>
            
            {selectedCell.isNode() && (
              <Form.Item label="唯一标识 (ID)" name="name" help="如: ShellSide, Reactor">
                <Input />
              </Form.Item>
            )}

            {selectedCell.isEdge() && (
              <Form.Item label="关系类型" name="relType">
                <Select>
                  <Option value="HEAT_EXCHANGE">热交换 (HEAT_EXCHANGE)</Option>
                  <Option value="FLUID_FLOW">流体连通 (FLUID_FLOW)</Option>
                  <Option value="PHYSICAL_CONNECTION">物理连接 (PHYSICAL_CONNECTION)</Option>
                </Select>
              </Form.Item>
            )}
          </Form>
        ) : (
          <div style={{ color: '#999', textAlign: 'center', marginTop: 40 }}>
            <DeploymentUnitOutlined style={{ fontSize: 24, marginBottom: 8 }} />
            <p>请选择节点或连线</p>
          </div>
        )}
        <Divider />
        <div style={{ fontSize: 12, color: '#666' }}>
          <p><b>操作指南:</b></p>
          1. 拖入“设备类型”作为容器。<br/>
          2. 拖入“腔室”放入容器内。<br/>
          3. 连线表示腔室间的物理作用。<br/>
          4. 点击保存，构建知识图谱本体层。
        </div>
      </Sider>
    </Layout>
  );
};

export default OntologyDesigner;