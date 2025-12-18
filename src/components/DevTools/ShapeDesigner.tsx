import React, { useState, useRef, useEffect } from 'react';
import { Layout, Input, Button, Form, Select, Row, Col, Typography, message, Divider, Collapse, Tooltip, Checkbox, Slider, Space, InputNumber } from 'antd';
import { CopyOutlined, DeleteOutlined, QuestionCircleOutlined, InfoCircleOutlined, ZoomInOutlined, ZoomOutOutlined, ReloadOutlined, FileAddOutlined, SyncOutlined, ColumnHeightOutlined, ScissorOutlined, AimOutlined } from '@ant-design/icons';

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
  { value: 'Valve', label: '阀门 (Valve)', prefix: 'V' },
  { value: 'ControlValve', label: '调节阀 (ControlValve)', prefix: 'FV' },
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
  
  const [showGrid, setShowGrid] = useState(true);
  const [zoom, setZoom] = useState(1.0);

  // 画布显示的物理尺寸 (px)
  const [containerSize, setContainerSize] = useState({ w: 600, h: 300 });
  
  // 原始尺寸状态
  const [originalSize, setOriginalSize] = useState({ w: 100, h: 100 });

  // SVG 内部逻辑尺寸 (viewBox)
  const [svgViewBox, setSvgViewBox] = useState<ViewBox>({ x: 0, y: 0, w: 100, h: 100 });
  
  // 鼠标当前的 SVG 坐标
  const [mouseSvgPos, setMouseSvgPos] = useState<{x: number, y: number} | null>(null);

  // 网格捕捉设置
  const [enableSnap, setEnableSnap] = useState(true);
  const [gridSize, setGridSize] = useState(10); 

  const imgContainerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [form] = Form.useForm();

  // 解析 SVG viewBox 和 原始尺寸
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

    } catch (e) {
      console.warn('SVG Parse Warning:', e);
    }
  }, [svgInput]);

  // [核心修改] 居中规整化：调整 ViewBox 原点以保持内容居中，不拉伸
  const normalizeDimensions = () => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgInput, 'image/svg+xml');
      const svg = doc.querySelector('svg');
      
      if (!svg) {
        message.error('无法解析 SVG');
        return;
      }

      // 1. 获取当前 ViewBox (作为内容的真实边界)
      // 如果没有 viewBox，则使用 width/height 构造一个
      let oldVb = { x: 0, y: 0, w: originalSize.w, h: originalSize.h };
      const currentVBAttr = svg.getAttribute('viewBox');
      if (currentVBAttr) {
        const parts = currentVBAttr.split(/[\s,]+/).filter(Boolean).map(Number);
        if (parts.length === 4) {
          oldVb = { x: parts[0], y: parts[1], w: parts[2], h: parts[3] };
        }
      }

      // 2. 计算目标尺寸 (四舍五入到最近的 10)
      // 例如: 50.271 -> 50, 25.135 -> 30 (或者 20，取决于 Math.round)
      let newW = Math.round(oldVb.w / 10) * 10;
      let newH = Math.round(oldVb.h / 10) * 10;
      if (newW === 0) newW = 10;
      if (newH === 0) newH = 10;

      // 3. [关键算法] 计算新的 ViewBox 原点，使旧内容居中
      // 公式: 新原点 = 旧原点 - (宽度差 / 2)
      // 这样做的效果是：如果新盒子比旧盒子宽，我们在左右两边均匀增加“视野”；
      // 如果新盒子比旧盒子窄，我们在左右两边均匀裁剪。
      const diffW = newW - oldVb.w;
      const diffH = newH - oldVb.h;
      
      const newVbX = oldVb.x - (diffW / 2);
      const newVbY = oldVb.y - (diffH / 2);

      // 4. 应用修改
      svg.setAttribute('width', String(newW));
      svg.setAttribute('height', String(newH));
      
      // 使用 toFixed(2) 避免浮点数精度问题导致 viewBox 出现极长小数
      svg.setAttribute('viewBox', `${newVbX.toFixed(2)} ${newVbY.toFixed(2)} ${newW} ${newH}`);

      // 5. 序列化回字符串
      const serializer = new XMLSerializer();
      const newSvgStr = serializer.serializeToString(doc);

      setSvgInput(newSvgStr);
      setOriginalSize({ w: newW, h: newH });
      setContainerSize({ w: newW, h: newH }); 
      
      message.success(`SVG 已居中规整: ${oldVb.w.toFixed(1)}x${oldVb.h.toFixed(1)} -> ${newW}x${newH}`);

    } catch (e) {
      console.error(e);
      message.error('规整化失败，请检查 SVG 格式');
    }
  };

  // 一键匹配比例
  const fitAspectRatio = () => {
    const ratio = svgViewBox.h / svgViewBox.w;
    const newH = Math.round(containerSize.w * ratio);
    setContainerSize(prev => ({ ...prev, h: newH }));
    message.success(`画布比例已调整为 ${containerSize.w}x${newH}`);
  };

  // 处理滚轮缩放
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const newZoom = Math.max(0.5, Math.min(5.0, zoom + delta));
      setZoom(parseFloat(newZoom.toFixed(1)));
    }
  };

  // 计算鼠标在 SVG 逻辑坐标系中的位置
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
    setMouseSvgPos({ 
      x: Math.round(coords.x * 10) / 10, 
      y: Math.round(coords.y * 10) / 10 
    });
  };

  // 智能百分比取整
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

    pctX = smartRoundPercent(pctX);
    pctY = smartRoundPercent(pctY);

    pctX = Math.max(0, Math.min(100, pctX));
    pctY = Math.max(0, Math.min(100, pctY));

    const newPort: PortConfig = {
      id: `p${ports.length + 1}`,
      group: 'all',
      x: pctX,
      y: pctY,
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

  const handleTypeChange = (value: string) => {
    setNodeType(value);
    const typeInfo = EQUIPMENT_TYPES.find(t => t.value === value);
    if (typeInfo && typeInfo.prefix) {
      setNodeTag(`${typeInfo.prefix}-New`);
    }
  };

  const generateCode = () => {
    const cleanTag = nodeTag.replace(/[-_]/g, '').toLowerCase();
    const varName = `${cleanTag}Svg`;
    const fileName = `${nodeTag}.svg`;
    const shapeName = `p-${nodeTag.toLowerCase()}`;

    const groups = Array.from(new Set(ports.map(p => p.group)));
    const groupsStr = groups.map(g => `        ${g}: { position: 'absolute', attrs: PORT_ATTRS }`).join(',\n');
    const itemsStr = ports.map(p => 
      `        { id: '${p.id}', group: '${p.group}', args: { x: '${p.x}%', y: '${p.y}%' }, data: { desc: '${p.desc}', region: '${p.region}', dir: '${p.dir}' } as PortData }`
    ).join(',\n');

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
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#666' }}>
            <span>
              原始尺寸: {Number(originalSize.w).toFixed(1)} x {Number(originalSize.h).toFixed(1)}
            </span>
            <Tooltip title="居中规整化：将尺寸调整为 10 的倍数，并保持内容居中不拉伸">
              <Button size="small" type="primary" ghost icon={<AimOutlined />} onClick={normalizeDimensions}>
                规整化
              </Button>
            </Tooltip>
          </div>
          <div style={{ fontSize: 12, color: '#999' }}>
            ViewBox: {svgViewBox.x}, {svgViewBox.y}, {svgViewBox.w}, {svgViewBox.h}
          </div>
          <Button 
            size="small" 
            icon={<FileAddOutlined />} 
            onClick={() => {
              navigator.clipboard.writeText(svgInput);
              message.success('SVG 源码已复制');
            }}
            block
            style={{ marginTop: 4 }}
          >
            复制 SVG 源码
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

      <Content style={{ display: 'flex', flexDirection: 'column', background: '#f0f2f5', height: '100%', overflow: 'hidden' }}>
        {/* 工具栏 */}
        <div style={{ 
          padding: '8px 24px', background: '#fff', borderBottom: '1px solid #eee', 
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, flexWrap: 'wrap', gap: 8
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Title level={4} style={{ margin: 0 }}>2. 可视化打桩</Title>
            
            {/* 画布尺寸设置 */}
            <Space size="small" style={{ borderLeft: '1px solid #eee', paddingLeft: 16 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>画布:</Text>
              <InputNumber 
                size="small" 
                value={containerSize.w} 
                onChange={v => setContainerSize(s => ({ ...s, w: v || 100 }))} 
                style={{ width: 60 }} 
              />
              <Text type="secondary">x</Text>
              <InputNumber 
                size="small" 
                value={containerSize.h} 
                onChange={v => setContainerSize(s => ({ ...s, h: v || 100 }))} 
                style={{ width: 60 }} 
              />
              <Tooltip title="调整画布高度以匹配 SVG 比例 (防止变形)">
                <Button size="small" icon={<ColumnHeightOutlined />} onClick={fitAspectRatio}>适应比例</Button>
              </Tooltip>
            </Space>

            {/* 网格捕捉设置 */}
            <Space size="small" style={{ borderLeft: '1px solid #eee', paddingLeft: 16 }}>
              <Checkbox checked={enableSnap} onChange={e => setEnableSnap(e.target.checked)}>
                SVG 坐标捕捉
              </Checkbox>
              <InputNumber 
                size="small" 
                value={gridSize} 
                onChange={v => setGridSize(v || 10)} 
                style={{ width: 50 }} 
                disabled={!enableSnap}
                min={0.1}
                step={1}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>units</Text>
            </Space>
          </div>
          
          <Space>
            <Checkbox checked={showGrid} onChange={e => setShowGrid(e.target.checked)}>
              网格
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
              <Button icon={<ReloadOutlined />} onClick={() => setZoom(1.0)}>1:1</Button>
            </Space>
          </Space>
        </div>

        {/* 滚动容器 (Outer Scroll View) */}
        <div 
          ref={scrollContainerRef}
          style={{ 
            flex: 1, 
            overflow: 'auto', 
            display: 'flex',  
            padding: 20,      
            background: '#e6e6e6' 
          }}
          onWheel={handleWheel}
        >
          {/* 画布本体 */}
          <div 
            style={{ 
              width: containerSize.w * zoom, 
              height: containerSize.h * zoom, 
              border: '1px solid #999', 
              position: 'relative',
              backgroundColor: '#fff',
              cursor: 'crosshair',
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
              transition: 'width 0.1s, height 0.1s',
              flexShrink: 0, 
              margin: 'auto' 
            }}
            ref={imgContainerRef}
            onClick={handleCanvasClick}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setMouseSvgPos(null)}
          >
            <img 
              src={`data:image/svg+xml;utf8,${encodeURIComponent(svgInput)}`}
              style={{
                width: '100%',
                height: '100%',
                display: 'block',
                pointerEvents: 'none',
                userSelect: 'none',
                objectFit: 'fill' 
              }}
              draggable={false}
              alt="SVG Preview"
            />

            {showGrid && (
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                pointerEvents: 'none', zIndex: 1,
                backgroundImage: `
                  linear-gradient(to right, rgba(0,0,0,0.1) 1px, transparent 1px),
                  linear-gradient(to bottom, rgba(0,0,0,0.1) 1px, transparent 1px)
                `,
                backgroundSize: `${(containerSize.w / svgViewBox.w) * gridSize * zoom}px ${(containerSize.h / svgViewBox.h) * gridSize * zoom}px`
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
        
        <div style={{ padding: '4px 24px', background: '#fff', borderTop: '1px solid #eee', fontSize: 12, color: '#666', display: 'flex', justifyContent: 'space-between' }}>
          <span>
            {mouseSvgPos && `SVG 坐标: X=${mouseSvgPos.x}, Y=${mouseSvgPos.y}`}
          </span>
          <span>
            当前设计尺寸: {containerSize.w}x{containerSize.h}px (显示比例: {(zoom * 100).toFixed(0)}%)
          </span>
        </div>
      </Content>

      <Sider width={400} style={{ background: '#fff', borderLeft: '1px solid #eee', padding: 16 }}>
        <Title level={4}>4. 生成代码</Title>
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center' }}>
            <span style={{ width: 60, display: 'inline-block', color: 'rgba(0, 0, 0, 0.88)' }}>Type:</span>
            <Select 
              value={nodeType} 
              onChange={handleTypeChange} 
              style={{ flex: 1 }}
              showSearch
              optionFilterProp="label"
            >
              {EQUIPMENT_TYPES.map(t => (
                <Option key={t.value} value={t.value} label={t.label}>
                  {t.label}
                </Option>
              ))}
            </Select>
          </div>
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