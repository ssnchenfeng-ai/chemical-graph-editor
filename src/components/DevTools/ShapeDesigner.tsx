import React, { useState, useRef, useEffect } from 'react';
import { Layout, Input, Button, Form, Select, Row, Col, Typography, message, Divider, Collapse, Tooltip, Checkbox, Slider, Space } from 'antd';
import { CopyOutlined, DeleteOutlined, QuestionCircleOutlined, InfoCircleOutlined, ZoomInOutlined, ZoomOutOutlined, ReloadOutlined, FileAddOutlined } from '@ant-design/icons';

const { Content, Sider } = Layout;
const { TextArea } = Input;
const { Title, Text } = Typography;
const { Option } = Select;
const { Panel } = Collapse;

// 默认 SVG 模板
const DEFAULT_SVG = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="black" stroke-width="2">
  <rect x="10" y="10" width="80" height="80" fill="white" />
  <line x1="10" y1="10" x2="90" y2="90" />
  <line x1="90" y1="10" x2="10" y2="90" />
</svg>`;

interface PortConfig {
  id: string;
  group: string;
  x: number;
  y: number;
  desc: string;
  region: string;
  dir: 'in' | 'out' | 'bi';
}

const ShapeDesigner: React.FC = () => {
  const [svgInput, setSvgInput] = useState(DEFAULT_SVG);
  const [ports, setPorts] = useState<PortConfig[]>([]);
  const [selectedPortId, setSelectedPortId] = useState<string | null>(null);
  const [nodeType, setNodeType] = useState('Equipment');
  const [nodeTag, setNodeTag] = useState('E-New');
  
  const [showGrid, setShowGrid] = useState(true);
  const [zoom, setZoom] = useState(1.0);

  const [containerSize, setContainerSize] = useState({ w: 500, h: 500 });
  const [originalSize, setOriginalSize] = useState({ w: 100, h: 100 });
  
  const imgContainerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [form] = Form.useForm();

  // 解析 SVG 尺寸
  useEffect(() => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgInput, 'image/svg+xml');
      const svg = doc.querySelector('svg');
      
      if (!svg) return;

      let w = 100;
      let h = 100;

      const viewBox = svg.getAttribute('viewBox');
      if (viewBox) {
        const parts = viewBox.split(/[\s,]+/).filter(Boolean).map(Number);
        if (parts.length === 4) { w = parts[2]; h = parts[3]; }
      } else {
        const attrW = parseFloat(svg.getAttribute('width') || '0');
        const attrH = parseFloat(svg.getAttribute('height') || '0');
        if (attrW > 0 && attrH > 0) { w = attrW; h = attrH; }
      }

      setOriginalSize({ w, h });

      const MAX_DISPLAY_SIZE = 600;
      const ratio = w / h;
      let displayW = MAX_DISPLAY_SIZE;
      let displayH = MAX_DISPLAY_SIZE / ratio;

      if (displayH > MAX_DISPLAY_SIZE) {
        displayH = MAX_DISPLAY_SIZE;
        displayW = MAX_DISPLAY_SIZE * ratio;
      }
      setContainerSize({ w: displayW, h: displayH });

    } catch (e) {
      console.warn('SVG Parse Warning:', e);
    }
  }, [svgInput]);

  // 处理滚轮缩放
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const newZoom = Math.max(0.5, Math.min(5.0, zoom + delta));
      setZoom(parseFloat(newZoom.toFixed(1)));
    }
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (!imgContainerRef.current) return;
    if ((e.target as HTMLElement).closest('.port-dot')) return;

    const rect = imgContainerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const newPort: PortConfig = {
      id: `p${ports.length + 1}`,
      group: 'all',
      x: Number(x.toFixed(2)),
      y: Number(y.toFixed(2)),
      desc: '新接口',
      region: 'ShellSide',
      dir: 'bi'
    };

    setPorts([...ports, newPort]);
    setSelectedPortId(newPort.id);
    form.setFieldsValue(newPort);
  };

  const handleFormChange = (_changedValues: any, allValues: any) => {
    if (!selectedPortId) return;
    setPorts(ports.map(p => p.id === selectedPortId ? { ...p, ...allValues } : p));
  };

  const handleDeletePort = (id: string) => {
    setPorts(ports.filter(p => p.id !== id));
    if (selectedPortId === id) setSelectedPortId(null);
  };

  // --- 核心修改：生成包含 Step 5 的完整代码 ---
  const generateCode = () => {
    // 1. 变量名处理
    const cleanTag = nodeTag.replace(/[-_]/g, '').toLowerCase();
    const varName = `${cleanTag}Svg`;
    const fileName = `${nodeTag}.svg`;
    const shapeName = `p-${nodeTag.toLowerCase()}`;

    // 2. 端口代码生成
    const groups = Array.from(new Set(ports.map(p => p.group)));
    const groupsStr = groups.map(g => `        ${g}: { position: 'absolute', attrs: PORT_ATTRS }`).join(',\n');
    const itemsStr = ports.map(p => 
      `        { id: '${p.id}', group: '${p.group}', args: { x: '${p.x}%', y: '${p.y}%' }, data: { desc: '${p.desc}', region: '${p.region}', dir: '${p.dir}' } as PortData }`
    ).join(',\n');

    // 3. Neo4j 标签推断
    const neo4jLabels = nodeType === 'Instrument' 
      ? `['Instrument']` 
      : `['Equipment', '${nodeType}']`;

    return `/** 
 * ============================================================
 * 步骤 1: 创建 SVG 文件
 * 路径: src/graph/cells/svgs/${fileName}
 * 内容: (请复制左侧 SVG 源码)
 * ============================================================
 */

// ============================================================
// 步骤 2: 在 src/graph/cells/registry.ts 顶部添加导入
// ============================================================
import ${varName} from './svgs/${fileName}?raw';

// ============================================================
// 步骤 3: 在 registerCustomCells() 函数内部添加注册
// ============================================================
Graph.registerNode('${shapeName}', {
  inherit: 'image',
  width: ${originalSize.w},
  height: ${originalSize.h},
  imageUrl: svgToDataUrl(${varName}),
  ports: {
    groups: {
${groupsStr}
    },
    items: [
${itemsStr}
    ],
  },
  attrs: LABEL_ATTRS,
  data: { 
    type: '${nodeType}', 
    tag: '${nodeTag}', 
    spec: 'Spec...',
  },
});

// ============================================================
// 步骤 4: 在 src/services/neo4j.ts 的 TYPE_MAPPING 中添加映射
// ============================================================
// const TYPE_MAPPING: Record<string, string[]> = {
//   ...
  '${nodeType}': ${neo4jLabels},
//   ...
// };

// ============================================================
// 步骤 5: 在 src/services/neo4j.ts 的 loadGraphData switch 中添加
// ============================================================
// switch (props.type) {
//   ...
  case '${nodeType}': shapeName = '${shapeName}'; break;
//   ...
// }`;
  };

  return (
    <Layout style={{ height: '100vh', background: '#fff' }}>
      <Sider width={380} style={{ background: '#fff', borderRight: '1px solid #eee', padding: 16, overflowY: 'auto' }}>
        <Title level={4}>1. SVG 源码</Title>
        <TextArea 
          rows={4} 
          value={svgInput} 
          onChange={e => setSvgInput(e.target.value)} 
          placeholder="在此粘贴 SVG 代码..."
        />
        <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            尺寸: {originalSize.w} x {originalSize.h}
          </Text>
          <Button 
            size="small" 
            icon={<FileAddOutlined />} 
            onClick={() => {
              navigator.clipboard.writeText(svgInput);
              message.success('SVG 源码已复制，请创建 .svg 文件');
            }}
          >
            复制 SVG
          </Button>
        </div>
        
        <Divider />
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <Title level={4} style={{ margin: 0 }}>3. 端口属性</Title>
          <Tooltip title="点击查看详细说明">
            <InfoCircleOutlined style={{ color: '#1890ff' }} />
          </Tooltip>
        </div>

        <Collapse ghost size="small" style={{ marginBottom: 16, background: '#f9f9f9', borderRadius: 4 }}>
          <Panel header="配置指南 (必读)" key="1">
            <Text type="secondary" style={{ fontSize: 12 }}>
              <ul style={{ paddingLeft: 16, margin: 0 }}>
                <li><b>Group</b>: 视觉分组 (如 top, left)，仅用于代码组织。</li>
                <li><b>Region</b>: <b>AI 语义核心</b>。
                  <ul style={{ marginTop: 4 }}>
                    <li><code>ShellSide</code>: 壳程/主容器</li>
                    <li><code>TubeSide</code>: 管程</li>
                    <li><code>Jacket</code>: 夹套</li>
                  </ul>
                </li>
                <li><b>Dir</b>: 流向。In 只能连 Out。</li>
              </ul>
            </Text>
          </Panel>
        </Collapse>

        {selectedPortId ? (
          <Form form={form} layout="vertical" onValuesChange={handleFormChange} initialValues={ports.find(p => p.id === selectedPortId)}>
            <Row gutter={8}>
              <Col span={12}>
                <Form.Item name="id" label="ID" tooltip="端口唯一标识，如 n1, n2"><Input /></Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="group" label="Group" tooltip="视觉分组，如 top, left"><Input /></Form.Item>
              </Col>
            </Row>
            <Form.Item name="desc" label="描述 (语义)"><Input placeholder="例如：壳程入口" /></Form.Item>
            <Form.Item name="region" label="区域 (Region)" extra={<span style={{fontSize: 12, color: '#faad14'}}>AI 分析最重要的字段</span>}>
              <Select>
                <Option value="ShellSide">ShellSide (壳程/主容器)</Option>
                <Option value="ShellSide:Vapor">ShellSide:Vapor (气相区)</Option>
                <Option value="ShellSide:Liquid">ShellSide:Liquid (液相区)</Option>
                <Option value="TubeSide">TubeSide (管程/换热管)</Option>
                <Option value="Jacket">Jacket (夹套)</Option>
                <Option value="InnerVessel">InnerVessel (内胆)</Option>
              </Select>
            </Form.Item>
            <Form.Item name="dir" label="流向 (Direction)">
              <Select>
                <Option value="in">In (入口)</Option>
                <Option value="out">Out (出口)</Option>
                <Option value="bi">Bi (双向)</Option>
              </Select>
            </Form.Item>
            <Button danger icon={<DeleteOutlined />} onClick={() => handleDeletePort(selectedPortId)} block>删除此端口</Button>
          </Form>
        ) : (
          <div style={{ height: 200, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', border: '1px dashed #d9d9d9', borderRadius: 4, background: '#fafafa' }}>
            <QuestionCircleOutlined style={{ fontSize: 24, color: '#ccc', marginBottom: 8 }} />
            <Text type="secondary">请在右侧图上点击红点选中</Text>
          </div>
        )}
      </Sider>

      <Content style={{ display: 'flex', flexDirection: 'column', background: '#f0f2f5', height: '100%' }}>
        {/* 工具栏 */}
        <div style={{ 
          padding: '12px 24px', background: '#fff', borderBottom: '1px solid #eee', 
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 
        }}>
          <Title level={4} style={{ margin: 0 }}>2. 可视化打桩</Title>
          
          <Space size="large">
            <Checkbox checked={showGrid} onChange={e => setShowGrid(e.target.checked)}>
              显示 10px 网格
            </Checkbox>
            
            <Space>
              <Button icon={<ZoomOutOutlined />} onClick={() => setZoom(z => Math.max(0.5, z - 0.1))} />
              <Slider 
                min={0.5} max={5.0} step={0.1} 
                value={zoom} 
                onChange={val => setZoom(val)} 
                style={{ width: 100 }} 
                tooltip={{ formatter: (val) => `${Math.round((val || 1) * 100)}%` }}
              />
              <Button icon={<ZoomInOutlined />} onClick={() => setZoom(z => Math.min(5.0, z + 0.1))} />
              <Button icon={<ReloadOutlined />} onClick={() => setZoom(1.0)}>重置</Button>
            </Space>
          </Space>
        </div>

        {/* 滚动容器 */}
        <div 
          ref={scrollContainerRef}
          style={{ 
            flex: 1, 
            overflow: 'auto', 
            padding: 24, 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'flex-start'
          }}
          onWheel={handleWheel}
        >
          <div 
            style={{ 
              width: containerSize.w * zoom, 
              height: containerSize.h * zoom, 
              border: '1px dashed #999', 
              background: `url('data:image/svg+xml;utf8,${encodeURIComponent(svgInput)}') no-repeat center center`,
              backgroundSize: '100% 100%', 
              position: 'relative',
              backgroundColor: '#fff',
              cursor: 'crosshair',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              transition: 'width 0.1s, height 0.1s'
            }}
            ref={imgContainerRef}
            onClick={handleCanvasClick}
          >
            {showGrid && (
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                pointerEvents: 'none', zIndex: 1,
                backgroundImage: `
                  linear-gradient(to right, rgba(0,0,0,0.1) 1px, transparent 1px),
                  linear-gradient(to bottom, rgba(0,0,0,0.1) 1px, transparent 1px)
                `,
                backgroundSize: `${10 * zoom}px ${10 * zoom}px`
              }} />
            )}

            {ports.map(port => (
              <div
                key={port.id}
                className="port-dot"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPortId(port.id);
                  form.setFieldsValue(port);
                }}
                style={{
                  position: 'absolute',
                  left: `${port.x}%`,
                  top: `${port.y}%`,
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: selectedPortId === port.id ? '#1890ff' : 'red',
                  border: '2px solid white',
                  transform: 'translate(-50%, -50%)',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                  zIndex: 10
                }}
                title={`${port.id}: ${port.desc}`}
              >
                <div style={{ position: 'absolute', top: -20, left: '50%', transform: 'translateX(-50%)', fontSize: 10, background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '0 4px', borderRadius: 2, whiteSpace: 'nowrap' }}>
                  {port.id}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div style={{ padding: '4px 24px', background: '#fff', borderTop: '1px solid #eee', fontSize: 12, color: '#999', textAlign: 'right' }}>
          提示：按住 Ctrl + 滚轮可快速缩放。当前尺寸: {(containerSize.w * zoom).toFixed(0)}x{(containerSize.h * zoom).toFixed(0)}px
        </div>
      </Content>

      <Sider width={400} style={{ background: '#fff', borderLeft: '1px solid #eee', padding: 16 }}>
        <Title level={4}>4. 生成代码</Title>
        <div style={{ marginBottom: 16 }}>
          <Input addonBefore="Type" value={nodeType} onChange={e => setNodeType(e.target.value)} style={{ marginBottom: 8 }} placeholder="如 Reactor" />
          <Input addonBefore="Tag" value={nodeTag} onChange={e => setNodeTag(e.target.value)} placeholder="如 R-101" />
        </div>
        <TextArea 
          value={generateCode()} 
          autoSize={{ minRows: 20, maxRows: 30 }} 
          style={{ fontFamily: 'monospace', fontSize: 12, background: '#f5f5f5' }} 
        />
        <Button type="primary" icon={<CopyOutlined />} block style={{ marginTop: 16 }} onClick={() => {
          navigator.clipboard.writeText(generateCode());
          message.success('完整注册代码已复制');
        }}>
          复制完整代码
        </Button>
      </Sider>
    </Layout>
  );
};

export default ShapeDesigner;