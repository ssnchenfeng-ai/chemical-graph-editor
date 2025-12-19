import React, { useState, useRef, useEffect } from 'react';
import { Layout, Input, Button, Form, Select, Row, Col, Typography, message, Divider, Collapse, Tooltip, Checkbox, Slider, Space, InputNumber, Radio } from 'antd';
import { 
  CopyOutlined, DeleteOutlined, QuestionCircleOutlined, InfoCircleOutlined, 
  ZoomInOutlined, ZoomOutOutlined, ReloadOutlined, FileAddOutlined, 
  ColumnHeightOutlined, AimOutlined,
  ImportOutlined, CloudUploadOutlined 
} from '@ant-design/icons';

// 1. 导入注册表和缓存
import { registerCustomCells, SHAPE_LIBRARY } from '../../graph/cells/registry';

const { Content, Sider } = Layout;
const { TextArea } = Input;
const { Title, Text } = Typography;
const { Option } = Select;
const { Panel } = Collapse;

// 默认 SVG 模板
const DEFAULT_SVG = `<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="black" stroke-width="2">
  <rect x="10" y="10" width="180" height="80" rx="20" ry="20" fill="white" />
  <line x1="10" y1="50" x2="190" y2="50" stroke="#1890ff" stroke-dasharray="4 2" />
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

interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

// 预置设备类型列表
const EQUIPMENT_TYPES = [
  { value: 'Reactor', label: '反应器 (Reactor)', prefix: 'R' },
  { value: 'Exchanger', label: '换热器 (Exchanger)', prefix: 'E' },
  { value: 'Evaporator', label: '蒸发器 (Evaporator)', prefix: 'E' },
  { value: 'Tank', label: '储罐 (Tank)', prefix: 'V' },
  { value: 'Pump', label: '泵 (Pump)', prefix: 'P' },
  { value: 'Compressor', label: '压缩机 (Compressor)', prefix: 'C' },
  { value: 'Fan', label: '风机 (Fan)', prefix: 'K' },
  
  { value: 'Valve', label: '通用阀门 (Valve)', prefix: 'V' },
  { value: 'ControlValve', label: '调节阀 (ControlValve)', prefix: 'FV' },
  { value: 'ManualValve', label: '手动阀 (ManualValve)', prefix: 'HV' },
  { value: 'Trap', label: '疏水阀 (Trap)', prefix: 'S' },
  
  { value: 'Instrument', label: '仪表 (Instrument)', prefix: 'PI' },
  { value: 'Fitting', label: '管件 (Fitting)', prefix: '' },
  { value: 'Other', label: '其他 (Other)', prefix: 'M' },
];

const ShapeDesigner: React.FC = () => {
  const [svgInput, setSvgInput] = useState(DEFAULT_SVG);
  const [ports, setPorts] = useState<PortConfig[]>([]);
  const [selectedPortId, setSelectedPortId] = useState<string | null>(null);
  
  const [nodeType, setNodeType] = useState('Reactor');
  const [nodeTag, setNodeTag] = useState('R-New');
  
  // [新增] 命名模式：按类型保存 vs 按Tag保存
  const [namingMode, setNamingMode] = useState<'type' | 'tag'>('type');

  const [showGrid, setShowGrid] = useState(true);
  const [zoom, setZoom] = useState(1.0);
  const [containerSize, setContainerSize] = useState({ w: 600, h: 300 });
  const [originalSize, setOriginalSize] = useState({ w: 100, h: 100 });
  const [svgViewBox, setSvgViewBox] = useState<ViewBox>({ x: 0, y: 0, w: 100, h: 100 });
  const [mouseSvgPos, setMouseSvgPos] = useState<{x: number, y: number} | null>(null);
  const [enableSnap, setEnableSnap] = useState(true);
  const [gridSize, setGridSize] = useState(10); 

  const imgContainerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [form] = Form.useForm();

  const [selectedLibraryShape, setSelectedLibraryShape] = useState<string | null>(null);
  const [libraryTick, setLibraryTick] = useState(0);

  const refreshLibrary = () => {
    try {
      registerCustomCells();
      setLibraryTick(t => t + 1);
      console.log('Library refreshed');
    } catch (e) {
      console.warn('Registry load warning', e);
    }
  };

  useEffect(() => {
    refreshLibrary();
  }, []);

  const handleLoadFromLibrary = (shapeId: string) => {
    const config = SHAPE_LIBRARY[shapeId];
    if (!config) {
      message.error('未找到该图元配置');
      return;
    }

    if (config.rawSvg) setSvgInput(config.rawSvg);

    const w = config.width || 100;
    const h = config.height || 100;
    setOriginalSize({ w, h });
    setContainerSize({ w, h });

    if (config.data) {
      setNodeType(config.data.type || 'Equipment');
      setNodeTag(config.data.tag || shapeId.replace('p-', '').toUpperCase());
    }

    if (config.ports && Array.isArray(config.ports.items)) {
      const restoredPorts: PortConfig[] = config.ports.items.map((item: any) => {
        let x = 0;
        let y = 0;
        if (item.args) {
          if (typeof item.args.x === 'string' && item.args.x.includes('%')) {
            x = parseFloat(item.args.x);
          } else {
            x = Number(item.args.x);
          }
          if (typeof item.args.y === 'string' && item.args.y.includes('%')) {
            y = parseFloat(item.args.y);
          } else {
            y = Number(item.args.y);
          }
        }
        return {
          id: item.id,
          group: item.group || 'default',
          x: isNaN(x) ? 0 : x,
          y: isNaN(y) ? 0 : y,
          desc: item.data?.desc || item.attrs?.circle?.title || '未命名端口',
          region: item.data?.region || 'ShellSide',
          dir: item.data?.dir || 'bi'
        };
      });
      setPorts(restoredPorts);
      message.success(`已加载图元: ${shapeId}`);
    } else {
      setPorts([]);
      message.info(`已加载图元: ${shapeId} (无端口)`);
    }
    setSelectedLibraryShape(shapeId);
  };

  // [新增] 获取文件基础名称的辅助函数
  const getFileBaseName = () => {
    if (namingMode === 'type') {
      // 模式1：按类型 (如 Reactor -> reactor)
      return nodeType.toLowerCase();
    } else {
      // 模式2：按Tag (如 R-101 -> r101)
      return nodeTag.replace(/[-_]/g, '').toLowerCase();
    }
  };

  const handleSaveToProject = async () => {
    // 1. 构造文件名
    const baseName = getFileBaseName();
    const fileName = `p-${baseName}`; // 例如 p-reactor 或 p-r101

    // 2. 构造 JSON 配置内容
    const jsonContent = {
      width: originalSize.w,
      height: originalSize.h,
      ports: {
        groups: {
            ...Array.from(new Set(ports.map(p => p.group))).reduce((acc, g) => ({
                ...acc,
                [g]: { position: 'absolute', attrs: { circle: { r: 3, magnet: true, stroke: '#FFFFFF', strokeWidth: 1, fill: '#e3dedeff' } } }
            }), {})
        },
        items: ports.map(p => ({
          id: p.id,
          group: p.group,
          args: { x: `${p.x}%`, y: `${p.y}%` },
          data: { desc: p.desc, region: p.region, dir: p.dir }
        }))
      },
      data: {
        type: nodeType,
        tag: nodeTag, // 即使按类型保存，Tag 也会作为默认值写入 data
        spec: 'Spec...' 
      }
    };

    try {
      const response = await fetch('/_api/save-shape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: fileName,
          svgContent: svgInput,
          jsonContent: jsonContent
        })
      });

      const res = await response.json();
      if (res.success) {
        message.success(`保存成功！文件: ${fileName}.json`);
        message.loading({ content: '正在同步图元库...', key: 'sync_lib' });
        setTimeout(() => {
          refreshLibrary();
          message.success({ content: '图元库已同步', key: 'sync_lib' });
        }, 1500);
      } else {
        message.error('保存失败: ' + res.message);
      }
    } catch (e) {
      message.error('网络请求失败');
    }
  };

  // ... (SVG 解析、规整化、缩放等逻辑保持不变) ...
  useEffect(() => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgInput, 'image/svg+xml');
      const svg = doc.querySelector('svg');
      if (!svg) return;
      let vb = { x: 0, y: 0, w: 100, h: 100 };
      const viewBoxAttr = svg.getAttribute('viewBox');
      if (viewBoxAttr) {
        const parts = viewBoxAttr.split(/[\s,]+/).filter(Boolean).map(Number);
        if (parts.length === 4) { 
          vb = { x: parts[0], y: parts[1], w: parts[2], h: parts[3] };
        }
      } else {
        const attrW = parseFloat(svg.getAttribute('width') || '100');
        const attrH = parseFloat(svg.getAttribute('height') || '100');
        vb = { x: 0, y: 0, w: attrW, h: attrH };
      }
      setSvgViewBox(vb);
      const rawW = parseFloat(svg.getAttribute('width') || String(vb.w));
      const rawH = parseFloat(svg.getAttribute('height') || String(vb.h));
      setOriginalSize({ w: rawW, h: rawH });
    } catch (e) { console.warn(e); }
  }, [svgInput]);

  const normalizeDimensions = () => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgInput, 'image/svg+xml');
      const svg = doc.querySelector('svg');
      if (!svg) return;
      let oldVb = { x: 0, y: 0, w: originalSize.w, h: originalSize.h };
      const currentVBAttr = svg.getAttribute('viewBox');
      if (currentVBAttr) {
        const parts = currentVBAttr.split(/[\s,]+/).filter(Boolean).map(Number);
        if (parts.length === 4) oldVb = { x: parts[0], y: parts[1], w: parts[2], h: parts[3] };
      }
      let newW = Math.round(oldVb.w / 10) * 10;
      let newH = Math.round(oldVb.h / 10) * 10;
      if (newW === 0) newW = 10;
      if (newH === 0) newH = 10;
      const diffW = newW - oldVb.w;
      const diffH = newH - oldVb.h;
      const newVbX = oldVb.x - (diffW / 2);
      const newVbY = oldVb.y - (diffH / 2);
      svg.setAttribute('width', String(newW));
      svg.setAttribute('height', String(newH));
      svg.setAttribute('viewBox', `${newVbX.toFixed(2)} ${newVbY.toFixed(2)} ${newW} ${newH}`);
      const serializer = new XMLSerializer();
      setSvgInput(serializer.serializeToString(doc));
      setOriginalSize({ w: newW, h: newH });
      setContainerSize({ w: newW, h: newH }); 
      message.success(`SVG 已规整: ${newW}x${newH}`);
    } catch (e) { message.error('规整化失败'); }
  };

  const fitAspectRatio = () => {
    const ratio = svgViewBox.h / svgViewBox.w;
    const newH = Math.round(containerSize.w * ratio);
    setContainerSize(prev => ({ ...prev, h: newH }));
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const newZoom = Math.max(0.5, Math.min(5.0, zoom + delta));
      setZoom(parseFloat(newZoom.toFixed(1)));
    }
  };

  const getSvgCoordinates = (clientX: number, clientY: number) => {
    if (!imgContainerRef.current) return { x: 0, y: 0 };
    const rect = imgContainerRef.current.getBoundingClientRect();
    const relX = (clientX - rect.left) / rect.width;
    const relY = (clientY - rect.top) / rect.height;
    const svgX = svgViewBox.x + (relX * svgViewBox.w);
    const svgY = svgViewBox.y + (relY * svgViewBox.h);
    return { x: svgX, y: svgY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const coords = getSvgCoordinates(e.clientX, e.clientY);
    setMouseSvgPos({ x: Math.round(coords.x * 10) / 10, y: Math.round(coords.y * 10) / 10 });
  };

  const smartRoundPercent = (val: number) => {
    if (val < 0.5) return 0;
    if (val > 99.5) return 100;
    const rounded = Math.round(val);
    if (Math.abs(val - rounded) < 0.5) return rounded;
    const halfRounded = Math.round(val * 2) / 2;
    if (Math.abs(val - halfRounded) < 0.25) return halfRounded;
    return Number(val.toFixed(2));
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (!imgContainerRef.current) return;
    if ((e.target as HTMLElement).closest('.port-dot')) return;
    let { x: svgX, y: svgY } = getSvgCoordinates(e.clientX, e.clientY);
    if (enableSnap) {
      const relativeX = svgX - svgViewBox.x;
      const relativeY = svgY - svgViewBox.y;
      const snappedRelX = Math.round(relativeX / gridSize) * gridSize;
      const snappedRelY = Math.round(relativeY / gridSize) * gridSize;
      svgX = svgViewBox.x + snappedRelX;
      svgY = svgViewBox.y + snappedRelY;
    }
    let pctX = ((svgX - svgViewBox.x) / svgViewBox.w) * 100;
    let pctY = ((svgY - svgViewBox.y) / svgViewBox.h) * 100;
    pctX = Math.max(0, Math.min(100, smartRoundPercent(pctX)));
    pctY = Math.max(0, Math.min(100, smartRoundPercent(pctY)));
    const newPort: PortConfig = {
      id: `p${ports.length + 1}`, group: 'all', x: pctX, y: pctY,
      desc: '新接口', region: 'ShellSide', dir: 'bi'
    };
    setPorts([...ports, newPort]);
    setSelectedPortId(newPort.id);
    form.setFieldsValue(newPort);
  };

  const handleFormChange = (changedValues: any, allValues: any) => {
    if (!selectedPortId) return;
    setPorts(ports.map(p => p.id === selectedPortId ? { ...p, ...allValues } : p));
    if (changedValues.id && changedValues.id !== selectedPortId) {
      setSelectedPortId(changedValues.id);
    }
  };

  const handleDeletePort = (id: string) => {
    setPorts(ports.filter(p => p.id !== id));
    if (selectedPortId === id) setSelectedPortId(null);
  };

  const handleTypeChange = (value: string) => {
    setNodeType(value);
    const typeInfo = EQUIPMENT_TYPES.find(t => t.value === value);
    if (typeInfo && typeInfo.prefix) {
      setNodeTag(`${typeInfo.prefix}-New`);
    }
  };

  const generateCode = () => {
    const baseName = getFileBaseName();
    const varName = `${baseName.replace(/-/g, '')}Svg`;
    const fileName = `${baseName}.svg`;
    const shapeName = `p-${baseName}`;

    const groups = Array.from(new Set(ports.map(p => p.group)));
    const groupsStr = groups.map(g => `        ${g}: { position: 'absolute', attrs: PORT_ATTRS }`).join(',\n');
    const itemsStr = ports.map(p => 
      `        { id: '${p.id}', group: '${p.group}', args: { x: '${p.x}%', y: '${p.y}%' }, data: { desc: '${p.desc}', region: '${p.region}', dir: '${p.dir}' } as PortData }`
    ).join(',\n');

    const neo4jLabels = nodeType === 'Instrument' ? `['Instrument']` : `['Equipment', '${nodeType}']`;

    return `/** 
 * 文件: src/graph/cells/svgs/${fileName}
 */
// 注册代码:
import ${varName} from './svgs/${fileName}?raw';

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
});`;
  };

  return (
    <Layout style={{ height: '100vh', background: '#fff' }}>
      <Sider width={380} style={{ background: '#fff', borderRight: '1px solid #eee', padding: 16, overflowY: 'auto' }}>
        <div style={{ background: '#f0f5ff', padding: 12, borderRadius: 6, marginBottom: 16, border: '1px solid #adc6ff' }}>
          <div style={{ fontWeight: 'bold', marginBottom: 8, color: '#2f54eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span><ImportOutlined /> 加载已有图元修改</span>
            <Tooltip title="刷新列表"><Button type="text" size="small" icon={<ReloadOutlined />} onClick={() => { refreshLibrary(); message.success('列表已刷新'); }} /></Tooltip>
          </div>
          <Select
            showSearch
            style={{ width: '100%' }}
            placeholder="选择已注册的图元..."
            optionFilterProp="children"
            onChange={handleLoadFromLibrary}
            value={selectedLibraryShape}
            options={Object.keys(SHAPE_LIBRARY).map(key => ({ value: key, label: `${key} (${SHAPE_LIBRARY[key].data?.type || 'Unknown'})` }))}
            filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
          />
        </div>

        <Title level={4}>1. SVG 源码</Title>
        <TextArea rows={4} value={svgInput} onChange={e => setSvgInput(e.target.value)} placeholder="在此粘贴 SVG 代码..." />
        <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#666' }}>
          <span>原始尺寸: {Number(originalSize.w).toFixed(1)} x {Number(originalSize.h).toFixed(1)}</span>
          <Tooltip title="居中规整化"><Button size="small" type="primary" ghost icon={<AimOutlined />} onClick={normalizeDimensions}>规整化</Button></Tooltip>
        </div>
        
        <Divider />
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <Title level={4} style={{ margin: 0 }}>3. 端口属性</Title>
          <Tooltip title="点击查看详细说明"><InfoCircleOutlined style={{ color: '#1890ff' }} /></Tooltip>
        </div>
        <Collapse ghost size="small" style={{ marginBottom: 16, background: '#f9f9f9', borderRadius: 4 }}>
          <Panel header="配置指南 (必读)" key="1">
            <Text type="secondary" style={{ fontSize: 12 }}>
              <ul style={{ paddingLeft: 16, margin: 0 }}>
                <li><b>Group</b>: 视觉分组 (如 top, left)。</li>
                <li><b>Region</b>: <b>AI 语义核心</b> (ShellSide, TubeSide, Jacket)。</li>
                <li><b>Dir</b>: 流向 (in, out, bi)。</li>
              </ul>
            </Text>
          </Panel>
        </Collapse>

        {selectedPortId ? (
          <Form form={form} layout="vertical" onValuesChange={handleFormChange} initialValues={ports.find(p => p.id === selectedPortId)}>
            <Row gutter={8}>
              <Col span={12}><Form.Item name="id" label="ID"><Input /></Form.Item></Col>
              <Col span={12}><Form.Item name="group" label="Group"><Input /></Form.Item></Col>
            </Row>
            <Form.Item name="desc" label="描述 (语义)"><Input /></Form.Item>
            <Form.Item name="region" label="区域 (Region)">
              <Select>
                <Option value="ShellSide">ShellSide (壳程)</Option>
                <Option value="TubeSide">TubeSide (管程)</Option>
                <Option value="Jacket">Jacket (夹套)</Option>
                <Option value="InnerVessel">InnerVessel (内胆)</Option>
              </Select>
            </Form.Item>
            <Form.Item name="dir" label="流向"><Select><Option value="in">In</Option><Option value="out">Out</Option><Option value="bi">Bi</Option></Select></Form.Item>
            <Button danger icon={<DeleteOutlined />} onClick={() => handleDeletePort(selectedPortId)} block>删除此端口</Button>
          </Form>
        ) : (
          <div style={{ height: 100, display: 'flex', justifyContent: 'center', alignItems: 'center', border: '1px dashed #d9d9d9', borderRadius: 4, background: '#fafafa' }}>
            <Text type="secondary">请在右侧图上点击红点选中</Text>
          </div>
        )}
      </Sider>

      <Content style={{ display: 'flex', flexDirection: 'column', background: '#f0f2f5', height: '100%', overflow: 'hidden' }}>
        <div style={{ padding: '8px 24px', background: '#fff', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Title level={4} style={{ margin: 0 }}>2. 可视化打桩</Title>
            <Space size="small" style={{ borderLeft: '1px solid #eee', paddingLeft: 16 }}>
              <Text type="secondary">画布:</Text>
              <InputNumber size="small" value={containerSize.w} onChange={v => setContainerSize(s => ({ ...s, w: v || 100 }))} style={{ width: 60 }} />
              <Text type="secondary">x</Text>
              <InputNumber size="small" value={containerSize.h} onChange={v => setContainerSize(s => ({ ...s, h: v || 100 }))} style={{ width: 60 }} />
              <Button size="small" icon={<ColumnHeightOutlined />} onClick={fitAspectRatio}>适应比例</Button>
            </Space>
            <Space size="small" style={{ borderLeft: '1px solid #eee', paddingLeft: 16 }}>
              <Checkbox checked={enableSnap} onChange={e => setEnableSnap(e.target.checked)}>捕捉</Checkbox>
              <InputNumber size="small" value={gridSize} onChange={v => setGridSize(v || 10)} style={{ width: 50 }} disabled={!enableSnap} />
            </Space>
          </div>
          <Space>
            <Checkbox checked={showGrid} onChange={e => setShowGrid(e.target.checked)}>网格</Checkbox>
            <Space>
              <Button icon={<ZoomOutOutlined />} onClick={() => setZoom(z => Math.max(0.5, z - 0.1))} />
              <Slider min={0.5} max={5.0} step={0.1} value={zoom} onChange={val => setZoom(val)} style={{ width: 100 }} />
              <Button icon={<ZoomInOutlined />} onClick={() => setZoom(z => Math.min(5.0, z + 0.1))} />
            </Space>
          </Space>
        </div>

        <div ref={scrollContainerRef} style={{ flex: 1, overflow: 'auto', display: 'flex', padding: 20, background: '#e6e6e6' }} onWheel={handleWheel}>
          <div 
            style={{ width: containerSize.w * zoom, height: containerSize.h * zoom, border: '1px solid #999', position: 'relative', backgroundColor: '#fff', cursor: 'crosshair', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', flexShrink: 0, margin: 'auto' }}
            ref={imgContainerRef} onClick={handleCanvasClick} onMouseMove={handleMouseMove} onMouseLeave={() => setMouseSvgPos(null)}
          >
            <img src={`data:image/svg+xml;utf8,${encodeURIComponent(svgInput)}`} style={{ width: '100%', height: '100%', display: 'block', pointerEvents: 'none', userSelect: 'none' }} draggable={false} />
            {showGrid && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 1, backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.1) 1px, transparent 1px)`, backgroundSize: `${(containerSize.w / originalSize.w) * gridSize * zoom}px ${(containerSize.h / originalSize.h) * gridSize * zoom}px` }} />}
            {ports.map(port => (
              <div key={port.id} className="port-dot" onClick={(e) => { e.stopPropagation(); setSelectedPortId(port.id); form.setFieldsValue(port); }} style={{ position: 'absolute', left: `${port.x}%`, top: `${port.y}%`, width: 12, height: 12, borderRadius: '50%', background: selectedPortId === port.id ? '#1890ff' : 'red', border: '2px solid white', transform: 'translate(-50%, -50%)', cursor: 'pointer', zIndex: 10 }} title={`${port.id}: ${port.desc}`} />
            ))}
          </div>
        </div>
      </Content>

      <Sider width={400} style={{ background: '#fff', borderLeft: '1px solid #eee', padding: 16 }}>
        <Title level={4}>4. 生成代码</Title>
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 12 }}>
            <Text strong>命名模式 (文件名):</Text>
            <div style={{ marginTop: 4 }}>
              <Radio.Group value={namingMode} onChange={e => setNamingMode(e.target.value)} buttonStyle="solid">
                <Radio.Button value="type">按类型 (p-{nodeType.toLowerCase()})</Radio.Button>
                <Radio.Button value="tag">按 Tag (p-{nodeTag.replace(/[-_]/g, '').toLowerCase()})</Radio.Button>
              </Radio.Group>
            </div>
          </div>

          <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center' }}>
            <span style={{ width: 60, display: 'inline-block', color: 'rgba(0, 0, 0, 0.88)' }}>Type:</span>
            <Select value={nodeType} onChange={handleTypeChange} style={{ flex: 1 }} showSearch optionFilterProp="label">
              {EQUIPMENT_TYPES.map(t => <Option key={t.value} value={t.value} label={t.label}>{t.label}</Option>)}
            </Select>
          </div>
          <Input addonBefore="Tag" value={nodeTag} onChange={e => setNodeTag(e.target.value)} placeholder="如 R-101" />
          <div style={{ marginTop: 8, fontSize: 12, color: '#1890ff' }}>
            将保存为: <b>p-{getFileBaseName()}.json</b>
          </div>
        </div>
        <TextArea value={generateCode()} autoSize={{ minRows: 15, maxRows: 25 }} style={{ fontFamily: 'monospace', fontSize: 12, background: '#f5f5f5' }} />
        
        <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
          <Button type="primary" icon={<CopyOutlined />} onClick={() => { navigator.clipboard.writeText(generateCode()); message.success('代码已复制'); }} style={{ flex: 1 }}>复制</Button>
          <Button type="primary" danger icon={<CloudUploadOutlined />} onClick={handleSaveToProject} style={{ flex: 1 }}>保存到项目</Button>
        </div>
      </Sider>
    </Layout>
  );
};

export default ShapeDesigner;