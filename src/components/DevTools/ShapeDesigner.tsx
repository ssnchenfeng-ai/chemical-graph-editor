import React, { useState, useRef, useEffect } from 'react';
import { Layout, Input, Button, Form, Select, Row, Col, Typography, message, Divider, Collapse, Tooltip, Checkbox, Slider, Space, InputNumber, Modal } from 'antd';
import { 
  CopyOutlined, DeleteOutlined, InfoCircleOutlined, 
  ZoomInOutlined, ZoomOutOutlined, ReloadOutlined, 
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

// [新增] 语义选项常量
const CHAMBER_OPTIONS = [
  { value: 'ShellSide', label: '壳程 (ShellSide)' },
  { value: 'TubeSide', label: '管程 (TubeSide)' },
  { value: 'InnerVessel', label: '内胆/釜体 (InnerVessel)' },
  { value: 'Jacket', label: '夹套 (Jacket)' },
  // === [新增] 阀门/管件/仪表专用 ===
  { value: 'Body', label: '本体/阀体 (Body)' }, // 阀门、三通、过滤器的主通道
  { value: 'ProcessConnection', label: '过程接口 (Process)' }, // 仪表接触介质的探头
  { value: 'SignalTerminal', label: '信号端子 (Signal)' }, // 仪表接线端
  { value: 'Actuator', label: '执行机构 (Actuator)' },
  { value: 'Connector', label: '连接器 (Connector)' },
  { value: 'Atmosphere', label: '大气 (Atmosphere)' },
];

const PHASE_OPTIONS = [
  { value: 'Liquid', label: '液相 (Liquid)' },
  { value: 'Vapor', label: '气相 (Vapor)' },
  { value: 'Mix', label: '气液混合 (Mix)' },
  { value: 'Solid', label: '固相 (Solid)' },
  // === [新增] 动态/特殊相态 ===
  { value: 'Any', label: '任意/跟随介质 (Any)' }, // 阀门、三通必选此项
  { value: 'Signal', label: '电/气信号 (Signal)' }, // 仪表信号线
  { value: 'None', label: '无 (None)' },
];
// ... (PHASE_OPTIONS 定义之后)

// [新增] 语义自动推导规则配置
// 键是设备类型，值是一个函数，根据端口分组(group)返回默认属性
const AUTO_SEMANTIC_RULES: Record<string, (group: string) => { chamber: string, phase: string }> = {
  // 1. 纯流体通道类 (完全写死：Body / Any)
  'Valve': () => ({ chamber: 'Body', phase: 'Any' }),
  'ManualValve': () => ({ chamber: 'Body', phase: 'Any' }),
  'Fitting': () => ({ chamber: 'Body', phase: 'Any' }),
  'Filter': () => ({ chamber: 'Body', phase: 'Any' }),
  'Trap': () => ({ chamber: 'Body', phase: 'Any' }),
  'SightGlass': () => ({ chamber: 'Body', phase: 'Any' }),
  'Silencer': () => ({ chamber: 'Body', phase: 'Any' }),
  'FlameArrester': () => ({ chamber: 'Body', phase: 'Any' }),
  'SafetyValve': () => ({ chamber: 'Body', phase: 'Any' }),
  'BreatherValve': () => ({ chamber: 'Body', phase: 'Any' }),
  'RuptureDisc': () => ({ chamber: 'Body', phase: 'Any' }),
  'OffPageConnector': () => ({ chamber: 'Connector', phase: 'Any' }),

  // 2. 调节阀 (半自动：尝试根据 group 区分)
  'ControlValve': (group) => {
    // 常见的执行机构分组名
    if (['actuator', 'top', 'signal'].includes(group.toLowerCase())) {
      return { chamber: 'Actuator', phase: 'Signal' };
    }
    return { chamber: 'Body', phase: 'Any' };
  },

  // 3. 仪表 (半自动)
  'Instrument': () => {
    return { chamber: 'ProcessConnection', phase: 'Any' };
  },
};

// ... (interface PortConfig 定义)

interface PortConfig {
  id: string;
  group: string;
  x: number;
  y: number;
  desc: string;
  // [修改] 拆分属性
  chamber: string;
  phase: string;
  dir: 'in' | 'out' | 'bi';
}

interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ShapeJsonContent {
  width: number;
  height: number;
  ports: {
    groups: Record<string, unknown>;
    items: Array<{
      id: string;
      group: string;
      args: { x: string; y: string };
      data: { desc: string; chamber: string; phase: string; dir: 'in' | 'out' | 'bi' };
    }>;
  };
  data: {
    type: string;
    tag: string;
    spec: string;
  };
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
  { value: 'Separator', label: '分离器 (Separator)', prefix: 'V' }, 
  { value: 'SafetyValve', label: '安全阀 (Safety Valve)', prefix: 'PSV' },
  { value: 'RuptureDisc', label: '爆破片 (Rupture Disc)', prefix: 'PSE' },
  { value: 'BreatherValve', label: '呼吸阀 (Breather Valve)', prefix: 'PV' },
  { value: 'Valve', label: '通用阀门 (Valve)', prefix: 'V' },
  { value: 'ControlValve', label: '调节阀 (ControlValve)', prefix: 'FV' },
  { value: 'ManualValve', label: '手动阀 (ManualValve)', prefix: 'HV' },
  { value: 'Trap', label: '疏水阀 (Trap)', prefix: 'S' },
  { value: 'Filter', label: '过滤器 (Filter)', prefix: 'FIL' },
  { value: 'FlameArrester', label: '阻火器 (Flame Arrester)', prefix: 'FA' },
  { value: 'SightGlass', label: '视镜 (Sight Glass)', prefix: 'SG' },
  { value: 'Silencer', label: '消音器 (Silencer)', prefix: 'SL' },
  { value: 'Instrument', label: '仪表 (Instrument)', prefix: 'PI' },
  { value: 'Fitting', label: '管件 (Fitting)', prefix: '' },
  { value: 'OffPageConnector', label: '跨页连接符 (OPC)', prefix: 'OPC' },
  { value: 'Other', label: '其他 (Other)', prefix: 'M' },
];

const slugifyName = (value: string) => value
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const ShapeDesigner: React.FC = () => {
  const [svgInput, setSvgInput] = useState(DEFAULT_SVG);
  const [ports, setPorts] = useState<PortConfig[]>([]);
  const [selectedPortId, setSelectedPortId] = useState<string | null>(null);
  
  const [nodeType, setNodeType] = useState('Reactor');
  const [nodeTag, setNodeTag] = useState('R-New');
  const [nameSuffix, setNameSuffix] = useState('');

  const [showGrid, setShowGrid] = useState(true);
  const [zoom, setZoom] = useState(1.0);
  const [containerSize, setContainerSize] = useState({ w: 600, h: 300 });
  const [originalSize, setOriginalSize] = useState({ w: 100, h: 100 });
  const [svgViewBox, setSvgViewBox] = useState<ViewBox>({ x: 0, y: 0, w: 100, h: 100 });
  const [, setMouseSvgPos] = useState<{x: number, y: number} | null>(null);
  const [draggingPortId, setDraggingPortId] = useState<string | null>(null);
  const isDraggingRef = useRef(false);
  const [enableSnap, setEnableSnap] = useState(true);
  const [gridSize, setGridSize] = useState(10); 

  const imgContainerRef = useRef<HTMLDivElement>(null);
  const [form] = Form.useForm();

  const [selectedLibraryShape, setSelectedLibraryShape] = useState<string | null>(null);
  const [, setLibraryTick] = useState(0);
  const [publishing, setPublishing] = useState(false);

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
    const timer = window.setTimeout(() => refreshLibrary(), 0);
    return () => window.clearTimeout(timer);
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
      const type = typeof config.data.type === 'string' ? config.data.type : 'Equipment';
      const tag = typeof config.data.tag === 'string' ? config.data.tag : shapeId.replace('p-', '').toUpperCase();
      setNodeType(type);
      setNodeTag(tag);
      const typeSlug = slugifyName(type);
      const shapeBase = shapeId.startsWith('p-') ? shapeId.slice(2) : shapeId;
      if (shapeBase === typeSlug) {
        setNameSuffix('');
      } else if (shapeBase.startsWith(`${typeSlug}-`)) {
        setNameSuffix(shapeBase.slice(typeSlug.length + 1));
      } else {
        setNameSuffix('');
      }
    }

    if (config.ports && Array.isArray(config.ports.items)) {
      const restoredPorts: PortConfig[] = config.ports.items.map((item: Record<string, unknown>) => {
        const args = (item.args || {}) as { x?: string | number; y?: string | number };
        const data = (item.data || {}) as { chamber?: string; phase?: string; region?: string; desc?: string; dir?: 'in' | 'out' | 'bi' };
        const attrs = (item.attrs || {}) as { circle?: { title?: string } };
        let x = 0;
        let y = 0;
        if (item.args) {
          if (typeof args.x === 'string' && args.x.includes('%')) {
            x = parseFloat(args.x);
          } else {
            x = Number(args.x);
          }
          if (typeof args.y === 'string' && args.y.includes('%')) {
            y = parseFloat(args.y);
          } else {
            y = Number(args.y);
          }
        }

        // [核心修改] 兼容旧数据，解析新数据
        let chamber = data.chamber;
        let phase = data.phase;

        // 如果没有新字段，尝试从旧 region 字段解析
        if (!chamber && data.region) {
          const parts = data.region.split(':');
          chamber = parts[0];
          phase = parts[1] || 'Mix';
        }

        return {
          id: String(item.id || ''),
          group: String(item.group || 'default'),
          x: isNaN(x) ? 0 : x,
          y: isNaN(y) ? 0 : y,
          desc: data.desc || attrs.circle?.title || '未命名端口',
          chamber: chamber || 'ShellSide',
          phase: phase || 'Mix',
          dir: data.dir || 'bi'
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

  const getFileBaseName = () => {
    const typeBase = slugifyName(nodeType) || 'equipment';
    const suffix = slugifyName(nameSuffix);
    return suffix ? `${typeBase}-${suffix}` : typeBase;
  };

  const buildJsonContent = (): ShapeJsonContent => ({
    width: originalSize.w,
    height: originalSize.h,
    ports: {
      groups: {
        ...Array.from(new Set(ports.map(p => p.group))).reduce<Record<string, unknown>>((acc, group) => ({
          ...acc,
          [group]: {
            position: 'absolute',
            attrs: { circle: { r: 3, magnet: true, stroke: '#FFFFFF', strokeWidth: 1, fill: '#e3dedeff' } }
          }
        }), {})
      },
      items: ports.map(p => ({
        id: p.id,
        group: p.group,
        args: { x: `${p.x}%`, y: `${p.y}%` },
        data: {
          desc: p.desc,
          chamber: p.chamber,
          phase: p.phase,
          dir: p.dir
        }
      }))
    },
    data: {
      type: nodeType,
      tag: nodeTag,
      spec: 'Spec...'
    }
  });

  const validatePublishPayload = (fileName: string, jsonContent: ShapeJsonContent) => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!/^p-[a-z0-9][a-z0-9-]*$/.test(fileName)) {
      errors.push('文件名不合法，仅允许小写字母/数字/短横线，且必须以 p- 开头。');
    }
    if (!svgInput.includes('<svg')) {
      errors.push('SVG 源码不完整，未检测到 <svg> 根节点。');
    }
    if (!jsonContent.data.type) {
      errors.push('设备类型不能为空。');
    }
    if (!jsonContent.data.tag) {
      warnings.push('Tag 为空，建议填写位号后再发布。');
    }

    const seenPortIds = new Set<string>();
    jsonContent.ports.items.forEach((port, index) => {
      if (!port.id.trim()) errors.push(`端口 #${index + 1} 的 ID 为空。`);
      if (!port.group.trim()) errors.push(`端口 ${port.id || `#${index + 1}`} 的 Group 为空。`);
      if (seenPortIds.has(port.id)) errors.push(`端口 ID 重复：${port.id}`);
      seenPortIds.add(port.id);

      const x = Number(port.args.x.replace('%', ''));
      const y = Number(port.args.y.replace('%', ''));
      if (Number.isNaN(x) || x < 0 || x > 100 || Number.isNaN(y) || y < 0 || y > 100) {
        errors.push(`端口 ${port.id} 坐标超出范围（应为 0%~100%）。`);
      }
    });

    if (jsonContent.ports.items.length === 0) {
      warnings.push('当前图元没有端口，发布后可能无法连线。');
    }

    return { errors, warnings };
  };

  const persistShapeToProject = async (fileName: string, jsonContent: ShapeJsonContent) => {
    setPublishing(true);
    try {
      const response = await fetch('/_api/save-shape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: fileName,
          svgContent: svgInput,
          jsonContent
        })
      });

      const res = await response.json() as { success?: boolean; message?: string };
      if (res.success) {
        message.success(`保存成功！文件: ${fileName}.json`);
        setTimeout(() => {
          refreshLibrary();
          message.success({ content: '图元库已同步', key: 'sync_lib' });
        }, 1000);
      } else {
        message.error(`保存失败: ${res.message || '未知错误'}`);
      }
    } catch {
      message.error('网络请求失败');
    } finally {
      setPublishing(false);
    }
  };

  const handlePublishWithValidation = async () => {
    const baseName = getFileBaseName();
    const fileName = `p-${baseName}`;
    const jsonContent = buildJsonContent();
    const { errors, warnings } = validatePublishPayload(fileName, jsonContent);
    const finalWarnings = [...warnings];
    if (SHAPE_LIBRARY[fileName] && fileName !== selectedLibraryShape) {
      finalWarnings.push(`图元 ${fileName} 已存在，本次发布会覆盖原有配置。`);
    }

    if (errors.length > 0) {
      Modal.error({
        title: '发布校验未通过',
        content: (
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            {errors.map((error) => <li key={error}>{error}</li>)}
          </ul>
        )
      });
      return;
    }

    if (finalWarnings.length > 0) {
      Modal.confirm({
        title: '发布校验通过（有警告）',
        content: (
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            {finalWarnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        ),
        okText: '继续发布',
        cancelText: '取消',
        onOk: () => persistShapeToProject(fileName, jsonContent),
      });
      return;
    }

    await persistShapeToProject(fileName, jsonContent);
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
      const rawW = parseFloat(svg.getAttribute('width') || String(vb.w));
      const rawH = parseFloat(svg.getAttribute('height') || String(vb.h));
      queueMicrotask(() => {
        setSvgViewBox(vb);
        setOriginalSize({ w: rawW, h: rawH });
      });
    } catch (error) { console.warn(error); }
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
    } catch { message.error('规整化失败'); }
  };

  const fitAspectRatio = () => {
    const ratio = svgViewBox.h / svgViewBox.w;
    const newH = Math.round(containerSize.w * ratio);
    setContainerSize(prev => ({ ...prev, h: newH }));
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
    let svgX = coords.x;
    let svgY = coords.y;

    if (enableSnap) {
      const relativeX = svgX - svgViewBox.x;
      const relativeY = svgY - svgViewBox.y;
      const snappedRelX = Math.round(relativeX / gridSize) * gridSize;
      const snappedRelY = Math.round(relativeY / gridSize) * gridSize;
      svgX = svgViewBox.x + snappedRelX;
      svgY = svgViewBox.y + snappedRelY;
    }

    setMouseSvgPos({ x: Math.round(svgX * 10) / 10, y: Math.round(svgY * 10) / 10 });

    if (draggingPortId) {
      isDraggingRef.current = true;
      let pctX = ((svgX - svgViewBox.x) / svgViewBox.w) * 100;
      let pctY = ((svgY - svgViewBox.y) / svgViewBox.h) * 100;

      pctX = Math.max(0, Math.min(100, smartRoundPercent(pctX)));
      pctY = Math.max(0, Math.min(100, smartRoundPercent(pctY)));

      setPorts(prev => prev.map(p => {
        if (p.id === draggingPortId) {
          const updated = { ...p, x: pctX, y: pctY };
          form.setFieldsValue({ x: pctX, y: pctY });
          return updated;
        }
        return p;
      }));
    }
  };

  const handlePortMouseDown = (e: React.MouseEvent, portId: string) => {
    e.stopPropagation();
    e.preventDefault();
    isDraggingRef.current = false;
    setDraggingPortId(portId);
    setSelectedPortId(portId);
    const port = ports.find(p => p.id === portId);
    if (port) form.setFieldsValue(port);
  };

  const handleMouseUp = () => {
    setDraggingPortId(null);
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
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      return;
    }
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
    const defaults = getAutoSemantics(nodeType, 'all');

    const newPort: PortConfig = {
      id: `p${ports.length + 1}`, 
      group: 'all', 
      x: pctX, 
      y: pctY,
      desc: '接口', 
      chamber: defaults.chamber, // 自动填入
      phase: defaults.phase,     // 自动填入
      dir: 'bi'
    };
    setPorts([...ports, newPort]);
    setSelectedPortId(newPort.id);
    form.setFieldsValue(newPort);
  };

  const handleFormChange = (changedValues: Record<string, unknown>, allValues: Record<string, unknown>) => {
    if (!selectedPortId) return;
    setPorts(ports.map(p => p.id === selectedPortId ? { ...p, ...allValues } : p));
    if (typeof changedValues.id === 'string' && changedValues.id !== selectedPortId) {
      setSelectedPortId(changedValues.id);
    }
  };

  const handleDeletePort = (id: string) => {
    setPorts(ports.filter(p => p.id !== id));
    if (selectedPortId === id) setSelectedPortId(null);
  };
  // ... (handleDeletePort 函数之后)

  // [新增] 辅助函数：获取自动语义
  const getAutoSemantics = (type: string, group: string) => {
    const rule = AUTO_SEMANTIC_RULES[type];
    if (rule) {
      return rule(group);
    }
    // 默认值
    return { chamber: 'ShellSide', phase: 'Mix' };
  };

  // [修改] 切换类型时，自动刷新所有端口属性
  const handleTypeChange = (value: string) => {
    setNodeType(value);
    const typeInfo = EQUIPMENT_TYPES.find(t => t.value === value);
    if (typeInfo && typeInfo.prefix) {
      setNodeTag(`${typeInfo.prefix}-New`);
    }

    // === 核心逻辑：如果该类型有规则，强制更新现有端口 ===
    if (AUTO_SEMANTIC_RULES[value]) {
      const updatedPorts = ports.map(p => {
        const defaults = getAutoSemantics(value, p.group);
        return { ...p, ...defaults };
      });
      setPorts(updatedPorts);
      
      // 如果当前正选中某个端口，立即更新表单显示
      if (selectedPortId) {
        const currentPort = updatedPorts.find(p => p.id === selectedPortId);
        if (currentPort) form.setFieldsValue(currentPort);
      }
      
      message.info(`已应用 ${value} 的标准语义规则`);
    }
  };

  // ... (generateCode 函数)

 

  const generateCode = () => {
    const baseName = getFileBaseName();
    const varName = `${baseName.replace(/-/g, '')}Svg`;
    const fileName = `${baseName}.svg`;
    const shapeName = `p-${baseName}`;

    const groups = Array.from(new Set(ports.map(p => p.group)));
    const groupsStr = groups.map(g => `        ${g}: { position: 'absolute', attrs: PORT_ATTRS }`).join(',\n');
    // [核心修改] 生成代码包含 chamber 和 phase
    const itemsStr = ports.map(p => 
      `        { id: '${p.id}', group: '${p.group}', args: { x: '${p.x}%', y: '${p.y}%' }, data: { desc: '${p.desc}', chamber: '${p.chamber}', phase: '${p.phase}', dir: '${p.dir}' } as PortData }`
    ).join(',\n');

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
                <li><b>Chamber</b>: 物理腔室 (ShellSide, TubeSide)。</li>
                <li><b>Phase</b>: 物理相态 (Liquid, Vapor)。</li>
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
            
            {/* [修改] 替换原来的 Chamber/Phase Row */}
            <Row gutter={8}>
              <Col span={12}>
                <Form.Item name="chamber" label="物理腔室 (Chamber)">
                  <Select 
                    options={CHAMBER_OPTIONS} 
                    // 如果有规则且不是调节阀(调节阀可能需要微调)，则禁用
                    disabled={!!AUTO_SEMANTIC_RULES[nodeType] && nodeType !== 'ControlValve'} 
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="phase" label="相态 (Phase)">
                  <Select 
                    options={PHASE_OPTIONS} 
                    // 同上
                    disabled={!!AUTO_SEMANTIC_RULES[nodeType] && nodeType !== 'ControlValve'} 
                  />
                </Form.Item>
              </Col>
            </Row>

            {/* [新增] 提示信息 */}
            {!!AUTO_SEMANTIC_RULES[nodeType] && nodeType !== 'ControlValve' && (
               <div style={{ fontSize: 12, color: '#faad14', marginBottom: 12, background: '#fffbe6', padding: '4px 8px', borderRadius: 4 }}>
                 <InfoCircleOutlined /> 此组件语义已锁定为标准值
               </div>
            )}

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
            onMouseLeave={() => { setMouseSvgPos(null); handleMouseUp(); }}
            onMouseUp={handleMouseUp}
          >
            <img src={`data:image/svg+xml;utf8,${encodeURIComponent(svgInput)}`} style={{ width: '100%', height: '100%', display: 'block', pointerEvents: 'none', userSelect: 'none' }} draggable={false} />
            
            {showGrid && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 1, backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.1) 1px, transparent 1px)`, backgroundSize: `${(containerSize.w / originalSize.w) * gridSize * zoom}px ${(containerSize.h / originalSize.h) * gridSize * zoom}px` }} />}
            
            {ports.map(port => (
              <div
                key={port.id}
                className="port-dot"
                onMouseDown={(e) => handlePortMouseDown(e, port.id)}
                onClick={(e) => e.stopPropagation()}
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
                  cursor: 'move',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                  zIndex: 10
                }}
                title={`${port.id}: ${port.desc}`}
              >
                <div style={{ position: 'absolute', top: -20, left: '50%', transform: 'translateX(-50%)', fontSize: 10, background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '0 4px', borderRadius: 2, whiteSpace: 'nowrap', pointerEvents: 'none' }}>
                  {port.id}
                </div>
              </div>
            ))}
          </div>
      </Content>

      <Sider width={400} style={{ background: '#fff', borderLeft: '1px solid #eee', padding: 16 }}>
        <Title level={4}>4. 生成代码</Title>
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 12 }}>
            <Text strong>文件名规则: 固定按类型命名</Text>
            <div style={{ marginTop: 4, fontSize: 12, color: '#666' }}>
              主键格式为 <b>p-{slugifyName(nodeType)}</b>，可选后缀用于区分同类型不同外形。
            </div>
          </div>

          <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center' }}>
            <span style={{ width: 60, display: 'inline-block', color: 'rgba(0, 0, 0, 0.88)' }}>Type:</span>
            <Select value={nodeType} onChange={handleTypeChange} style={{ flex: 1 }} showSearch optionFilterProp="label">
              {EQUIPMENT_TYPES.map(t => <Option key={t.value} value={t.value} label={t.label}>{t.label}</Option>)}
            </Select>
          </div>
          <Input
            addonBefore="Suffix"
            value={nameSuffix}
            onChange={(e) => setNameSuffix(e.target.value)}
            placeholder="可选，例如 tall / hx-a / v2"
            style={{ marginBottom: 8 }}
          />
          <Input addonBefore="Tag" value={nodeTag} onChange={e => setNodeTag(e.target.value)} placeholder="如 R-101" />
          <div style={{ marginTop: 8, fontSize: 12, color: '#1890ff' }}>
            将保存为: <b>p-{getFileBaseName()}.json</b>
          </div>
        </div>
        <TextArea value={generateCode()} autoSize={{ minRows: 15, maxRows: 25 }} style={{ fontFamily: 'monospace', fontSize: 12, background: '#f5f5f5' }} />
        
        <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
          <Button type="primary" icon={<CopyOutlined />} onClick={() => { navigator.clipboard.writeText(generateCode()); message.success('代码已复制'); }} style={{ flex: 1 }}>复制</Button>
          <Button type="primary" icon={<CloudUploadOutlined />} onClick={handlePublishWithValidation} loading={publishing} style={{ flex: 1 }}>发布与校验</Button>
        </div>
      </Sider>
    </Layout>
  );
};

export default ShapeDesigner;
