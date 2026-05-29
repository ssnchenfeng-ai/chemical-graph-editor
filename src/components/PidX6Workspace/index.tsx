import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Dropdown, Input, Select, Space, Tabs, message } from 'antd';
import type { MenuProps } from 'antd';
import { Graph, type Cell, type Edge, type Node } from '@antv/x6';
import { Selection } from '@antv/x6-plugin-selection';
import { Transform } from '@antv/x6-plugin-transform';
import {
  CopyOutlined,
  DeleteOutlined,
  DownOutlined,
  ExportOutlined,
  PlusOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import {
  buildAgentPublishPackage,
  buildEquipmentAgentContext,
  buildStreamAgentContext,
  renderAgentPackageSummaryMarkdown,
  renderCompletenessMarkdown,
  renderEquipmentAgentContextMarkdown,
  renderFlowPathsMarkdown,
  renderStreamAgentContextMarkdown,
  projectToAgentSemanticIR,
} from './agentExports';
import './index.css';

type WorkspaceTab =
  | 'canvas'
  | 'project'
  | 'equipment'
  | 'streams'
  | 'controls'
  | 'narrative'
  | 'llm'
  | 'projectJson'
  | 'semanticIr'
  | 'agentPackage'
  | 'equipmentContext'
  | 'streamContext'
  | 'completeness'
  | 'flowPaths';
type EquipmentType =
  | 'reactor'
  | 'exchanger'
  | 'pump'
  | 'tank'
  | 'filter'
  | 'separator'
  | 'compressor'
  | 'fan'
  | 'mixer'
  | 'heater'
  | 'cooler'
  | 'header'
  | 'column'
  | 'dryer'
  | 'crusher'
  | 'conveyor';
type PartCategory = 'fluid_space' | 'functional_element' | 'measurement_control';
type Phase = '任意' | '混合相' | '液相' | '气相' | '固相' | '信号';
type PortDirection = 'in' | 'out' | 'bi';
type StreamRole = '主物流' | '循环' | '旁路' | '公用工程' | '泄放' | '取样' | '信号';
type FlowDirectionMode = '单向' | '双向' | '正常单向可反向';
type PipeBranchType = '主管段' | '支管' | '汇入' | '分出' | '旁路' | '排净' | '放空';
type PipeEndpointKind = '设备端口' | '管段接点' | '跨图引用' | '界外来源' | '界外去向';
type InlinePipeComponentType =
  | '手动阀'
  | '控制阀'
  | '切断阀'
  | '止回阀'
  | '安全阀'
  | '调节阀'
  | '流量计'
  | '压力测点'
  | '温度测点'
  | '就地压力测点'
  | '远传压力测点'
  | '就地温度测点'
  | '远传温度测点'
  | '分析测点'
  | '过滤器'
  | '爆破片'
  | '盲板'
  | '疏水阀';
type PipeNodeKind = '支管点' | '汇入点' | '分出点' | '变径点' | '取样点' | '排净点' | '在线元件';
type ControlKind = '控制回路' | '联锁保护' | '启停顺序' | '跨设备动作';
type EquipmentGuideStep = 'identity' | 'profile' | 'parts' | 'ports' | 'relations';

interface DrawingSheet {
  id: string;
  name: string;
  description: string;
}

interface ProcessArea {
  id: string;
  name: string;
  objective: string;
  sheets: DrawingSheet[];
}

interface InternalPart {
  id: string;
  category: PartCategory;
  type: string;
  name: string;
  phase: Phase;
  role: string;
}

interface ExternalPort {
  id: string;
  name: string;
  ownerPartId: string;
  direction: PortDirection;
  role: StreamRole;
  medium: string;
  x: number;
  y: number;
}

interface InternalRelation {
  id: string;
  sourcePartId: string;
  relation: string;
  targetPartId: string;
  description: string;
}

interface EquipmentProfile {
  coreFunction: string;
  workingPrinciple: string;
  operatingModes: Array<{ id: string; name: string; condition: string; description: string }>;
  operatingParameters: Array<{ id: string; name: string; measuredPartId: string; normalRange: string; alarmValue: string; description: string }>;
}

interface Equipment {
  id: string;
  sheetId: string;
  areaId: string;
  type: EquipmentType;
  tag: string;
  name: string;
  material: string;
  description: string;
  attributes: Record<string, string>;
  profile: EquipmentProfile;
  parts: InternalPart[];
  ports: ExternalPort[];
  relations: InternalRelation[];
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Stream {
  id: string;
  groupId: string;
  sheetId: string;
  tag: string;
  name: string;
  role: StreamRole;
  branchType: PipeBranchType;
  directionMode: FlowDirectionMode;
  medium: string;
  fromKind: PipeEndpointKind;
  fromEquipmentId: string;
  fromPortId: string;
  fromSegmentId: string;
  fromSegmentRatio: number;
  fromPipeNodeId?: string;
  fromReferenceLabel: string;
  fromReferenceArea: string;
  fromReferenceSheet: string;
  fromReferenceEquipment: string;
  fromReferencePort: string;
  fromReferenceX: number;
  fromReferenceY: number;
  fromContinuationX: number;
  fromContinuationY: number;
  toKind: PipeEndpointKind;
  toEquipmentId: string;
  toPortId: string;
  toSegmentId: string;
  toSegmentRatio: number;
  toPipeNodeId?: string;
  toReferenceLabel: string;
  toReferenceArea: string;
  toReferenceSheet: string;
  toReferenceEquipment: string;
  toReferencePort: string;
  toReferenceX: number;
  toReferenceY: number;
  toContinuationX: number;
  toContinuationY: number;
  manualWaypoints: Point[];
  pieceWaypoints?: Record<string, Point[]>;
  dn: string;
  pn: string;
  material: string;
  intent: string;
}

type CanvasStream = Stream & {
  virtual?: boolean;
  sourceStreamId?: string;
  continuationSide?: 'from' | 'to';
};

interface PipeGroup {
  id: string;
  sheetId: string;
  tag: string;
  name: string;
  role: StreamRole;
  medium: string;
  directionMode: FlowDirectionMode;
  boundaryIn: string;
  boundaryOut: string;
  purpose: string;
  reverseCondition: string;
  notes: string;
}

interface InlinePipeComponent {
  id: string;
  segmentId: string;
  tag: string;
  type: InlinePipeComponentType;
  name: string;
  positionRatio: number;
  order?: number;
  x?: number;
  y?: number;
  normalState: string;
  actuator: string;
  controlSignal: string;
  description: string;
}

interface PipeNode {
  id: string;
  groupId: string;
  segmentId: string;
  kind: PipeNodeKind;
  tag: string;
  name: string;
  positionRatio: number;
  order?: number;
  x?: number;
  y?: number;
  description: string;
  inlineComponentId?: string;
}

interface ControlInterlock {
  id: string;
  kind: ControlKind;
  tag: string;
  scope: string;
  triggerEquipmentId: string;
  triggerPartId: string;
  condition: string;
  actionEquipmentId: string;
  actionTargetId: string;
  action: string;
  purpose: string;
  reset: string;
}

interface ProcessNarrativeItem {
  id: string;
  level: '工段' | '物流' | '控制联锁' | '开停车';
  subject: string;
  generated: string;
  reviewed: string;
}

interface X6CanvasProps {
  project: PidSemanticProject;
  sheetEquipments: Equipment[];
  sheetStreams: CanvasStream[];
  selectedEquipmentId: string;
  selectedStreamId: string;
  getStreamRoute: (stream: Stream) => Point[] | null;
  referenceEndpointText: (stream: Stream, side: 'from' | 'to') => string;
  onSelectEquipment: (id: string) => void;
  onSelectStream: (id: string) => void;
  onOpenEquipment: (id: string) => void;
  onOpenStreams: (id: string) => void;
  onEquipmentMove: (id: string, x: number, y: number) => void;
  onEquipmentResize: (id: string, x: number, y: number, width: number, height: number) => void;
  onReferenceMove: (stream: CanvasStream, side: 'from' | 'to', x: number, y: number) => void;
  onStreamWaypointsChange: (id: string, waypoints: Point[], pieceIndex?: number) => void;
  onInlineComponentMove: (id: string, segmentId: string, ratio: number) => void;
  onPipeNodeMove: (id: string, segmentId: string, ratio: number) => void;
  onStreamEndpointMove: (id: string, side: 'from' | 'to', segmentId: string, ratio: number) => void;
  onEquipmentPortMove: (equipmentId: string, portId: string, x: number, y: number) => void;
  onCreateStreamFromPorts: (fromEquipmentId: string, fromPortId: string, toEquipmentId: string, toPortId: string) => void;
  onCreateInlineComponentAt: (segmentId: string, ratio: number, type: InlinePipeComponentType) => void;
  onCreatePipeNodeAt: (segmentId: string, ratio: number, kind: PipeNodeKind) => void;
  onCreatePipeStreamFromPoint: (params: PipeStreamStartParams) => string | undefined;
  onCreatePipeStreamFromPort: (params: PipeStreamPortStartParams) => string | undefined;
  onCompletePipeStreamEndpoint: (streamId: string, side: 'from' | 'to', target: PipeEndpointSelectionTarget) => void;
  onPatchStream: (id: string, patch: Partial<Stream>) => void;
  onPatchInlineComponent: (id: string, patch: Partial<InlinePipeComponent>) => void;
  onDeleteEquipment: (id: string) => void;
  onDeleteStream: (id: string) => void;
  onDeleteInlineComponent: (id: string) => void;
}

interface PidSemanticProject {
  version: 'pid-layered-semantic/v1';
  pipeModelVersion?: 'centerline-v2' | 'centerline-v3' | 'centerline-v4';
  project: {
    name: string;
    drawingNo: string;
    owner: string;
    designBasis: string;
  };
  currentAreaId: string;
  currentSheetId: string;
  areas: ProcessArea[];
  equipments: Equipment[];
  lineGroups: PipeGroup[];
  streams: Stream[];
  pipeNodes: PipeNode[];
  inlineComponents: InlinePipeComponent[];
  controls: ControlInterlock[];
  narratives: ProcessNarrativeItem[];
}

interface NetworkProjectSummary {
  id: string;
  name: string;
  drawingNo: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

interface NetworkProjectPayload {
  success: boolean;
  message?: string;
  projects?: NetworkProjectSummary[];
  metadata?: NetworkProjectSummary;
  project?: PidSemanticProject;
}

interface AppendProjectResult {
  project: PidSemanticProject;
  firstSheetId: string;
  firstEquipmentId: string;
  firstLineGroupId: string;
  firstStreamId: string;
  firstControlId: string;
  addedSheetCount: number;
  addedEquipmentCount: number;
  addedStreamCount: number;
}

const STORAGE_KEY = 'pid-layered-semantic-project.v1';
const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
const clampPercent = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const snapPercent = (value: number) => Math.max(0, Math.min(100, Math.round(value / 5) * 5));
const snapToGrid = (value: number) => Math.max(0, Math.round(value / 10) * 10);

const EQUIPMENT_OPTIONS: Array<{ value: EquipmentType; label: string; prefix: string }> = [
  { value: 'reactor', label: '反应器', prefix: 'R' },
  { value: 'exchanger', label: '换热器', prefix: 'E' },
  { value: 'pump', label: '泵', prefix: 'P' },
  { value: 'tank', label: '储罐', prefix: 'V' },
  { value: 'filter', label: '过滤器', prefix: 'F' },
  { value: 'separator', label: '分离器', prefix: 'S' },
  { value: 'compressor', label: '压缩机', prefix: 'C' },
  { value: 'fan', label: '风机', prefix: 'B' },
  { value: 'mixer', label: '混合器', prefix: 'M' },
  { value: 'heater', label: '加热器', prefix: 'H' },
  { value: 'cooler', label: '冷却器', prefix: 'C' },
  { value: 'header', label: '母管', prefix: 'HDR' },
  { value: 'column', label: '塔器', prefix: 'T' },
  { value: 'dryer', label: '干燥器', prefix: 'DR' },
  { value: 'crusher', label: '粉碎设备', prefix: 'CR' },
  { value: 'conveyor', label: '输送设备', prefix: 'CV' },
];

const EQUIPMENT_LABELS = Object.fromEntries(EQUIPMENT_OPTIONS.map((item) => [item.value, item.label])) as Record<EquipmentType, string>;
const EQUIPMENT_PREFIXES = Object.fromEntries(EQUIPMENT_OPTIONS.map((item) => [item.value, item.prefix])) as Record<EquipmentType, string>;
const EQUIPMENT_MIN_WIDTH = 70;
const EQUIPMENT_MIN_HEIGHT = 32;
const EQUIPMENT_MAX_WIDTH = 420;
const EQUIPMENT_MAX_HEIGHT = 220;
const HEADER_MAX_WIDTH = EQUIPMENT_MAX_WIDTH * 2;
const PHASES: Phase[] = ['任意', '混合相', '液相', '气相', '固相', '信号'];
const STREAM_ROLES: StreamRole[] = ['主物流', '循环', '旁路', '公用工程', '泄放', '取样', '信号'];
const FLOW_DIRECTION_MODES: FlowDirectionMode[] = ['单向', '双向', '正常单向可反向'];
const PIPE_BRANCH_TYPES: PipeBranchType[] = ['主管段', '支管', '汇入', '分出', '旁路', '排净', '放空'];
const PIPE_ENDPOINT_KINDS: PipeEndpointKind[] = ['设备端口', '管段接点', '跨图引用', '界外来源', '界外去向'];
const PIPE_FROM_ENDPOINT_KINDS: PipeEndpointKind[] = PIPE_ENDPOINT_KINDS.filter((kind) => kind !== '界外去向');
const PIPE_TO_ENDPOINT_KINDS: PipeEndpointKind[] = PIPE_ENDPOINT_KINDS.filter((kind) => kind !== '界外来源');
const INLINE_COMPONENT_TYPES: InlinePipeComponentType[] = ['手动阀', '控制阀', '切断阀', '止回阀', '安全阀', '调节阀', '流量计', '就地压力测点', '远传压力测点', '就地温度测点', '远传温度测点', '分析测点', '过滤器', '爆破片', '盲板', '疏水阀'];
const INLINE_COMPONENT_STATES = ['常开', '常闭', '调节', '止回', '备用', '旁路', '锁开', '锁关'];
const PIPE_NODE_KINDS: PipeNodeKind[] = ['支管点', '汇入点', '分出点', '变径点', '取样点', '排净点'];
const CONTROL_KINDS: ControlKind[] = ['控制回路', '联锁保护', '启停顺序', '跨设备动作'];
const EQUIPMENT_GUIDE_STEPS: Array<{ key: EquipmentGuideStep; title: string; hint: string }> = [
  { key: 'identity', title: '1 设备身份', hint: '确认设备类型、位号、名称、工段归属和边界描述。' },
  { key: 'profile', title: '2 功能与原理', hint: '补充该设备为什么存在、如何工作，供 LLM 理解设备画像。' },
  { key: 'parts', title: '3 内部组成', hint: '描述流体空间、功能元件和测控元件。' },
  { key: 'ports', title: '4 对外连接桩', hint: '定义设备与外部管线连接的端口和介质。' },
  { key: 'relations', title: '5 内部关系', hint: '建立内部组成之间的流动、热接触、测量和控制关系。' },
];
const PART_CATEGORIES: Array<{ value: PartCategory; label: string }> = [
  { value: 'fluid_space', label: '流体空间' },
  { value: 'functional_element', label: '功能元件' },
  { value: 'measurement_control', label: '测控元件' },
];
const PART_TYPES: Record<PartCategory, string[]> = {
  fluid_space: ['封头', '壳程', '管程', '管箱', '气相空间', '液相空间', '泵腔', '混合腔', '塔顶空间', '塔釜空间', '输送腔'],
  functional_element: ['催化剂床层', '分布器', '收集器', '换热壁面', '过滤元件', '填料', '搅拌器', '加热元件', '冷却元件', '驱动单元', '塔板', '破碎元件', '输送元件', '截流装置'],
  measurement_control: ['就地温度测点', '远传温度测点', '就地压力测点', '远传压力测点', '液位测点', '流量测点', '分析测点', '执行机构'],
};
const RELATIONS = ['供给/流入', '排出', '连通', '热接触', '相接触', '测量', '控制', '驱动'];
const MATERIALS = ['CS', 'SS304', 'SS316', 'FRP', 'PTFE', 'PVC'];
const PORT_DIRECTION_LABELS: Record<ExternalPort['direction'], string> = {
  in: '入口',
  out: '出口',
  bi: '双向',
};

const option = (value: string, label = value) => ({ value, label });
const streamDisplayLabel = (stream: Pick<Stream, 'tag' | 'name' | 'branchType'>) => (
  [stream.tag, stream.name || stream.branchType].filter(Boolean).join(' ')
);
const equipmentWidthLimit = (type: EquipmentType) => (type === 'header' ? HEADER_MAX_WIDTH : EQUIPMENT_MAX_WIDTH);
const normalizeInlineComponentType = (type: string): InlinePipeComponentType => {
  if (type === '压力测点') return '远传压力测点';
  if (type === '温度测点') return '远传温度测点';
  return INLINE_COMPONENT_TYPES.includes(type as InlinePipeComponentType) ? type as InlinePipeComponentType : '手动阀';
};
const isMeasurementInlineType = (type: InlinePipeComponentType) => (
  type === '流量计'
  || type === '压力测点'
  || type === '温度测点'
  || type === '就地压力测点'
  || type === '远传压力测点'
  || type === '就地温度测点'
  || type === '远传温度测点'
  || type === '分析测点'
);
const inlineNormalState = (component: InlinePipeComponent) => (
  isMeasurementInlineType(component.type) ? '' : component.normalState
);
const inlineActuator = (component: InlinePipeComponent) => (
  isMeasurementInlineType(component.type) ? '' : component.actuator
);
const defaultInlineActuator = (type: InlinePipeComponentType) => {
  if (type === '控制阀' || type === '调节阀') return '执行机构';
  if (type === '手动阀') return '手轮';
  return '';
};
const inlineComponentTypePatch = (component: InlinePipeComponent, type: InlinePipeComponentType): Partial<InlinePipeComponent> => {
  const measurement = isMeasurementInlineType(type);
  const useTypeName = !component.name || component.name === component.type || component.name === '压力测点' || component.name === '温度测点';
  return {
    type,
    name: useTypeName ? type : component.name,
    normalState: measurement ? '' : component.normalState || '常开',
    actuator: measurement ? '' : component.actuator || defaultInlineActuator(type),
  };
};
const partLabel = (equipment: Pick<Equipment, 'parts'> | undefined, partId: string) => equipment?.parts.find((part) => part.id === partId)?.name || partId || '-';
const portLabel = (equipment: Pick<Equipment, 'ports'> | undefined, portId: string) => equipment?.ports.find((port) => port.id === portId)?.name || portId || '-';

const isReferenceEndpoint = (kind: PipeEndpointKind) => kind === '跨图引用' || kind === '界外来源' || kind === '界外去向';
const referenceTypeLabels = new Set(['界外来源', '界外去向', '跨图引用', '来自界外', '去往界外']);
const referenceDisplayName = (label: string) => (referenceTypeLabels.has(label.trim()) ? '' : label);
const referencePlaceholder = (kind: PipeEndpointKind, side: 'from' | 'to') => {
  if (kind === '界外来源') return '原料总管 / 蒸汽总管 / 上游装置';
  if (kind === '界外去向') return '下游装置 / 外排系统 / 公用工程总管';
  return side === 'from' ? '其他图纸设备或连接桩' : '其他图纸设备或连接桩';
};

type Point = { x: number; y: number };
type Rect = { x: number; y: number; width: number; height: number };
type RenderPipeNode = PipeNode & {
  source: 'semantic' | 'inline' | 'endpoint';
  streamId?: string;
  side?: 'from' | 'to';
  blockedStreamIds?: string[];
  inlineType?: InlinePipeComponentType;
};
type CanvasPipeRoute = {
  stream: CanvasStream;
  route: Point[];
};
type PipeContextMenuState = {
  x: number;
  y: number;
  streamId: string;
  streamTag: string;
  ratio: number;
  point: Point;
};
type PortContextMenuState = {
  x: number;
  y: number;
  equipmentId: string;
  equipmentTag: string;
  portId: string;
  point: Point;
};
type PortTooltipState = {
  x: number;
  y: number;
  equipmentTag: string;
  portId: string;
  portName: string;
  direction: ExternalPort['direction'];
  role: StreamRole;
  medium: string;
};
type StreamTooltipState = {
  x: number;
  y: number;
  tag: string;
  name: string;
  branchType: PipeBranchType;
  role: StreamRole;
  medium: string;
  directionMode: FlowDirectionMode;
  dn: string;
  pn: string;
  material: string;
  intent: string;
};
type DeviceContextMenuState = {
  x: number;
  y: number;
  equipmentId: string;
  equipmentTag: string;
};
type InlineComponentContextMenuState = {
  x: number;
  y: number;
  componentId: string;
  componentTag: string;
};
type PipeEditPanelState = {
  x: number;
  y: number;
  streamId: string;
};
type ReferenceEndpointEditPanelState = {
  x: number;
  y: number;
  streamId: string;
  renderedStreamId: string;
  side: 'from' | 'to';
  renderedSide: 'from' | 'to';
};
type InlineComponentEditPanelState = {
  x: number;
  y: number;
  componentId: string;
};
type PendingPipeEndpointState = {
  streamId: string;
  side: 'from' | 'to';
  label: string;
};
type PipeEndpointSelectionTarget =
  | { kind: '设备端口'; equipmentId: string; portId: string }
  | { kind: '管段接点'; segmentId: string; ratio: number }
  | { kind: '界外来源' | '界外去向'; x: number; y: number };
type PipeStreamStartParams = {
  segmentId: string;
  ratio: number;
  point: Point;
  branchType: PipeBranchType;
  attachSide: 'from' | 'to';
};
type PipeStreamPortStartParams = {
  equipmentId: string;
  portId: string;
  point: Point;
  branchType: PipeBranchType;
  attachSide: 'from' | 'to';
};
type PipeTopologyItem = {
  key: string;
  segmentId: string;
  tag: string;
  kind: string;
  order?: number;
  positionRatio?: number;
};

const pipeNodeGraphId = (nodeId: string) => `pipe-node:${nodeId}`;
const streamMatchesId = (stream: CanvasStream, streamId: string) => stream.id === streamId || stream.sourceStreamId === streamId;
const INLINE_COMPONENT_TYPE_CODE: Record<InlinePipeComponentType, string> = {
  手动阀: 'HV',
  控制阀: 'CV',
  切断阀: 'XV',
  止回阀: 'NRV',
  安全阀: 'PSV',
  调节阀: 'CV',
  流量计: 'FI',
  压力测点: 'PI',
  温度测点: 'TI',
  就地压力测点: 'PG',
  远传压力测点: 'PI',
  就地温度测点: 'TG',
  远传温度测点: 'TI',
  分析测点: 'AI',
  过滤器: 'FLT',
  爆破片: 'BD',
  盲板: 'BL',
  疏水阀: 'ST',
};
type InlineComponentVisual = {
  shape: string;
  size: { width: number; height: number };
  routeAnchor: Point;
  markup?: Array<{ tagName: string; selector: string }>;
  attrs: Record<string, unknown>;
};
const inlineSymbolRotatesWithPipe = (type: InlinePipeComponentType) => (
  Boolean(type)
);
const rotateQuarterTurn = (point: Point, center: Point): Point => ({
  x: center.x - (point.y - center.y),
  y: center.y + (point.x - center.x),
});
const inlineTextAttrsAtPoint = (value: unknown, point: Point, size: { width: number; height: number }) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const attrs = Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([key]) => (
    key !== 'refX' && key !== 'refY' && key !== 'x' && key !== 'y' && key !== 'transform'
  )));
  return {
    ...attrs,
    refX: `${point.x / size.width * 100}%`,
    refY: `${point.y / size.height * 100}%`,
  };
};
const orientInlineComponentVisual = (
  visual: InlineComponentVisual,
  type: InlinePipeComponentType,
  axis?: 'horizontal' | 'vertical',
): InlineComponentVisual => {
  if (axis !== 'vertical' || !inlineSymbolRotatesWithPipe(type)) return visual;
  const rotate = `rotate(90 ${visual.routeAnchor.x} ${visual.routeAnchor.y})`;
  if (isMeasurementInlineType(type)) {
    const meter = visual.attrs.meter as Record<string, unknown> | undefined;
    const meterCenter = rotateQuarterTurn({
      x: Number(meter?.cx ?? visual.routeAnchor.x),
      y: Number(meter?.cy ?? visual.routeAnchor.y),
    }, visual.routeAnchor);
    const labelPoint = { x: meterCenter.x, y: meterCenter.y + (type === '流量计' ? 18 : 17) };
    const attrs = Object.fromEntries(Object.entries(visual.attrs).map(([selector, value]) => {
      if (selector === 'body') return [selector, value];
      if (selector === 'code') return [selector, inlineTextAttrsAtPoint(value, meterCenter, visual.size)];
      if (selector === 'label') return [selector, inlineTextAttrsAtPoint(value, labelPoint, visual.size)];
      if (!value || typeof value !== 'object' || Array.isArray(value)) return [selector, value];
      return [selector, { ...value, transform: rotate }];
    }));
    return { ...visual, attrs };
  }
  const fixedSelectors = new Set(['body', 'label', 'code', 'meter']);
  const attrs = Object.fromEntries(Object.entries(visual.attrs).map(([selector, value]) => {
    if (fixedSelectors.has(selector) || !value || typeof value !== 'object' || Array.isArray(value)) return [selector, value];
    return [selector, { ...value, transform: rotate }];
  }));
  return { ...visual, attrs };
};
const inlineComponentVisual = (type: InlinePipeComponentType, tag: string) => {
  const code = INLINE_COMPONENT_TYPE_CODE[type] || 'IN';
  const commonBody = {
    fill: 'transparent',
    stroke: 'transparent',
    refWidth: '100%',
    refHeight: '100%',
  };
  const tagLabel = (fill = '#0f172a', refY = '84%') => ({
    text: tag,
    fontSize: 9,
    fontWeight: 800,
    textAnchor: 'middle',
    textVerticalAnchor: 'middle',
    refX: '50%',
    refY,
    fill,
  });
  const codeLabel = (fill = '#0f172a', refY = '50%') => ({
    text: code,
    fontSize: 9,
    fontWeight: 800,
    textAnchor: 'middle',
    textVerticalAnchor: 'middle',
    refX: '50%',
    refY,
    fill,
  });
  const valveSymbol = (stroke: string, centerY: number, fill = '#ffffff') => ({
    d: `M 8 ${centerY - 9} L 28 ${centerY} L 8 ${centerY + 9} Z M 48 ${centerY - 9} L 28 ${centerY} L 48 ${centerY + 9} Z`,
    fill,
    stroke,
    strokeWidth: 1.8,
    strokeLinejoin: 'miter',
    strokeLinecap: 'square',
  });
  const valveVisual = (
    stroke: string,
    labelFill = stroke,
    extraMarkup: Array<{ tagName: string; selector: string }> = [],
    extraAttrs: Record<string, unknown> = {},
    size = { width: 56, height: 40 },
    routeAnchor = { x: 28, y: 18 },
  ): InlineComponentVisual => ({
    shape: 'rect',
    size,
    routeAnchor,
    markup: [
      { tagName: 'rect', selector: 'body' },
      { tagName: 'path', selector: 'symbol' },
      ...extraMarkup,
      { tagName: 'text', selector: 'label' },
    ],
    attrs: {
      body: commonBody,
      symbol: valveSymbol(stroke, routeAnchor.y),
      label: tagLabel(labelFill, '88%'),
      ...extraAttrs,
    },
  });
  if (type === '流量计') {
    return {
      shape: 'rect',
      size: { width: 44, height: 42 },
      routeAnchor: { x: 22, y: 18 },
      markup: [
        { tagName: 'rect', selector: 'body' },
        { tagName: 'circle', selector: 'meter' },
        { tagName: 'text', selector: 'code' },
        { tagName: 'text', selector: 'label' },
      ],
      attrs: {
        body: commonBody,
        meter: { cx: 22, cy: 18, r: 12, fill: '#ffffff', stroke: '#0891b2', strokeWidth: 1.7 },
        code: codeLabel('#155e75', '43%'),
        label: tagLabel('#155e75', '86%'),
      },
    } satisfies InlineComponentVisual;
  }
  if (
    type === '压力测点'
    || type === '温度测点'
    || type === '就地压力测点'
    || type === '远传压力测点'
    || type === '就地温度测点'
    || type === '远传温度测点'
    || type === '分析测点'
  ) {
    return {
      shape: 'rect',
      size: { width: 46, height: 48 },
      routeAnchor: { x: 23, y: 26 },
      markup: [
        { tagName: 'rect', selector: 'body' },
        { tagName: 'line', selector: 'tap' },
        { tagName: 'circle', selector: 'meter' },
        { tagName: 'text', selector: 'code' },
        { tagName: 'text', selector: 'label' },
      ],
      attrs: {
        body: commonBody,
        tap: { x1: 23, y1: 26, x2: 23, y2: 16, stroke: '#7c3aed', strokeWidth: 1.6 },
        meter: { cx: 23, cy: 12, r: 10, fill: '#ffffff', stroke: '#7c3aed', strokeWidth: 1.7 },
        code: codeLabel('#5b21b6', '25%'),
        label: tagLabel('#5b21b6', '88%'),
      },
    } satisfies InlineComponentVisual;
  }
  if (type === '爆破片') {
    return {
      shape: 'rect',
      size: { width: 54, height: 40 },
      routeAnchor: { x: 27, y: 18 },
      markup: [
        { tagName: 'rect', selector: 'body' },
        { tagName: 'line', selector: 'pipeBreakMask' },
        { tagName: 'line', selector: 'pipeLeft' },
        { tagName: 'line', selector: 'pipeRight' },
        { tagName: 'path', selector: 'diskLeft' },
        { tagName: 'path', selector: 'diskRight' },
        { tagName: 'line', selector: 'slash' },
        { tagName: 'text', selector: 'label' },
      ],
      attrs: {
        body: commonBody,
        pipeBreakMask: { x1: 16, y1: 18, x2: 38, y2: 18, stroke: '#ffffff', strokeWidth: 7, strokeLinecap: 'round' },
        pipeLeft: { x1: 5, y1: 18, x2: 18, y2: 18, stroke: '#be123c', strokeWidth: 1.8, strokeLinecap: 'round' },
        pipeRight: { x1: 36, y1: 18, x2: 49, y2: 18, stroke: '#be123c', strokeWidth: 1.8, strokeLinecap: 'round' },
        diskLeft: { d: 'M 22 8 C 17 13 17 23 22 28', fill: 'none', stroke: '#be123c', strokeWidth: 1.8, strokeLinecap: 'round' },
        diskRight: { d: 'M 32 8 C 37 13 37 23 32 28', fill: 'none', stroke: '#be123c', strokeWidth: 1.8, strokeLinecap: 'round' },
        slash: { x1: 20, y1: 27, x2: 34, y2: 9, stroke: '#be123c', strokeWidth: 1.4, strokeLinecap: 'round' },
        label: tagLabel('#9f1239', '88%'),
      },
    } satisfies InlineComponentVisual;
  }
  if (type === '控制阀' || type === '调节阀') {
    return valveVisual(
      '#4f46e5',
      '#3730a3',
      [
        { tagName: 'line', selector: 'stem' },
        { tagName: 'circle', selector: 'actuator' },
      ],
      {
        stem: { x1: 28, y1: 12, x2: 28, y2: 19, stroke: '#4f46e5', strokeWidth: 1.7 },
        actuator: { cx: 28, cy: 8, r: 6, fill: '#ffffff', stroke: '#4f46e5', strokeWidth: 1.7 },
        label: tagLabel('#3730a3', '91%'),
      },
      { width: 56, height: 54 },
      { x: 28, y: 28 },
    );
  }
  if (type === '止回阀') {
    return {
      shape: 'rect',
      size: { width: 56, height: 40 },
      routeAnchor: { x: 28, y: 18 },
      markup: [
        { tagName: 'rect', selector: 'body' },
        { tagName: 'path', selector: 'symbol' },
        { tagName: 'line', selector: 'seat' },
        { tagName: 'text', selector: 'label' },
      ],
      attrs: {
        body: commonBody,
        symbol: {
          d: 'M 8 9 L 32 18 L 8 27 Z',
          fill: '#ffffff',
          stroke: '#ea580c',
          strokeWidth: 1.8,
          strokeLinejoin: 'miter',
          strokeLinecap: 'square',
        },
        seat: { x1: 36, y1: 9, x2: 36, y2: 27, stroke: '#ea580c', strokeWidth: 1.8 },
        label: tagLabel('#c2410c', '88%'),
      },
    } satisfies InlineComponentVisual;
  }
  if (type === '安全阀') {
    return {
      shape: 'rect',
      size: { width: 56, height: 54 },
      routeAnchor: { x: 28, y: 31 },
      markup: [
        { tagName: 'rect', selector: 'body' },
        { tagName: 'path', selector: 'symbol' },
        { tagName: 'path', selector: 'spring' },
        { tagName: 'text', selector: 'label' },
      ],
      attrs: {
        body: commonBody,
        symbol: {
          d: 'M 9 22 L 28 31 L 9 40 Z M 47 22 L 28 31 L 47 40 Z M 28 31 L 28 13',
          fill: '#ffffff',
          stroke: '#dc2626',
          strokeWidth: 1.8,
          strokeLinejoin: 'miter',
          strokeLinecap: 'square',
        },
        spring: {
          d: 'M 18 13 C 20 8 22 18 24 13 C 26 8 28 18 30 13 C 32 8 34 18 36 13 C 38 8 40 18 42 13',
          fill: 'none',
          stroke: '#dc2626',
          strokeWidth: 1.2,
          strokeLinecap: 'round',
        },
        label: tagLabel('#991b1b', '90%'),
      },
    } satisfies InlineComponentVisual;
  }
  if (type === '切断阀') {
    return valveVisual(
      '#dc2626',
      '#991b1b',
      [{ tagName: 'line', selector: 'stem' }],
      {
        stem: { x1: 28, y1: 4, x2: 28, y2: 18, stroke: '#dc2626', strokeWidth: 1.7 },
      },
    );
  }
  if (type === '过滤器') {
    return {
      shape: 'rect',
      size: { width: 54, height: 40 },
      routeAnchor: { x: 27, y: 18 },
      markup: [
        { tagName: 'rect', selector: 'body' },
        { tagName: 'path', selector: 'symbol' },
        { tagName: 'path', selector: 'hatch' },
        { tagName: 'text', selector: 'label' },
      ],
      attrs: {
        body: commonBody,
        symbol: {
          d: 'M 7 18 L 27 7 L 47 18 L 27 29 Z',
          fill: '#ffffff',
          stroke: '#16a34a',
          strokeWidth: 1.7,
          strokeLinejoin: 'miter',
          strokeLinecap: 'square',
        },
        hatch: { d: 'M 17 12 L 31 26 M 24 10 L 38 24', stroke: '#16a34a', strokeWidth: 1.1, strokeLinecap: 'round' },
        label: tagLabel('#166534', '88%'),
      },
    } satisfies InlineComponentVisual;
  }
  if (type === '盲板') {
    return {
      shape: 'rect',
      size: { width: 44, height: 34 },
      routeAnchor: { x: 22, y: 16 },
      markup: [
        { tagName: 'rect', selector: 'body' },
        { tagName: 'line', selector: 'plateLeft' },
        { tagName: 'line', selector: 'plateRight' },
        { tagName: 'line', selector: 'centerLine' },
        { tagName: 'text', selector: 'label' },
      ],
      attrs: {
        body: commonBody,
        plateLeft: { x1: 18, y1: 7, x2: 18, y2: 25, stroke: '#475569', strokeWidth: 2 },
        plateRight: { x1: 26, y1: 7, x2: 26, y2: 25, stroke: '#475569', strokeWidth: 2 },
        centerLine: { x1: 6, y1: 16, x2: 38, y2: 16, stroke: '#475569', strokeWidth: 1.4, strokeDasharray: '3 2' },
        label: tagLabel('#334155', '87%'),
      },
    } satisfies InlineComponentVisual;
  }
  if (type === '疏水阀') {
    return {
      shape: 'rect',
      size: { width: 52, height: 40 },
      routeAnchor: { x: 26, y: 18 },
      markup: [
        { tagName: 'rect', selector: 'body' },
        { tagName: 'path', selector: 'symbol' },
        { tagName: 'text', selector: 'label' },
      ],
      attrs: {
        body: commonBody,
        symbol: {
          d: 'M 8 18 L 44 18 M 16 8 L 36 8 L 32 28 L 20 28 Z M 20 28 L 17 31 M 32 28 L 35 31',
          fill: '#ffffff',
          stroke: '#16a34a',
          strokeWidth: 1.6,
          strokeLinejoin: 'miter',
          strokeLinecap: 'square',
        },
        label: tagLabel('#166534', '88%'),
      },
    } satisfies InlineComponentVisual;
  }
  return valveVisual('#ea580c', '#c2410c');
};
const addPipeEdgeTools = (edge: Edge) => {
  edge.removeTools();
  edge.addTools([
    {
      name: 'vertices',
      args: {
        addable: false,
        removable: true,
        removeRedundancies: true,
        snapRadius: 12,
        stopPropagation: true,
        attrs: { fill: '#1677ff', stroke: '#1677ff', 'stroke-width': 1, r: 3 },
      },
    },
  ]);
};

const endpointPipeNodeKind = (stream: Stream, side: 'from' | 'to'): PipeNodeKind => {
  if (stream.branchType === '汇入') return '汇入点';
  if (stream.branchType === '分出' || stream.branchType === '支管' || stream.branchType === '旁路') return side === 'from' ? '分出点' : '汇入点';
  return side === 'from' ? '分出点' : '汇入点';
};

const endpointPipeNodeId = (stream: Stream, side: 'from' | 'to') => (
  side === 'from' ? stream.fromPipeNodeId : stream.toPipeNodeId
);

const topologyOrderValue = (item: { order?: number; positionRatio?: number; tag?: string }) => (
  typeof item.order === 'number' ? item.order : typeof item.positionRatio === 'number' ? item.positionRatio : 50
);
const topologyRouteRatio = (item: { order?: number; positionRatio?: number; tag?: string }) => clampPercent(topologyOrderValue(item));
const sortTopologyItems = <T extends { order?: number; positionRatio?: number; tag?: string }>(items: T[]) => (
  [...items].sort((left, right) => (
    topologyOrderValue(left) - topologyOrderValue(right)
    || (left.tag || '').localeCompare(right.tag || '')
  ))
);
const topologyAutoRatio = <T extends { id?: string; key?: string; order?: number; positionRatio?: number; tag?: string }>(item: T, siblings: T[]) => {
  if (typeof item.order === 'number' || typeof item.positionRatio === 'number') return topologyRouteRatio(item);
  const ordered = sortTopologyItems(siblings);
  const index = Math.max(0, ordered.findIndex((candidate) => (
    (item.id && candidate.id === item.id) || (item.key && candidate.key === item.key)
  )));
  return clampPercent((index + 1) * 100 / (ordered.length + 1));
};
const topologyPreviousLabel = (item: PipeTopologyItem, siblings: PipeTopologyItem[]) => {
  const ordered = sortTopologyItems(siblings);
  const index = ordered.findIndex((candidate) => candidate.key === item.key);
  const previous = index > 0 ? ordered[index - 1] : null;
  return previous ? `在 ${previous.tag} ${previous.kind} 之后` : '在管段起点之后';
};

const buildRenderPipeNodes = (project: PidSemanticProject, streams: CanvasStream[]): RenderPipeNode[] => {
  const streamById = new Map(streams.map((stream) => [stream.id, stream]));
  const streamIdsByEndpointNodeId = new Map<string, string[]>();
  streams.forEach((stream) => {
    (['from', 'to'] as const).forEach((side) => {
      const kind = side === 'from' ? stream.fromKind : stream.toKind;
      if (kind !== '管段接点') return;
      const nodeId = endpointPipeNodeId(stream, side);
      if (!nodeId) return;
      streamIdsByEndpointNodeId.set(nodeId, [
        ...(streamIdsByEndpointNodeId.get(nodeId) || []),
        stream.sourceStreamId || stream.id,
      ]);
    });
  });
  const semanticNodeIds = new Set(project.pipeNodes.map((node) => node.id));
  const nodes: RenderPipeNode[] = project.pipeNodes
    .filter((node) => streamById.has(node.segmentId))
    .map((node) => {
      const blockedStreamIds = Array.from(new Set(streamIdsByEndpointNodeId.get(node.id) || []));
      return {
        ...node,
        source: 'semantic',
        streamId: blockedStreamIds[0],
        blockedStreamIds,
      };
    });

  project.inlineComponents.forEach((component) => {
    const segment = streamById.get(component.segmentId);
    if (!segment) return;
    nodes.push({
      id: `inline:${component.id}`,
      groupId: segment.groupId,
      segmentId: segment.id,
      kind: '在线元件',
      tag: component.tag,
      name: component.name || component.type,
      positionRatio: component.positionRatio,
      order: component.order,
      x: component.x,
      y: component.y,
      description: component.description,
      inlineComponentId: component.id,
      inlineType: component.type,
      source: 'inline',
    });
  });

  streams.forEach((stream) => {
    (['from', 'to'] as const).forEach((side) => {
      const kind = side === 'from' ? stream.fromKind : stream.toKind;
      if (kind !== '管段接点') return;
      const pipeNodeId = endpointPipeNodeId(stream, side);
      if (pipeNodeId && semanticNodeIds.has(pipeNodeId)) return;
      const segmentId = side === 'from' ? stream.fromSegmentId : stream.toSegmentId;
      if (!streamById.has(segmentId)) return;
      const ratio = side === 'from' ? stream.fromSegmentRatio : stream.toSegmentRatio;
      const x = side === 'from' ? stream.fromContinuationX : stream.toContinuationX;
      const y = side === 'from' ? stream.fromContinuationY : stream.toContinuationY;
      const nodeKind = endpointPipeNodeKind(stream, side);
      nodes.push({
        id: `endpoint:${stream.id}:${side}`,
        groupId: stream.groupId,
        segmentId,
        kind: nodeKind,
        tag: nodeKind,
        name: `${stream.tag}${side === 'from' ? '起点' : '终点'}`,
        positionRatio: ratio,
        order: ratio,
        x: x || undefined,
        y: y || undefined,
        description: '由管段端点引用生成的拓扑节点。',
        source: 'endpoint',
        streamId: stream.sourceStreamId || stream.id,
        blockedStreamIds: [stream.sourceStreamId || stream.id],
        side,
      });
    });
  });

  return nodes;
};

const dedupePoints = (points: Point[]) => points.filter((point, index) => index === 0 || point.x !== points[index - 1].x || point.y !== points[index - 1].y);
const compactRoutePoints = (points: Point[]) => {
  const deduped = dedupePoints(points);
  return deduped.filter((point, index) => {
    const prev = deduped[index - 1];
    const next = deduped[index + 1];
    if (!prev || !next) return true;
    return !((prev.x === point.x && point.x === next.x) || (prev.y === point.y && point.y === next.y));
  });
};
const compactRouteInteriorPoints = (points: Point[], start?: Point, end?: Point) => {
  const route = compactRoutePoints([
    ...(start ? [start] : []),
    ...points,
    ...(end ? [end] : []),
  ]);
  return route.slice(start ? 1 : 0, end ? -1 : undefined);
};

const orthogonalizePoints = (points: Point[]) => {
  const route: Point[] = [];
  points.forEach((point) => {
    const previous = route[route.length - 1];
    if (previous && previous.x !== point.x && previous.y !== point.y) {
      route.push({ x: point.x, y: previous.y });
    }
    route.push(point);
  });
  return dedupePoints(route);
};

const portSide = (port: ExternalPort) => {
  const distances = [
    { side: 'left', value: port.x },
    { side: 'right', value: 100 - port.x },
    { side: 'top', value: port.y },
    { side: 'bottom', value: 100 - port.y },
  ];
  return distances.sort((a, b) => a.value - b.value)[0].side as 'left' | 'right' | 'top' | 'bottom';
};

const portPoint = (equipment: Equipment, port: ExternalPort): Point => ({
  x: equipment.x + equipment.width * port.x / 100,
  y: equipment.y + equipment.height * port.y / 100,
});

const portExitPoint = (equipment: Equipment, port: ExternalPort, offset = 12): Point => {
  const anchor = portPoint(equipment, port);
  const side = portSide(port);
  if (side === 'left') return { x: anchor.x - offset, y: anchor.y };
  if (side === 'right') return { x: anchor.x + offset, y: anchor.y };
  if (side === 'top') return { x: anchor.x, y: anchor.y - offset };
  return { x: anchor.x, y: anchor.y + offset };
};

const expandedRect = (equipment: Equipment, padding = 8): Rect => ({
  x: equipment.x - padding,
  y: equipment.y - padding,
  width: equipment.width + padding * 2,
  height: equipment.height + padding * 2,
});

const segmentHitsRect = (a: Point, b: Point, rect: Rect) => {
  if (a.x === b.x) {
    const minY = Math.min(a.y, b.y);
    const maxY = Math.max(a.y, b.y);
    return a.x >= rect.x && a.x <= rect.x + rect.width && maxY >= rect.y && minY <= rect.y + rect.height;
  }
  if (a.y === b.y) {
    const minX = Math.min(a.x, b.x);
    const maxX = Math.max(a.x, b.x);
    return a.y >= rect.y && a.y <= rect.y + rect.height && maxX >= rect.x && minX <= rect.x + rect.width;
  }
  return false;
};

const equipmentCoreRect = (equipment: Equipment, inset = 6): Rect => ({
  x: equipment.x + inset,
  y: equipment.y + inset,
  width: Math.max(0, equipment.width - inset * 2),
  height: Math.max(0, equipment.height - inset * 2),
});

const segmentHitsEquipmentCore = (a: Point, b: Point, equipments: Equipment[]) => (
  equipments.some((equipment) => segmentHitsRect(a, b, equipmentCoreRect(equipment)))
);

const STREAM_MEDIUM_COLORS = ['#0f766e', '#b45309', '#7c3aed', '#0891b2', '#be123c', '#1d4ed8', '#ca8a04', '#15803d'];
const stringHash = (input: string) => Array.from(input).reduce((hash, char) => ((hash * 31) + char.charCodeAt(0)) >>> 0, 7);
const streamLineColor = (stream: Pick<Stream, 'medium' | 'role' | 'branchType'>) => {
  const medium = (stream.medium || '').trim();
  const key = medium || stream.role || stream.branchType || '管线';
  if (stream.role === '信号') return '#64748b';
  if (stream.branchType === '放空' || medium.includes('放空')) return '#dc2626';
  if (medium.includes('导热油') || medium.includes('热油')) return '#b45309';
  if (medium.includes('蒸汽')) return '#7c3aed';
  if (medium.includes('水')) return '#0891b2';
  if (medium.includes('空气') || medium.includes('氮') || medium.includes('气')) return '#64748b';
  if (medium.includes('萘')) return '#0f766e';
  return STREAM_MEDIUM_COLORS[stringHash(key) % STREAM_MEDIUM_COLORS.length];
};

const routeLength = (points: Point[]) => points.slice(1).reduce((sum, point, index) => (
  sum + Math.abs(point.x - points[index].x) + Math.abs(point.y - points[index].y)
), 0);

const routeIsClearOfEquipment = (points: Point[], equipments: Equipment[]) => (
  points.slice(1).every((point, index) => !segmentHitsEquipmentCore(points[index], point, equipments))
);

const candidateRouteReplacements = (start: Point, end: Point) => {
  const midX = Math.round((start.x + end.x) / 20) * 10;
  const midY = Math.round((start.y + end.y) / 20) * 10;
  const candidates: Point[][] = [];
  if (start.x === end.x || start.y === end.y) candidates.push([start, end]);
  candidates.push([start, { x: end.x, y: start.y }, end]);
  candidates.push([start, { x: start.x, y: end.y }, end]);
  candidates.push([start, { x: midX, y: start.y }, { x: midX, y: end.y }, end]);
  candidates.push([start, { x: start.x, y: midY }, { x: end.x, y: midY }, end]);
  return candidates.map((points) => compactRoutePoints(points));
};

const simplifyOrthogonalRoute = (points: Point[], equipments: Equipment[] = []) => {
  let route = compactRoutePoints(orthogonalizePoints(points));
  for (let pass = 0; pass < 18; pass += 1) {
    let best: { startIndex: number; endIndex: number; replacement: Point[]; saving: number } | null = null;
    for (let startIndex = 0; startIndex < route.length - 3; startIndex += 1) {
      for (let endIndex = route.length - 1; endIndex >= startIndex + 3; endIndex -= 1) {
        const current = route.slice(startIndex, endIndex + 1);
        const currentLength = routeLength(current);
        const replacement = candidateRouteReplacements(current[0], current[current.length - 1])
          .filter((candidate) => routeIsClearOfEquipment(candidate, equipments))
          .sort((left, right) => (routeLength(left) + left.length * 4) - (routeLength(right) + right.length * 4))[0];
        if (!replacement || replacement.length > current.length) continue;
        const replacementLength = routeLength(replacement);
        const saving = currentLength - replacementLength;
        if (saving < 30 || replacementLength > currentLength * 0.82) continue;
        if (!best || saving > best.saving) best = { startIndex, endIndex, replacement, saving };
      }
    }
    if (!best) break;
    route = compactRoutePoints([
      ...route.slice(0, best.startIndex),
      ...best.replacement,
      ...route.slice(best.endIndex + 1),
    ]);
  }
  return route;
};

const cleanSmallRouteDetours = (points: Point[], equipments: Equipment[] = [], maxDetour = 36) => {
  let route = compactRoutePoints(points);
  for (let pass = 0; pass < 12; pass += 1) {
    let changed = false;
    for (let startIndex = 0; startIndex < route.length - 3 && !changed; startIndex += 1) {
      const maxEndIndex = Math.min(route.length - 1, startIndex + 8);
      for (let endIndex = maxEndIndex; endIndex >= startIndex + 3; endIndex -= 1) {
        const start = route[startIndex];
        const end = route[endIndex];
        const middle = route.slice(startIndex + 1, endIndex);
        const horizontal = start.y === end.y;
        const vertical = start.x === end.x;
        if (!horizontal && !vertical) continue;
        if (segmentHitsEquipmentCore(start, end, equipments)) continue;
        const minX = Math.min(start.x, end.x) - maxDetour;
        const maxX = Math.max(start.x, end.x) + maxDetour;
        const minY = Math.min(start.y, end.y) - maxDetour;
        const maxY = Math.max(start.y, end.y) + maxDetour;
        const staysNearBaseLine = middle.every((point) => (
          point.x >= minX && point.x <= maxX
          && point.y >= minY && point.y <= maxY
          && (horizontal ? Math.abs(point.y - start.y) <= maxDetour : Math.abs(point.x - start.x) <= maxDetour)
        ));
        const hasActualDetour = middle.some((point) => (horizontal ? point.y !== start.y : point.x !== start.x));
        if (!staysNearBaseLine || !hasActualDetour) continue;
        route = compactRoutePoints([
          ...route.slice(0, startIndex + 1),
          end,
          ...route.slice(endIndex + 1),
        ]);
        changed = true;
        break;
      }
    }
    if (!changed) break;
  }
  return route;
};

type RouteSegmentOrientation = 'horizontal' | 'vertical';
type RouteSegmentOffsetCommand = {
  segmentIndex: number;
  orientation: RouteSegmentOrientation;
  offset: number;
};
type RouteOverlapSegment = {
  routeIndex: number;
  streamKey: string;
  segmentIndex: number;
  orientation: RouteSegmentOrientation;
  fixed: number;
  min: number;
  max: number;
};

const EQUIPMENT_BOUNDARY_NUDGE = 10;
const PIPE_PARALLEL_NUDGE = 8;
const PIPE_OVERLAP_TOLERANCE = 2;
const PIPE_MIN_OVERLAP = 18;

const intervalOverlapLength = (leftMin: number, leftMax: number, rightMin: number, rightMax: number) => (
  Math.max(0, Math.min(leftMax, rightMax) - Math.max(leftMin, rightMin))
);

const mergeRouteOffsetCommand = (
  commands: Map<number, RouteSegmentOffsetCommand>,
  command: RouteSegmentOffsetCommand,
) => {
  if (!command.offset) return;
  const current = commands.get(command.segmentIndex);
  if (!current || Math.abs(command.offset) > Math.abs(current.offset)) {
    commands.set(command.segmentIndex, command);
  }
};

const offsetRouteSegment = (
  route: Point[],
  segmentIndex: number,
  orientation: RouteSegmentOrientation,
  offset: number,
) => {
  if (!offset || segmentIndex < 0 || segmentIndex >= route.length - 1) return route;
  const offsetPoint = (point: Point) => (
    orientation === 'horizontal'
      ? { x: point.x, y: point.y + offset }
      : { x: point.x + offset, y: point.y }
  );
  const a = route[segmentIndex];
  const b = route[segmentIndex + 1];
  const replacement: Point[] = [];
  const offsetA = offsetPoint(a);
  const offsetB = offsetPoint(b);
  if (segmentIndex === 0) replacement.push(a, offsetA);
  else replacement.push(offsetA);
  if (segmentIndex + 1 === route.length - 1) replacement.push(offsetB, b);
  else replacement.push(offsetB);
  return compactRoutePoints([
    ...route.slice(0, segmentIndex),
    ...replacement,
    ...route.slice(segmentIndex + 2),
  ]);
};

const applyRouteSegmentOffsets = (route: Point[], commands: Map<number, RouteSegmentOffsetCommand>) => (
  Array.from(commands.values())
    .sort((left, right) => right.segmentIndex - left.segmentIndex)
    .reduce((currentRoute, command) => (
      offsetRouteSegment(currentRoute, command.segmentIndex, command.orientation, command.offset)
    ), route)
);

const avoidEquipmentBoundaryOverlaps = (route: Point[], equipments: Equipment[]) => {
  const commands = new Map<number, RouteSegmentOffsetCommand>();
  route.slice(1).forEach((point, index) => {
    const previous = route[index];
    if (previous.x === point.x && previous.y !== point.y) {
      const minY = Math.min(previous.y, point.y);
      const maxY = Math.max(previous.y, point.y);
      equipments.forEach((equipment) => {
        const rect = expandedRect(equipment, 0);
        const overlap = intervalOverlapLength(minY, maxY, rect.y, rect.y + rect.height);
        if (overlap < PIPE_MIN_OVERLAP) return;
        if (Math.abs(previous.x - rect.x) <= PIPE_OVERLAP_TOLERANCE) {
          mergeRouteOffsetCommand(commands, { segmentIndex: index, orientation: 'vertical', offset: -EQUIPMENT_BOUNDARY_NUDGE });
        }
        if (Math.abs(previous.x - (rect.x + rect.width)) <= PIPE_OVERLAP_TOLERANCE) {
          mergeRouteOffsetCommand(commands, { segmentIndex: index, orientation: 'vertical', offset: EQUIPMENT_BOUNDARY_NUDGE });
        }
      });
    }
    if (previous.y === point.y && previous.x !== point.x) {
      const minX = Math.min(previous.x, point.x);
      const maxX = Math.max(previous.x, point.x);
      equipments.forEach((equipment) => {
        const rect = expandedRect(equipment, 0);
        const overlap = intervalOverlapLength(minX, maxX, rect.x, rect.x + rect.width);
        if (overlap < PIPE_MIN_OVERLAP) return;
        if (Math.abs(previous.y - rect.y) <= PIPE_OVERLAP_TOLERANCE) {
          mergeRouteOffsetCommand(commands, { segmentIndex: index, orientation: 'horizontal', offset: -EQUIPMENT_BOUNDARY_NUDGE });
        }
        if (Math.abs(previous.y - (rect.y + rect.height)) <= PIPE_OVERLAP_TOLERANCE) {
          mergeRouteOffsetCommand(commands, { segmentIndex: index, orientation: 'horizontal', offset: EQUIPMENT_BOUNDARY_NUDGE });
        }
      });
    }
  });
  return applyRouteSegmentOffsets(route, commands);
};

const routeOverlapSegments = (routes: CanvasPipeRoute[]): RouteOverlapSegment[] => (
  routes.flatMap((canvasRoute, routeIndex) => (
    canvasRoute.route.slice(1).flatMap<RouteOverlapSegment>((point, index) => {
      const previous = canvasRoute.route[index];
      const streamKey = canvasRoute.stream.sourceStreamId || canvasRoute.stream.id;
      if (previous.x === point.x && previous.y !== point.y) {
        return [{
          routeIndex,
          streamKey,
          segmentIndex: index,
          orientation: 'vertical',
          fixed: previous.x,
          min: Math.min(previous.y, point.y),
          max: Math.max(previous.y, point.y),
        }];
      }
      if (previous.y === point.y && previous.x !== point.x) {
        return [{
          routeIndex,
          streamKey,
          segmentIndex: index,
          orientation: 'horizontal',
          fixed: previous.y,
          min: Math.min(previous.x, point.x),
          max: Math.max(previous.x, point.x),
        }];
      }
      return [];
    })
  ))
);

const parallelDisplayOffset = (index: number) => {
  if (index === 0) return 0;
  const multiplier = Math.ceil(index / 2);
  return (index % 2 === 1 ? 1 : -1) * multiplier * PIPE_PARALLEL_NUDGE;
};

const avoidParallelPipeOverlaps = (routes: CanvasPipeRoute[]) => {
  const commandsByRoute = new Map<number, Map<number, RouteSegmentOffsetCommand>>();
  const segmentsByTrack = new Map<string, RouteOverlapSegment[]>();
  routeOverlapSegments(routes).forEach((segment) => {
    const fixedKey = Math.round(segment.fixed / PIPE_OVERLAP_TOLERANCE);
    const key = `${segment.orientation}:${fixedKey}`;
    segmentsByTrack.set(key, [...(segmentsByTrack.get(key) || []), segment]);
  });

  const registerCluster = (cluster: RouteOverlapSegment[]) => {
    const streamKeys = new Set(cluster.map((segment) => segment.streamKey));
    if (cluster.length < 2 || streamKeys.size < 2) return;
    cluster
      .slice()
      .sort((left, right) => left.routeIndex - right.routeIndex || left.segmentIndex - right.segmentIndex)
      .forEach((segment, index) => {
        const offset = parallelDisplayOffset(index);
        if (!offset) return;
        const routeCommands = commandsByRoute.get(segment.routeIndex) || new Map<number, RouteSegmentOffsetCommand>();
        mergeRouteOffsetCommand(routeCommands, {
          segmentIndex: segment.segmentIndex,
          orientation: segment.orientation,
          offset,
        });
        commandsByRoute.set(segment.routeIndex, routeCommands);
      });
  };

  segmentsByTrack.forEach((trackSegments) => {
    const sorted = trackSegments.slice().sort((left, right) => left.min - right.min || left.max - right.max);
    let cluster: RouteOverlapSegment[] = [];
    let clusterMax = Number.NEGATIVE_INFINITY;
    sorted.forEach((segment) => {
      if (cluster.length && segment.min > clusterMax - PIPE_MIN_OVERLAP) {
        registerCluster(cluster);
        cluster = [];
      }
      cluster.push(segment);
      clusterMax = Math.max(clusterMax, segment.max);
    });
    registerCluster(cluster);
  });

  return routes.map((canvasRoute, routeIndex) => ({
    ...canvasRoute,
    route: applyRouteSegmentOffsets(canvasRoute.route, commandsByRoute.get(routeIndex) || new Map()),
  }));
};

const avoidDisplayRouteOverlaps = (routes: CanvasPipeRoute[], equipments: Equipment[]) => (
  avoidParallelPipeOverlaps(routes.map((canvasRoute) => ({
    ...canvasRoute,
    route: avoidEquipmentBoundaryOverlaps(canvasRoute.route, equipments),
  })))
);

type RouteCrossing = {
  point: Point;
  horizontalStream: CanvasStream;
  verticalStream: CanvasStream;
};
type OrthogonalRouteSegment = {
  stream: CanvasStream;
  route: Point[];
  a: Point;
  b: Point;
  orientation: RouteSegmentOrientation;
};
const samePoint = (left: Point, right: Point, tolerance = 0.5) => (
  Math.abs(left.x - right.x) <= tolerance && Math.abs(left.y - right.y) <= tolerance
);
const betweenInclusive = (value: number, left: number, right: number, tolerance = 0.5) => (
  value >= Math.min(left, right) - tolerance && value <= Math.max(left, right) + tolerance
);
const segmentInteriorContains = (segment: OrthogonalRouteSegment, point: Point) => {
  if (samePoint(point, segment.a) || samePoint(point, segment.b)) return false;
  if (segment.orientation === 'horizontal') {
    return Math.abs(point.y - segment.a.y) <= 0.5 && betweenInclusive(point.x, segment.a.x, segment.b.x);
  }
  return Math.abs(point.x - segment.a.x) <= 0.5 && betweenInclusive(point.y, segment.a.y, segment.b.y);
};
const routeSegmentsForCrossing = ({ stream, route }: CanvasPipeRoute): OrthogonalRouteSegment[] => (
  route.slice(1).flatMap<OrthogonalRouteSegment>((point, index) => {
    const previous = route[index];
    if (previous.x === point.x && previous.y !== point.y) return [{ stream, route, a: previous, b: point, orientation: 'vertical' as const }];
    if (previous.y === point.y && previous.x !== point.x) return [{ stream, route, a: previous, b: point, orientation: 'horizontal' as const }];
    return [];
  })
);
const computeRouteCrossings = (routes: CanvasPipeRoute[]) => {
  const segments = routes.flatMap(routeSegmentsForCrossing);
  const crossings: RouteCrossing[] = [];
  const seen = new Set<string>();
  for (let leftIndex = 0; leftIndex < segments.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < segments.length; rightIndex += 1) {
      const left = segments[leftIndex];
      const right = segments[rightIndex];
      const leftStreamId = left.stream.sourceStreamId || left.stream.id;
      const rightStreamId = right.stream.sourceStreamId || right.stream.id;
      if (leftStreamId === rightStreamId || left.orientation === right.orientation) continue;
      const horizontal = left.orientation === 'horizontal' ? left : right;
      const vertical = left.orientation === 'vertical' ? left : right;
      const point = { x: vertical.a.x, y: horizontal.a.y };
      if (!segmentInteriorContains(horizontal, point) || !segmentInteriorContains(vertical, point)) continue;
      const keyPoint = { x: Math.round(point.x * 10) / 10, y: Math.round(point.y * 10) / 10 };
      const key = `${keyPoint.x}:${keyPoint.y}:${[leftStreamId, rightStreamId].sort().join(':')}`;
      if (seen.has(key)) continue;
      seen.add(key);
      crossings.push({ point, horizontalStream: horizontal.stream, verticalStream: vertical.stream });
    }
  }
  return crossings;
};

const routeManhattan = (from: Equipment, fromPort: ExternalPort, to: Equipment, toPort: ExternalPort, equipments: Equipment[]) => {
  const start = portPoint(from, fromPort);
  const startExit = portExitPoint(from, fromPort);
  const end = portPoint(to, toPort);
  const endExit = portExitPoint(to, toPort);
  const obstacles = equipments.map((equipment) => equipmentCoreRect(equipment));
  const minX = Math.min(...equipments.map((equipment) => equipment.x)) - 50;
  const maxX = Math.max(...equipments.map((equipment) => equipment.x + equipment.width)) + 50;
  const minY = Math.min(...equipments.map((equipment) => equipment.y)) - 50;
  const maxY = Math.max(...equipments.map((equipment) => equipment.y + equipment.height)) + 50;

  const candidates = [
    [start, startExit, { x: endExit.x, y: startExit.y }, endExit, end],
    [start, startExit, { x: startExit.x, y: endExit.y }, endExit, end],
    [start, startExit, { x: (startExit.x + endExit.x) / 2, y: startExit.y }, { x: (startExit.x + endExit.x) / 2, y: endExit.y }, endExit, end],
    [start, startExit, { x: startExit.x, y: (startExit.y + endExit.y) / 2 }, { x: endExit.x, y: (startExit.y + endExit.y) / 2 }, endExit, end],
    [start, startExit, { x: maxX, y: startExit.y }, { x: maxX, y: endExit.y }, endExit, end],
    [start, startExit, { x: minX, y: startExit.y }, { x: minX, y: endExit.y }, endExit, end],
    [start, startExit, { x: startExit.x, y: maxY }, { x: endExit.x, y: maxY }, endExit, end],
    [start, startExit, { x: startExit.x, y: minY }, { x: endExit.x, y: minY }, endExit, end],
  ].map(dedupePoints);
  equipments.forEach((equipment) => {
    const rect = expandedRect(equipment, 20);
    candidates.push(dedupePoints([start, startExit, { x: rect.x, y: startExit.y }, { x: rect.x, y: endExit.y }, endExit, end]));
    candidates.push(dedupePoints([start, startExit, { x: rect.x + rect.width, y: startExit.y }, { x: rect.x + rect.width, y: endExit.y }, endExit, end]));
    candidates.push(dedupePoints([start, startExit, { x: startExit.x, y: rect.y }, { x: endExit.x, y: rect.y }, endExit, end]));
    candidates.push(dedupePoints([start, startExit, { x: startExit.x, y: rect.y + rect.height }, { x: endExit.x, y: rect.y + rect.height }, endExit, end]));
  });

  const score = (points: Point[]) => {
    let hits = 0;
    let length = 0;
    const route = compactRoutePoints(points);
    let diagonal = 0;
    for (let index = 1; index < route.length; index += 1) {
      const a = route[index - 1];
      const b = route[index];
      length += Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
      if (a.x !== b.x && a.y !== b.y) diagonal += 1;
      hits += obstacles.filter((rect) => segmentHitsRect(a, b, rect)).length;
    }
    const bends = Math.max(0, route.length - 2);
    return diagonal * 1000000 + hits * 100000 + bends * 800 + length;
  };

  return candidates.sort((a, b) => score(a) - score(b))[0];
};

const pointAtRatio = (points: Point[], ratio: number) => {
  const safeRatio = Math.max(0, Math.min(100, ratio)) / 100;
  const lengths = points.slice(1).map((point, index) => Math.abs(point.x - points[index].x) + Math.abs(point.y - points[index].y));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  let remaining = total * safeRatio;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const length = Math.abs(current.x - previous.x) + Math.abs(current.y - previous.y);
    if (remaining <= length) {
      const t = length === 0 ? 0 : remaining / length;
      return {
        x: previous.x + (current.x - previous.x) * t,
        y: previous.y + (current.y - previous.y) * t,
      };
    }
    remaining -= length;
  }
  return points[points.length - 1] || { x: 0, y: 0 };
};

const routeAxisAtRatio = (points: Point[], ratio: number): 'horizontal' | 'vertical' | undefined => {
  const lengths = points.slice(1).map((point, index) => Math.abs(point.x - points[index].x) + Math.abs(point.y - points[index].y));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  if (total <= 0) return undefined;
  let remaining = total * Math.max(0, Math.min(100, ratio)) / 100;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const length = lengths[index - 1] || 0;
    if (length <= 0) continue;
    if (remaining <= length || index === points.length - 1) {
      return Math.abs(current.x - previous.x) >= Math.abs(current.y - previous.y) ? 'horizontal' : 'vertical';
    }
    remaining -= length;
  }
  return undefined;
};

const perpendicularExitPoint = (point: Point, mainAxis: 'horizontal' | 'vertical', toward: Point, offset = 28): Point => {
  if (mainAxis === 'horizontal') {
    return { x: point.x, y: point.y + (Math.sign(toward.y - point.y) || 1) * offset };
  }
  return { x: point.x + (Math.sign(toward.x - point.x) || 1) * offset, y: point.y };
};

const nearestPointOnRoute = (points: Point[], point: Point) => {
  const lengths = points.slice(1).map((current, index) => Math.abs(current.x - points[index].x) + Math.abs(current.y - points[index].y));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  if (total <= 0) return null;
  let traversed = 0;
  let best = { distance: Number.POSITIVE_INFINITY, ratio: 0, point: points[0] || { x: 0, y: 0 } };
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const length = lengths[index - 1] || 0;
    if (length <= 0) continue;
    const horizontal = previous.y === current.y;
    const t = horizontal
      ? (point.x - previous.x) / (current.x - previous.x || 1)
      : (point.y - previous.y) / (current.y - previous.y || 1);
    const clamped = Math.max(0, Math.min(1, t));
    const projected = horizontal
      ? { x: previous.x + (current.x - previous.x) * clamped, y: previous.y }
      : { x: previous.x, y: previous.y + (current.y - previous.y) * clamped };
    const distance = Math.abs(projected.x - point.x) + Math.abs(projected.y - point.y);
    if (distance < best.distance) {
      best = { distance, ratio: (traversed + length * clamped) / total * 100, point: projected };
    }
    traversed += length;
  }
  return best;
};

const routeBetweenPoints = (start: Point, end: Point, equipments: Equipment[], preferredStartExit?: Point, preferredEndExit?: Point) => {
  const exitOffset = Math.min(12, Math.max(6, (Math.abs(end.x - start.x) + Math.abs(end.y - start.y)) / 16));
  const exitFrom = (point: Point, toward: Point, multiplier: 1 | -1): Point => {
    const dx = toward.x - point.x;
    const dy = toward.y - point.y;
    if (Math.abs(dx) >= Math.abs(dy)) {
      return { x: point.x + Math.sign(dx || 1) * exitOffset * multiplier, y: point.y };
    }
    return { x: point.x, y: point.y + Math.sign(dy || 1) * exitOffset * multiplier };
  };
  const startExit = preferredStartExit || exitFrom(start, end, 1);
  const endExit = preferredEndExit || exitFrom(end, start, 1);
  const endpointPadding = 8;
  const obstacles = equipments.map((equipment) => equipmentCoreRect(equipment));
  const minX = Math.min(...equipments.map((equipment) => equipment.x), start.x, end.x, startExit.x, endExit.x) - 50;
  const maxX = Math.max(...equipments.map((equipment) => equipment.x + equipment.width), start.x, end.x, startExit.x, endExit.x) + 50;
  const minY = Math.min(...equipments.map((equipment) => equipment.y), start.y, end.y, startExit.y, endExit.y) - 50;
  const maxY = Math.max(...equipments.map((equipment) => equipment.y + equipment.height), start.y, end.y, startExit.y, endExit.y) + 50;
  const isStartExitRequired = Boolean(preferredStartExit);
  const isEndExitRequired = Boolean(preferredEndExit);
  const routeStart = isStartExitRequired ? startExit : start;
  const routeEnd = isEndExitRequired ? endExit : end;
  const candidates: Point[][] = [];
  const addCandidate = (middle: Point[]) => {
    candidates.push(compactRoutePoints([
      start,
      ...(isStartExitRequired ? [startExit] : []),
      ...middle,
      ...(isEndExitRequired ? [endExit] : []),
      end,
    ]));
  };
  if (routeStart.x === routeEnd.x || routeStart.y === routeEnd.y) addCandidate([]);
  addCandidate([{ x: routeEnd.x, y: routeStart.y }]);
  addCandidate([{ x: routeStart.x, y: routeEnd.y }]);
  addCandidate([
    { x: (routeStart.x + routeEnd.x) / 2, y: routeStart.y },
    { x: (routeStart.x + routeEnd.x) / 2, y: routeEnd.y },
  ]);
  addCandidate([
    { x: routeStart.x, y: (routeStart.y + routeEnd.y) / 2 },
    { x: routeEnd.x, y: (routeStart.y + routeEnd.y) / 2 },
  ]);
  addCandidate([{ x: maxX, y: routeStart.y }, { x: maxX, y: routeEnd.y }]);
  addCandidate([{ x: minX, y: routeStart.y }, { x: minX, y: routeEnd.y }]);
  addCandidate([{ x: routeStart.x, y: maxY }, { x: routeEnd.x, y: maxY }]);
  addCandidate([{ x: routeStart.x, y: minY }, { x: routeEnd.x, y: minY }]);
  equipments.forEach((equipment) => {
    const rect = expandedRect(equipment, 20);
    addCandidate([{ x: rect.x, y: routeStart.y }, { x: rect.x, y: routeEnd.y }]);
    addCandidate([{ x: rect.x + rect.width, y: routeStart.y }, { x: rect.x + rect.width, y: routeEnd.y }]);
    addCandidate([{ x: routeStart.x, y: rect.y }, { x: routeEnd.x, y: rect.y }]);
    addCandidate([{ x: routeStart.x, y: rect.y + rect.height }, { x: routeEnd.x, y: rect.y + rect.height }]);
  });
  const score = (points: Point[]) => {
    let hits = 0;
    let length = 0;
    const route = compactRoutePoints(points);
    let diagonal = 0;
    for (let index = 1; index < route.length; index += 1) {
      const a = route[index - 1];
      const b = route[index];
      length += Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
      if (a.x !== b.x && a.y !== b.y) diagonal += 1;
      hits += obstacles.filter((rect) => segmentHitsRect(a, b, {
        x: rect.x - endpointPadding,
        y: rect.y - endpointPadding,
        width: rect.width + endpointPadding * 2,
        height: rect.height + endpointPadding * 2,
      })).length;
    }
    const bends = Math.max(0, route.length - 2);
    return diagonal * 1000000 + hits * 100000 + bends * 800 + length;
  };
  return candidates.sort((a, b) => score(a) - score(b))[0];
};

const blankProfile = (): EquipmentProfile => ({
  coreFunction: '',
  workingPrinciple: '',
  operatingModes: [],
  operatingParameters: [],
});

const defaultProject = (): PidSemanticProject => ({
  version: 'pid-layered-semantic/v1',
  pipeModelVersion: 'centerline-v4',
  project: {
    name: '苯酐装置 P&ID 语义项目',
    drawingNo: 'PID-DEMO-001',
    owner: '工艺工程组',
    designBasis: '以结构化语义为事实来源，画布仅表达几何和连接关系。',
  },
  currentAreaId: 'area_oxidation',
  currentSheetId: 'sheet_reactor_loop',
  areas: [{
    id: 'area_oxidation',
    name: '氧化工段',
    objective: '将工业萘与空气混合后在固定床反应器中氧化生成苯酐，并通过熔盐系统移除反应热。',
    sheets: [
      { id: 'sheet_reactor_loop', name: '反应与熔盐循环', description: '固定床反应器、熔盐冷却器和相关循环管线。' },
      { id: 'sheet_feed', name: '萘进料与混合', description: '进料、混合、预热和切断边界。' },
    ],
  }],
  equipments: [],
  lineGroups: [],
  streams: [],
  pipeNodes: [],
  inlineComponents: [],
  controls: [],
  narratives: [],
});

const equipmentTemplate = (type: EquipmentType, tag: string, sheetId: string, areaId: string, x: number, y: number): Equipment => {
  const base: Equipment = {
    id: uid('eq'),
    sheetId,
    areaId,
    type,
    tag,
    name: EQUIPMENT_LABELS[type],
    material: 'CS',
    description: '',
    attributes: {},
    profile: blankProfile(),
    parts: [{ id: 'p1', category: 'fluid_space', type: '封头', name: '主体空间', phase: '任意', role: '' }],
    ports: [],
    relations: [],
    x,
    y,
    width: 140,
    height: 70,
  };

  if (type === 'reactor') {
    return {
      ...base,
      name: '固定床反应器',
      attributes: { 设计压力: '', 设计温度: '', 反应类型: '', 床层数量: '2' },
      profile: {
        ...blankProfile(),
        coreFunction: '将混合原料在催化剂床层中反应，并通过换热系统控制反应热。',
        workingPrinciple: '物料进入上部空间后穿过催化剂床层，下部空间汇集产物；壳程或外部换热系统带走反应热。',
      },
      parts: [
        { id: 'p1', category: 'fluid_space', type: '封头', name: '上封头', phase: '气相', role: '进料分配空间' },
        { id: 'p2', category: 'functional_element', type: '催化剂床层', name: '催化剂床层', phase: '混合相', role: '反应区' },
        { id: 'p3', category: 'fluid_space', type: '封头', name: '下封头', phase: '气相', role: '产物收集空间' },
      ],
      ports: [
        { id: 'in1', name: '进料入口', ownerPartId: 'p1', direction: 'in', role: '主物流', medium: '工艺气', x: 0, y: 35 },
        { id: 'out1', name: '产物出口', ownerPartId: 'p3', direction: 'out', role: '主物流', medium: '产物气', x: 100, y: 68 },
      ],
      relations: [
        { id: uid('rel'), sourcePartId: 'p1', relation: '供给/流入', targetPartId: 'p2', description: '' },
        { id: uid('rel'), sourcePartId: 'p2', relation: '供给/流入', targetPartId: 'p3', description: '' },
      ],
    };
  }

  if (type === 'exchanger' || type === 'heater' || type === 'cooler') {
    return {
      ...base,
      name: type === 'heater' ? '加热器' : type === 'cooler' ? '冷却器' : '换热器',
      attributes: { 换热面积: '', 热侧介质: '', 冷侧介质: '' },
      parts: [
        { id: 'p1', category: 'fluid_space', type: '壳程', name: '壳程', phase: '任意', role: '壳侧流体空间' },
        { id: 'p2', category: 'fluid_space', type: '管程', name: '管程', phase: '任意', role: '管侧流体空间' },
        { id: 'p3', category: 'functional_element', type: '换热壁面', name: '换热壁面', phase: '任意', role: '隔壁传热边界' },
      ],
      ports: [
        { id: 'in1', name: '壳程入口', ownerPartId: 'p1', direction: 'in', role: '主物流', medium: '水', x: 0, y: 32 },
        { id: 'out1', name: '壳程出口', ownerPartId: 'p1', direction: 'out', role: '主物流', medium: '水', x: 100, y: 32 },
        { id: 'in2', name: '管程入口', ownerPartId: 'p2', direction: 'in', role: '主物流', medium: '蒸汽', x: 0, y: 72 },
        { id: 'out2', name: '管程出口', ownerPartId: 'p2', direction: 'out', role: '主物流', medium: '蒸汽', x: 100, y: 72 },
      ],
      relations: [
        { id: uid('rel'), sourcePartId: 'p1', relation: '热接触', targetPartId: 'p3', description: '' },
        { id: uid('rel'), sourcePartId: 'p2', relation: '热接触', targetPartId: 'p3', description: '' },
      ],
    };
  }

  if (type === 'pump' || type === 'compressor' || type === 'fan') {
    const gas = type !== 'pump';
    return {
      ...base,
      attributes: { 流量: '', 扬程或压比: '', 功率: '' },
      parts: [
        { id: 'p1', category: 'fluid_space', type: gas ? '气相空间' : '泵腔', name: gas ? '增压腔' : '泵腔', phase: gas ? '气相' : '液相', role: '流体增压空间' },
        { id: 'p2', category: 'functional_element', type: '驱动单元', name: '驱动单元', phase: '任意', role: '启停和联锁动作对象' },
      ],
      ports: [
        { id: 'in1', name: '吸入口', ownerPartId: 'p1', direction: 'in', role: '主物流', medium: gas ? '工艺气' : '水', x: 0, y: 55 },
        { id: 'out1', name: '排出口', ownerPartId: 'p1', direction: 'out', role: '主物流', medium: gas ? '工艺气' : '水', x: 100, y: 38 },
      ],
      relations: [{ id: uid('rel'), sourcePartId: 'p2', relation: '驱动', targetPartId: 'p1', description: '驱动单元使流体获得能量' }],
    };
  }

	  if (type === 'tank' || type === 'separator') {
	    return {
	      ...base,
      attributes: { 容积: '', 设计压力: '', 设计温度: '' },
      parts: [
        { id: 'p1', category: 'fluid_space', type: '气相空间', name: '气相空间', phase: '气相', role: '' },
        { id: 'p2', category: 'fluid_space', type: '液相空间', name: '液相空间', phase: '液相', role: '' },
      ],
      ports: [
        { id: 'in1', name: '入口', ownerPartId: 'p2', direction: 'in', role: '主物流', medium: '物料', x: 0, y: 62 },
        { id: 'out1', name: '液相出口', ownerPartId: 'p2', direction: 'out', role: '主物流', medium: '物料', x: 100, y: 78 },
        { id: 'out2', name: '气相口', ownerPartId: 'p1', direction: 'out', role: '泄放', medium: '气相', x: 50, y: 0 },
      ],
      relations: [{ id: uid('rel'), sourcePartId: 'p2', relation: '相接触', targetPartId: 'p1', description: '' }],
	    };
	  }

	  if (type === 'header') {
	    return {
	      ...base,
	      name: '公共工程母管',
	      width: 240,
	      height: 46,
	      description: '作为蒸汽、循环水、氮气、仪表空气等公共工程或主物流的分配/汇集边界。',
	      attributes: { 介质: '', 母管用途: '分配', 压力等级: '', 管径: '' },
	      profile: {
	        ...blankProfile(),
	        coreFunction: '作为公共工程或主物流的分配/汇集母管，为多个设备或支管提供稳定来源、回收去向或系统边界。',
	        workingPrinciple: '上游物流进入母管后沿母管分配至各支路，或多个支路汇入母管后返回公共系统；母管本身只表达连通、分配和边界语义。',
	      },
	      parts: [
	        { id: 'p1', category: 'fluid_space', type: '母管腔', name: '母管空间', phase: '任意', role: '公共工程或主物流分配/汇集空间' },
	      ],
	      ports: [
	        { id: 'in1', name: '母管来流口', ownerPartId: 'p1', direction: 'in', role: '公用工程', medium: '公用工程', x: 0, y: 50 },
	        { id: 'out1', name: '支路接口 1', ownerPartId: 'p1', direction: 'out', role: '公用工程', medium: '公用工程', x: 28, y: 100 },
	        { id: 'out2', name: '支路接口 2', ownerPartId: 'p1', direction: 'out', role: '公用工程', medium: '公用工程', x: 50, y: 100 },
	        { id: 'out3', name: '支路接口 3', ownerPartId: 'p1', direction: 'out', role: '公用工程', medium: '公用工程', x: 72, y: 100 },
	        { id: 'bi1', name: '母管延续口', ownerPartId: 'p1', direction: 'bi', role: '公用工程', medium: '公用工程', x: 100, y: 50 },
	      ],
	      relations: [
	        { id: uid('rel'), sourcePartId: 'p1', relation: '连通', targetPartId: 'p1', description: '母管内部各接口相互连通，用于支路分配或汇集。' },
	      ],
	    };
	  }

	  return base;
	};

const createSeedProject = () => {
  const project = defaultProject();
  const sheetId = project.currentSheetId;
  const areaId = project.currentAreaId;
  const reactor = equipmentTemplate('reactor', 'R-001', sheetId, areaId, 270, 170);
  const exchanger = equipmentTemplate('exchanger', 'E-001', sheetId, areaId, 570, 185);
  exchanger.name = '熔盐冷却器';
  const pump = equipmentTemplate('pump', 'P-001', sheetId, areaId, 425, 390);
  pump.name = '熔盐循环泵';
  project.equipments = [reactor, exchanger, pump];
  const moltenSaltGroup: PipeGroup = {
    id: uid('pipe_group'),
    sheetId,
    tag: 'MS-LOOP-001',
    name: '熔盐循环主管',
    role: '循环',
    medium: '熔盐',
    directionMode: '单向',
    boundaryIn: '反应器熔盐出口',
    boundaryOut: '冷却后熔盐返回反应器',
    purpose: '把反应器产生的热量带出并送至冷却器移热。',
    reverseCondition: '',
    notes: '主管与支管均作为该管线组下的管段维护。',
  };
  project.lineGroups = [moltenSaltGroup];
  project.streams = [
    {
      id: uid('line'),
      groupId: moltenSaltGroup.id,
      sheetId,
      tag: 'L-001',
      name: '反应器至熔盐冷却器管段',
      role: '循环',
      branchType: '主管段',
      directionMode: '单向',
      medium: '熔盐',
      fromKind: '设备端口',
      fromEquipmentId: reactor.id,
      fromPortId: 'out1',
      fromSegmentId: '',
      fromSegmentRatio: 50,
      fromReferenceLabel: '',
      fromReferenceArea: '',
      fromReferenceSheet: '',
      fromReferenceEquipment: '',
      fromReferencePort: '',
      fromReferenceX: 240,
      fromReferenceY: 300,
      fromContinuationX: 0,
      fromContinuationY: 0,
      toKind: '设备端口',
      toEquipmentId: exchanger.id,
      toPortId: 'in1',
      toSegmentId: '',
      toSegmentRatio: 50,
      toReferenceLabel: '',
      toReferenceArea: '',
      toReferenceSheet: '',
      toReferenceEquipment: '',
      toReferencePort: '',
      toReferenceX: 720,
      toReferenceY: 300,
      toContinuationX: 0,
      toContinuationY: 0,
      manualWaypoints: [],
      dn: 'DN150',
      pn: 'PN16',
      material: 'CS',
      intent: '将反应器高温熔盐送至冷却器移热。',
    },
    {
      id: uid('line'),
      groupId: moltenSaltGroup.id,
      sheetId,
      tag: 'L-002',
      name: '熔盐循环泵回反应器管段',
      role: '循环',
      branchType: '主管段',
      directionMode: '单向',
      medium: '熔盐',
      fromKind: '设备端口',
      fromEquipmentId: pump.id,
      fromPortId: 'out1',
      fromSegmentId: '',
      fromSegmentRatio: 50,
      fromReferenceLabel: '',
      fromReferenceArea: '',
      fromReferenceSheet: '',
      fromReferenceEquipment: '',
      fromReferencePort: '',
      fromReferenceX: 240,
      fromReferenceY: 460,
      fromContinuationX: 0,
      fromContinuationY: 0,
      toKind: '设备端口',
      toEquipmentId: reactor.id,
      toPortId: 'in1',
      toSegmentId: '',
      toSegmentRatio: 50,
      toReferenceLabel: '',
      toReferenceArea: '',
      toReferenceSheet: '',
      toReferenceEquipment: '',
      toReferencePort: '',
      toReferenceX: 720,
      toReferenceY: 460,
      toContinuationX: 0,
      toContinuationY: 0,
      manualWaypoints: [],
      dn: 'DN150',
      pn: 'PN16',
      material: 'CS',
      intent: '冷却后的熔盐由循环泵送回反应器。',
    },
  ];
  project.inlineComponents = [
    {
      id: uid('inline'),
      segmentId: project.streams[0].id,
      tag: 'HV-001',
      type: '手动阀',
      name: '熔盐出口隔离阀',
      positionRatio: 35,
      normalState: '常开',
      actuator: '手轮',
      controlSignal: '',
      description: '用于检修时隔离反应器至冷却器的熔盐管段。',
    },
    {
      id: uid('inline'),
      segmentId: project.streams[1].id,
      tag: 'CV-001',
      type: '控制阀',
      name: '熔盐回流调节阀',
      positionRatio: 62,
      normalState: '调节',
      actuator: '气动',
      controlSignal: 'TIC-001',
      description: '根据反应器温度调节回流熔盐流量。',
    },
  ];
  project.controls = [{
    id: uid('ctl'),
    kind: '联锁保护',
    tag: 'SIS-001',
    scope: '熔盐移热系统',
    triggerEquipmentId: reactor.id,
    triggerPartId: 'p2',
    condition: '催化剂床层温度高高',
    actionEquipmentId: pump.id,
    actionTargetId: 'p2',
    action: '保持熔盐循环泵运行并切断反应器进料',
    purpose: '防止固定床反应器超温',
    reset: '温度恢复正常并经操作员确认后复位',
  }];
  project.narratives = [
    {
      id: uid('nar'),
      level: '工段',
      subject: '氧化工段',
      generated: '反应器产生的热量由熔盐循环带出，经熔盐冷却器移热后由循环泵送回反应器。',
      reviewed: '',
    },
  ];
  return project;
};

const loadProject = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? normalizeProject(JSON.parse(saved) as PidSemanticProject) : createSeedProject();
  } catch {
    return createSeedProject();
  }
};

const normalizeProject = (project: PidSemanticProject) => {
  const { systems: _legacySystems, ...projectWithoutSystems } = project as PidSemanticProject & { systems?: unknown };
  void _legacySystems;
  const next = { ...projectWithoutSystems } as PidSemanticProject;
  const resetLegacyPipeLayout = next.pipeModelVersion !== 'centerline-v4';
  next.pipeModelVersion = 'centerline-v4';
  const fallbackGroup: PipeGroup = {
    id: uid('pipe_group'),
    sheetId: next.currentSheetId,
    tag: 'PIPE-GROUP-001',
    name: '未分组管线',
    role: next.streams[0]?.role || '主物流',
    medium: next.streams[0]?.medium || '',
    directionMode: '单向',
    boundaryIn: '',
    boundaryOut: '',
    purpose: '',
    reverseCondition: '',
    notes: '',
  };
  next.lineGroups = Array.isArray(next.lineGroups) && next.lineGroups.length ? next.lineGroups : [fallbackGroup];
  const sheetAreaIdMap = new Map(next.areas.flatMap((area) => area.sheets.map((sheet) => [sheet.id, area.id] as const)));
  next.equipments = Array.isArray(next.equipments) ? next.equipments.map((equipment) => {
    const legacyEquipment = equipment as Equipment & { systemId?: string; areaId?: string };
    const { systemId: _legacySystemId, ...equipmentWithoutSystem } = legacyEquipment;
    void _legacySystemId;
    return {
      ...equipmentWithoutSystem,
      areaId: sheetAreaIdMap.get(legacyEquipment.sheetId) || legacyEquipment.areaId || next.currentAreaId || next.areas[0]?.id || '',
      width: Math.min(Math.max(typeof equipment.width === 'number' ? equipment.width : 140, EQUIPMENT_MIN_WIDTH), equipmentWidthLimit(equipment.type)),
      height: Math.min(Math.max(typeof equipment.height === 'number' ? equipment.height : 70, EQUIPMENT_MIN_HEIGHT), EQUIPMENT_MAX_HEIGHT),
    };
  }) : [];
  next.streams = next.streams.map((stream) => ({
    ...stream,
    groupId: stream.groupId || next.lineGroups.find((group) => group.sheetId === stream.sheetId)?.id || next.lineGroups[0].id,
    name: stream.name || '',
    branchType: stream.branchType || '主管段',
    directionMode: stream.directionMode || '单向',
    fromKind: stream.fromKind || '设备端口',
    fromSegmentId: stream.fromSegmentId || '',
    fromSegmentRatio: typeof stream.fromSegmentRatio === 'number' ? stream.fromSegmentRatio : 50,
    fromPipeNodeId: stream.fromPipeNodeId || '',
    fromReferenceLabel: referenceDisplayName(stream.fromReferenceLabel || ''),
    fromReferenceArea: stream.fromReferenceArea || '',
    fromReferenceSheet: stream.fromReferenceSheet || '',
    fromReferenceEquipment: stream.fromReferenceEquipment || '',
    fromReferencePort: stream.fromReferencePort || '',
    fromReferenceX: typeof stream.fromReferenceX === 'number' ? stream.fromReferenceX : 160,
    fromReferenceY: typeof stream.fromReferenceY === 'number' ? stream.fromReferenceY : 180,
    fromContinuationX: resetLegacyPipeLayout ? 0 : typeof stream.fromContinuationX === 'number' ? stream.fromContinuationX : 0,
    fromContinuationY: resetLegacyPipeLayout ? 0 : typeof stream.fromContinuationY === 'number' ? stream.fromContinuationY : 0,
    toKind: stream.toKind || '设备端口',
    toSegmentId: stream.toSegmentId || '',
    toSegmentRatio: typeof stream.toSegmentRatio === 'number' ? stream.toSegmentRatio : 50,
    toPipeNodeId: stream.toPipeNodeId || '',
    toReferenceLabel: referenceDisplayName(stream.toReferenceLabel || ''),
    toReferenceArea: stream.toReferenceArea || '',
    toReferenceSheet: stream.toReferenceSheet || '',
    toReferenceEquipment: stream.toReferenceEquipment || '',
    toReferencePort: stream.toReferencePort || '',
    toReferenceX: typeof stream.toReferenceX === 'number' ? stream.toReferenceX : 900,
    toReferenceY: typeof stream.toReferenceY === 'number' ? stream.toReferenceY : 180,
    toContinuationX: resetLegacyPipeLayout ? 0 : typeof stream.toContinuationX === 'number' ? stream.toContinuationX : 0,
    toContinuationY: resetLegacyPipeLayout ? 0 : typeof stream.toContinuationY === 'number' ? stream.toContinuationY : 0,
    manualWaypoints: resetLegacyPipeLayout ? [] : Array.isArray(stream.manualWaypoints) ? stream.manualWaypoints : [],
    pieceWaypoints: !resetLegacyPipeLayout && stream.pieceWaypoints && typeof stream.pieceWaypoints === 'object'
      ? Object.fromEntries(Object.entries(stream.pieceWaypoints).map(([key, points]) => [
        key,
        Array.isArray(points) ? points.filter((point) => typeof point.x === 'number' && typeof point.y === 'number') : [],
      ]))
      : {},
  }));
  next.pipeNodes = Array.isArray(next.pipeNodes) ? next.pipeNodes.map((node) => {
    const segment = next.streams.find((stream) => stream.id === node.segmentId);
    return {
      ...node,
      groupId: node.groupId || segment?.groupId || next.lineGroups[0]?.id || '',
      kind: node.kind || '支管点',
      tag: node.tag || 'NODE',
      name: node.name || '',
      positionRatio: typeof node.positionRatio === 'number' ? node.positionRatio : 50,
      order: typeof node.order === 'number' ? node.order : typeof node.positionRatio === 'number' ? node.positionRatio : 50,
      x: resetLegacyPipeLayout ? undefined : typeof node.x === 'number' ? node.x : undefined,
      y: resetLegacyPipeLayout ? undefined : typeof node.y === 'number' ? node.y : undefined,
      description: node.description || '',
    };
  }) : [];
  const pipeNodeIds = new Set(next.pipeNodes.map((node) => node.id));
  next.streams = next.streams.map((stream) => {
    const patch: Partial<Stream> = {};
    (['from', 'to'] as const).forEach((side) => {
      const kind = side === 'from' ? stream.fromKind : stream.toKind;
      if (kind !== '管段接点') return;
      const pipeNodeId = side === 'from' ? stream.fromPipeNodeId : stream.toPipeNodeId;
      if (pipeNodeId && pipeNodeIds.has(pipeNodeId)) return;
      const segmentId = side === 'from' ? stream.fromSegmentId : stream.toSegmentId;
      const segment = next.streams.find((item) => item.id === segmentId);
      if (!segment) return;
      const ratio = side === 'from' ? stream.fromSegmentRatio : stream.toSegmentRatio;
      const x = side === 'from' ? stream.fromContinuationX : stream.toContinuationX;
      const y = side === 'from' ? stream.fromContinuationY : stream.toContinuationY;
      const nodeId = uid('pipe_node');
      const nodeKind = endpointPipeNodeKind(stream, side);
      next.pipeNodes.push({
        id: nodeId,
        groupId: segment.groupId || stream.groupId,
        segmentId,
        kind: nodeKind,
        tag: `${nodeKind}-${next.pipeNodes.length + 1}`,
        name: `${stream.tag}${side === 'from' ? '起点接点' : '终点接点'}`,
        positionRatio: clampPercent(ratio),
        order: clampPercent(ratio),
        x: resetLegacyPipeLayout ? undefined : x || undefined,
        y: resetLegacyPipeLayout ? undefined : y || undefined,
        description: `由 ${stream.tag} 的${side === 'from' ? '起点' : '终点'}管段接点自动创建。`,
      });
      pipeNodeIds.add(nodeId);
      if (side === 'from') patch.fromPipeNodeId = nodeId;
      else patch.toPipeNodeId = nodeId;
    });
    return Object.keys(patch).length ? { ...stream, ...patch } : stream;
  });
  next.inlineComponents = Array.isArray(next.inlineComponents) ? next.inlineComponents.map((component) => {
    const type = normalizeInlineComponentType(component.type);
    const measurement = isMeasurementInlineType(type);
    return {
      ...component,
      type,
      positionRatio: typeof component.positionRatio === 'number' ? component.positionRatio : 50,
      order: typeof component.order === 'number' ? component.order : typeof component.positionRatio === 'number' ? component.positionRatio : 50,
      x: resetLegacyPipeLayout ? undefined : typeof component.x === 'number' ? component.x : undefined,
      y: resetLegacyPipeLayout ? undefined : typeof component.y === 'number' ? component.y : undefined,
      normalState: measurement ? '' : component.normalState || '常开',
      actuator: measurement ? '' : component.actuator || '',
      controlSignal: component.controlSignal || '',
      description: component.description || '',
    };
  }) : [];
  return next;
};

const appendProjectAsSheets = (base: PidSemanticProject, importedProject: PidSemanticProject): AppendProjectResult => {
  const imported = normalizeProject(JSON.parse(JSON.stringify(importedProject)) as PidSemanticProject);
  const sourceLabel = imported.project.drawingNo || imported.project.name || '导入工程';
  const fallbackArea: ProcessArea = { id: uid('area'), name: '工段 1', objective: '', sheets: [] };
  const targetArea = base.areas.find((area) => area.id === base.currentAreaId) || base.areas[0] || fallbackArea;
  const baseAreas = base.areas.length ? base.areas : [targetArea];

  const sheetEntries = imported.areas.flatMap((area) => area.sheets.map((sheet) => ({ area, sheet })));
  const sourceSheets = sheetEntries.length
    ? sheetEntries
    : [{ area: imported.areas[0], sheet: { id: imported.currentSheetId || uid('sheet'), name: '图纸 1', description: '' } }];
  const sheetIdMap = new Map<string, string>();
  const addedSheets = sourceSheets.map(({ area, sheet }, index) => {
    const id = uid('sheet');
    sheetIdMap.set(sheet.id, id);
    const nameParts = sourceSheets.length > 1
      ? [sourceLabel, area?.name, sheet.name || `图纸 ${index + 1}`]
      : [sourceLabel, sheet.name || '导入图纸'];
    return {
      id,
      name: nameParts.filter(Boolean).join(' / '),
      description: sheet.description || `从本地工程 ${sourceLabel} 导入。`,
    };
  });
  const firstSheetId = addedSheets[0]?.id || targetArea.sheets[0]?.id || base.currentSheetId;

  const equipmentIdMap = new Map(imported.equipments.map((equipment) => [equipment.id, uid('eq')]));
  const lineGroupIdMap = new Map(imported.lineGroups.map((group) => [group.id, uid('pipe_group')]));
  const streamIdMap = new Map(imported.streams.map((stream) => [stream.id, uid('line')]));
  const pipeNodeIdMap = new Map(imported.pipeNodes.map((node) => [node.id, uid('pipe_node')]));
  const inlineComponentIdMap = new Map(imported.inlineComponents.map((component) => [component.id, uid('inline')]));

  const remapSheet = (sheetId: string) => sheetIdMap.get(sheetId) || firstSheetId;
  const remapEquipmentReference = (reference: string) => equipmentIdMap.get(reference) || reference;
  const remapStreamReference = (streamId: string) => streamIdMap.get(streamId) || '';
  const remapPipeNodeReference = (nodeId: string | undefined) => (nodeId ? pipeNodeIdMap.get(nodeId) || '' : '');

  const addedEquipments = imported.equipments.map((equipment) => ({
    ...equipment,
    id: equipmentIdMap.get(equipment.id) || uid('eq'),
    sheetId: remapSheet(equipment.sheetId),
    areaId: targetArea.id,
  }));

  const addedLineGroups = imported.lineGroups.map((group) => ({
    ...group,
    id: lineGroupIdMap.get(group.id) || uid('pipe_group'),
    sheetId: remapSheet(group.sheetId),
  }));
  const fallbackGroupId = addedLineGroups[0]?.id || base.lineGroups[0]?.id || '';

  const addedStreams = imported.streams.map((stream) => ({
    ...stream,
    id: streamIdMap.get(stream.id) || uid('line'),
    groupId: lineGroupIdMap.get(stream.groupId) || fallbackGroupId,
    sheetId: remapSheet(stream.sheetId),
    fromEquipmentId: equipmentIdMap.get(stream.fromEquipmentId) || '',
    toEquipmentId: equipmentIdMap.get(stream.toEquipmentId) || '',
    fromSegmentId: remapStreamReference(stream.fromSegmentId),
    toSegmentId: remapStreamReference(stream.toSegmentId),
    fromPipeNodeId: remapPipeNodeReference(stream.fromPipeNodeId),
    toPipeNodeId: remapPipeNodeReference(stream.toPipeNodeId),
    fromReferenceSheet: stream.fromReferenceSheet ? sheetIdMap.get(stream.fromReferenceSheet) || stream.fromReferenceSheet : '',
    toReferenceSheet: stream.toReferenceSheet ? sheetIdMap.get(stream.toReferenceSheet) || stream.toReferenceSheet : '',
    fromReferenceEquipment: remapEquipmentReference(stream.fromReferenceEquipment),
    toReferenceEquipment: remapEquipmentReference(stream.toReferenceEquipment),
  }));

  const addedPipeNodes = imported.pipeNodes.map((node) => ({
    ...node,
    id: pipeNodeIdMap.get(node.id) || uid('pipe_node'),
    groupId: lineGroupIdMap.get(node.groupId) || fallbackGroupId,
    segmentId: streamIdMap.get(node.segmentId) || '',
    inlineComponentId: node.inlineComponentId ? inlineComponentIdMap.get(node.inlineComponentId) || '' : undefined,
  })).filter((node) => node.segmentId);

  const addedInlineComponents = imported.inlineComponents.map((component) => ({
    ...component,
    id: inlineComponentIdMap.get(component.id) || uid('inline'),
    segmentId: streamIdMap.get(component.segmentId) || '',
  })).filter((component) => component.segmentId);

  const addedControls = imported.controls.map((control) => ({
    ...control,
    id: uid('ctl'),
    scope: control.scope || sourceLabel,
    triggerEquipmentId: equipmentIdMap.get(control.triggerEquipmentId) || '',
    actionEquipmentId: equipmentIdMap.get(control.actionEquipmentId) || '',
  }));

  const addedNarratives = imported.narratives.map((item) => ({
    ...item,
    id: uid('nar'),
    subject: item.subject ? `${sourceLabel} / ${item.subject}` : sourceLabel,
  }));

  return {
    project: {
      ...base,
      currentAreaId: targetArea.id,
      currentSheetId: firstSheetId,
      areas: baseAreas.map((area) => (
        area.id === targetArea.id
          ? { ...area, sheets: [...area.sheets, ...addedSheets] }
          : area
      )),
      equipments: [...base.equipments, ...addedEquipments],
      lineGroups: [...base.lineGroups, ...addedLineGroups],
      streams: [...base.streams, ...addedStreams],
      pipeNodes: [...base.pipeNodes, ...addedPipeNodes],
      inlineComponents: [...base.inlineComponents, ...addedInlineComponents],
      controls: [...base.controls, ...addedControls],
      narratives: [...base.narratives, ...addedNarratives],
    },
    firstSheetId,
    firstEquipmentId: addedEquipments[0]?.id || '',
    firstLineGroupId: addedLineGroups[0]?.id || '',
    firstStreamId: addedStreams[0]?.id || '',
    firstControlId: addedControls[0]?.id || '',
    addedSheetCount: addedSheets.length,
    addedEquipmentCount: addedEquipments.length,
    addedStreamCount: addedStreams.length,
  };
};

const readProjectFile = () => new Promise<PidSemanticProject | null>((resolve, reject) => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json';
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) {
      resolve(null);
      return;
    }
    try {
      const project = normalizeProject(JSON.parse(await file.text()) as PidSemanticProject);
      if (project.version !== 'pid-layered-semantic/v1') throw new Error('version mismatch');
      resolve(project);
    } catch (error) {
      reject(error);
    }
  };
  input.click();
});

const requestNetworkProject = async (url: string, options?: RequestInit) => {
  const response = await fetch(url, options);
  const text = await response.text();
  let payload: NetworkProjectPayload;
  try {
    payload = JSON.parse(text) as NetworkProjectPayload;
  } catch {
    payload = { success: false, message: text };
  }
  if (!response.ok || !payload.success) throw new Error(payload.message || `HTTP ${response.status}`);
  return payload;
};

const collectEquipmentRerouteStreamIds = (project: PidSemanticProject, equipmentIds: Set<string>) => {
  const streamIds = new Set<string>();
  project.streams.forEach((stream) => {
    const touchesEquipment = (
      (stream.fromKind === '设备端口' && equipmentIds.has(stream.fromEquipmentId))
      || (stream.toKind === '设备端口' && equipmentIds.has(stream.toEquipmentId))
    );
    if (touchesEquipment) streamIds.add(stream.id);
  });

  let changed = true;
  while (changed) {
    changed = false;
    project.streams.forEach((stream) => {
      if (streamIds.has(stream.id)) return;
      const dependsOnMovedRoute = (
        (stream.fromKind === '管段接点' && streamIds.has(stream.fromSegmentId))
        || (stream.toKind === '管段接点' && streamIds.has(stream.toSegmentId))
      );
      if (!dependsOnMovedRoute) return;
      streamIds.add(stream.id);
      changed = true;
    });
  }
  return streamIds;
};

const resetRoutesForMovedEquipment = (project: PidSemanticProject, equipmentId: string) => {
  const streamIds = collectEquipmentRerouteStreamIds(project, new Set([equipmentId]));
  if (streamIds.size === 0) return project;
  return {
    ...project,
    streams: project.streams.map((stream) => (
      streamIds.has(stream.id)
        ? { ...stream, manualWaypoints: [], pieceWaypoints: {} }
        : stream
    )),
    pipeNodes: project.pipeNodes.map((node) => (
      streamIds.has(node.segmentId) ? { ...node, x: undefined, y: undefined } : node
    )),
    inlineComponents: project.inlineComponents.map((component) => (
      streamIds.has(component.segmentId) ? { ...component, x: undefined, y: undefined } : component
    )),
  };
};

const buildMarkdown = (project: PidSemanticProject) => {
  const semanticIr = projectToAgentSemanticIR(project);
  const canonicalEquipmentByInstanceId = new Map(
    semanticIr.equipments.flatMap((equipment) => equipment.instanceIds.map((instanceId) => [instanceId, equipment] as const)),
  );
  const equipmentById = Object.fromEntries(project.equipments.map((equipment) => [equipment.id, canonicalEquipmentByInstanceId.get(equipment.id) || equipment]));
  const streamById = Object.fromEntries(project.streams.map((stream) => [stream.id, stream]));
  const sheetById = Object.fromEntries(project.areas.flatMap((area) => area.sheets.map((sheet) => [sheet.id, { area, sheet }])));
  const referenceEquipmentLabel = (equipmentRef: string, portRef: string) => {
    const equipment = project.equipments.find((item) => item.id === equipmentRef || item.tag === equipmentRef || item.name === equipmentRef);
    if (!equipment) return [equipmentRef, portRef].filter(Boolean).join('.');
    const port = equipment.ports.find((item) => item.id === portRef || item.name === portRef);
    return `${equipment.tag}${port ? `.${port.id} ${port.name}` : portRef ? `.${portRef}` : ''}`;
  };
  const endpointLabel = (stream: Stream, side: 'from' | 'to') => {
    const kind = side === 'from' ? stream.fromKind : stream.toKind;
    if (kind === '管段接点') {
      const pipeNodeId = side === 'from' ? stream.fromPipeNodeId : stream.toPipeNodeId;
      const pipeNode = project.pipeNodes.find((node) => node.id === pipeNodeId);
      if (pipeNode) return `${pipeNode.tag} ${pipeNode.kind}（${streamById[pipeNode.segmentId]?.tag || pipeNode.segmentId}）`;
      const segmentId = side === 'from' ? stream.fromSegmentId : stream.toSegmentId;
      return `${streamById[segmentId]?.tag || segmentId || '-'} 管段接点`;
    }
    if (isReferenceEndpoint(kind)) {
      const label = side === 'from' ? stream.fromReferenceLabel : stream.toReferenceLabel;
      const area = side === 'from' ? stream.fromReferenceArea : stream.toReferenceArea;
      const sheet = side === 'from' ? stream.fromReferenceSheet : stream.toReferenceSheet;
      const equipment = side === 'from' ? stream.fromReferenceEquipment : stream.toReferenceEquipment;
      const port = side === 'from' ? stream.fromReferencePort : stream.toReferencePort;
      const target = referenceEquipmentLabel(equipment, port);
      const locationInfo = sheetById[sheet];
      const location = locationInfo ? `${locationInfo.area.name}/${locationInfo.sheet.name}` : [area, sheet].filter(Boolean).join('/');
      const fallback = referencePlaceholder(kind, side);
      return [label || fallback, target, location ? `图纸：${location}` : ''].filter(Boolean).join('，');
    }
    const equipment = equipmentById[side === 'from' ? stream.fromEquipmentId : stream.toEquipmentId];
    const portId = side === 'from' ? stream.fromPortId : stream.toPortId;
    return `${equipment?.tag || '-'} ${portLabel(equipment, portId)}`;
  };
  const topologyItemsForSegment = (segmentId: string): PipeTopologyItem[] => ([
    ...project.pipeNodes
      .filter((node) => node.segmentId === segmentId)
      .map((node) => ({
        key: `pipe:${node.id}`,
        segmentId: node.segmentId,
        tag: node.tag,
        kind: node.kind,
        order: node.order,
        positionRatio: node.positionRatio,
      })),
    ...project.inlineComponents
      .filter((component) => component.segmentId === segmentId)
      .map((component) => ({
        key: `inline:${component.id}`,
        segmentId: component.segmentId,
        tag: component.tag,
        kind: component.type,
        order: component.order,
        positionRatio: component.positionRatio,
      })),
  ]);
  const topologyPositionLabel = (key: string, segmentId: string) => {
    const items = topologyItemsForSegment(segmentId);
    const item = items.find((candidate) => candidate.key === key);
    return item ? topologyPreviousLabel(item, items) : '在管段起点之后';
  };
  const lines: string[] = [];
  lines.push('# P&ID 分层语义上下文');
  lines.push('');
  lines.push('## 建模原则');
  lines.push('- 结构化语义是事实来源，画布只是几何视图。');
  lines.push('- 按项目/工段/图纸/设备/物流/控制联锁/工艺叙事分层组织，工段即系统边界。');
  lines.push('- JSON 用于精确解析，Markdown 用于大模型快速阅读。');
  lines.push('');
  lines.push('## 图纸信息');
  lines.push(`- 项目：${project.project.name}`);
  lines.push(`- 图纸号：${project.project.drawingNo}`);
  lines.push(`- 责任方：${project.project.owner}`);
  lines.push(`- 设计边界：${project.project.designBasis || '-'}`);
  lines.push('');
  lines.push('## 工段');
  project.areas.forEach((area) => {
    lines.push(`### ${area.name}`);
    lines.push(`- 工艺范围：${area.objective || '-'}`);
    area.sheets.forEach((sheet) => lines.push(`- 图纸：${sheet.name}。${sheet.description || '-'}`));
  });
  lines.push('');
  lines.push('## 设备');
  semanticIr.equipments.forEach((equipment) => {
    lines.push(`### ${equipment.tag} ${equipment.name}`);
    lines.push(`- 类型：${EQUIPMENT_LABELS[equipment.type]}`);
    lines.push(`- 所属工段/系统：${equipment.systemName || '-'}`);
    lines.push(`- 画布实例：${equipment.drawingInstances.map((instance) => `${instance.areaName}/${instance.sheetName}`).join('；') || '-'}`);
    lines.push(`- 材质：${equipment.material || '-'}`);
    lines.push(`- 描述：${equipment.description || '-'}`);
    lines.push(`- 核心功能：${equipment.profile.coreFunction || '-'}`);
    lines.push(`- 工作原理：${equipment.profile.workingPrinciple || '-'}`);
    const attributes = Object.entries(equipment.attributes).map(([key, value]) => `${key}=${value || '-'}`).join('；');
    if (attributes) lines.push(`- 设备属性：${attributes}`);
    lines.push('');
    lines.push('| 内部ID | 类别 | 类型 | 名称 | 相态 | 作用 |');
    lines.push('| --- | --- | --- | --- | --- | --- |');
    equipment.parts.forEach((part) => {
      lines.push(`| ${part.id} | ${PART_CATEGORIES.find((item) => item.value === part.category)?.label || part.category} | ${part.type} | ${part.name} | ${part.phase} | ${part.role || '-'} |`);
    });
    lines.push('');
    lines.push('| 端口 | 名称 | 挂接组成 | 方向 | 物流角色 | 介质 |');
    lines.push('| --- | --- | --- | --- | --- | --- |');
    equipment.ports.forEach((port) => {
      lines.push(`| ${equipment.tag}.${port.id} | ${port.name} | ${partLabel(equipment, port.ownerPartId)} | ${port.direction} | ${port.role} | ${port.medium || '-'} |`);
    });
    lines.push('');
    lines.push('| 内部关系 | 关系 | 目标 | 说明 |');
    lines.push('| --- | --- | --- | --- |');
    equipment.relations.forEach((relation) => {
      lines.push(`| ${partLabel(equipment, relation.sourcePartId)} | ${relation.relation} | ${partLabel(equipment, relation.targetPartId)} | ${relation.description || '-'} |`);
    });
    lines.push('');
  });
  lines.push('## 物流/管线网络');
  project.lineGroups.forEach((group) => {
    const groupStreams = project.streams.filter((stream) => stream.groupId === group.id);
    lines.push(`### ${group.tag} ${group.name}`);
    lines.push(`- 类型：${group.role}`);
    lines.push(`- 介质：${group.medium || '-'}`);
    lines.push(`- 流向模式：${group.directionMode}`);
    lines.push(`- 工艺目的：${group.purpose || '-'}`);
    lines.push(`- 边界入口：${group.boundaryIn || '-'}`);
    lines.push(`- 边界出口：${group.boundaryOut || '-'}`);
    if (group.directionMode !== '单向') lines.push(`- 反向条件：${group.reverseCondition || '-'}`);
    lines.push('');
    lines.push('| 管段 | 名称 | 分支类型 | 流向 | 起点 | 终点 | 介质 | DN | PN | 材质 | 工艺意图 |');
    lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
    groupStreams.forEach((stream) => {
      lines.push(`| ${stream.tag} | ${stream.name || '-'} | ${stream.branchType} | ${stream.directionMode} | ${endpointLabel(stream, 'from')} | ${endpointLabel(stream, 'to')} | ${stream.medium || group.medium || '-'} | ${stream.dn || '-'} | ${stream.pn || '-'} | ${stream.material || '-'} | ${stream.intent || '-'} |`);
    });
    lines.push('');
    const components = project.inlineComponents.filter((component) => groupStreams.some((stream) => stream.id === component.segmentId));
    if (components.length) {
      lines.push('| 在线元件 | 类型 | 名称 | 所在管段 | 位置 | 常态 | 执行机构 | 控制信号 | 说明 |');
      lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
      components.forEach((component) => {
        const segment = streamById[component.segmentId];
        lines.push(`| ${component.tag} | ${component.type} | ${component.name || '-'} | ${segment?.tag || '-'} | ${topologyPositionLabel(`inline:${component.id}`, component.segmentId)} | ${inlineNormalState(component) || '-'} | ${inlineActuator(component) || '-'} | ${component.controlSignal || '-'} | ${component.description || '-'} |`);
      });
      lines.push('');
    }
    const pipeNodes = project.pipeNodes.filter((node) => groupStreams.some((stream) => stream.id === node.segmentId));
    if (pipeNodes.length) {
      lines.push('| 管线节点 | 类型 | 名称 | 所在管段 | 位置 | 说明 |');
      lines.push('| --- | --- | --- | --- | --- | --- |');
      pipeNodes.forEach((node) => {
        const segment = streamById[node.segmentId];
        lines.push(`| ${node.tag} | ${node.kind} | ${node.name || '-'} | ${segment?.tag || '-'} | ${topologyPositionLabel(`pipe:${node.id}`, node.segmentId)} | ${node.description || '-'} |`);
      });
      lines.push('');
    }
  });
  lines.push('');
  lines.push('## 控制与联锁');
  lines.push('| 类型 | 位号 | 范围 | 触发对象 | 触发条件 | 动作对象 | 动作 | 保护目的 | 复位 |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  project.controls.forEach((control) => {
    const triggerEquipment = equipmentById[control.triggerEquipmentId];
    const actionEquipment = equipmentById[control.actionEquipmentId];
    lines.push(`| ${control.kind} | ${control.tag} | ${control.scope || '-'} | ${triggerEquipment?.tag || '-'} ${partLabel(triggerEquipment, control.triggerPartId)} | ${control.condition || '-'} | ${actionEquipment?.tag || '-'} ${partLabel(actionEquipment, control.actionTargetId)} | ${control.action || '-'} | ${control.purpose || '-'} | ${control.reset || '-'} |`);
  });
  lines.push('');
  lines.push('## 工艺叙事');
  project.narratives.forEach((item) => {
    lines.push(`- ${item.level} / ${item.subject}：${item.reviewed || item.generated || '-'}`);
  });
  return lines.join('\n');
};

const X6_CANVAS_WIDTH = 2200;
const X6_CANVAS_HEIGHT = 1400;
const REFERENCE_NODE_WIDTH = 140;
const REFERENCE_NODE_HEIGHT = 28;
const equipmentPortPositionArgs = (equipment: Equipment, port: ExternalPort) => ({
  x: equipment.width * port.x / 100,
  y: equipment.height * port.y / 100,
});
const equipmentPortItems = (equipment: Equipment) => equipment.ports.map((port) => {
  const args = equipmentPortPositionArgs(equipment, port);
  return {
    id: port.id,
    group: 'absolute',
    args,
    position: { name: 'absolute', args },
    attrs: { text: { text: port.id } },
  };
});

function PidSemanticX6Canvas({
  project,
  sheetEquipments,
  sheetStreams,
  selectedEquipmentId,
  selectedStreamId,
  getStreamRoute,
  referenceEndpointText,
  onSelectEquipment,
  onSelectStream,
  onOpenEquipment,
  onOpenStreams,
  onEquipmentMove,
  onEquipmentResize,
  onReferenceMove,
  onStreamWaypointsChange,
  onInlineComponentMove,
  onPipeNodeMove,
  onStreamEndpointMove,
  onEquipmentPortMove,
  onCreateStreamFromPorts,
  onCreateInlineComponentAt,
  onCreatePipeNodeAt,
  onCreatePipeStreamFromPoint,
  onCreatePipeStreamFromPort,
  onCompletePipeStreamEndpoint,
  onPatchStream,
  onPatchInlineComponent,
  onDeleteEquipment,
  onDeleteStream,
  onDeleteInlineComponent,
}: X6CanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<Graph | null>(null);
  const [pipeContextMenu, setPipeContextMenu] = useState<PipeContextMenuState | null>(null);
  const [portContextMenu, setPortContextMenu] = useState<PortContextMenuState | null>(null);
  const [portTooltip, setPortTooltip] = useState<PortTooltipState | null>(null);
  const [streamTooltip, setStreamTooltip] = useState<StreamTooltipState | null>(null);
  const [deviceContextMenu, setDeviceContextMenu] = useState<DeviceContextMenuState | null>(null);
  const [inlineComponentContextMenu, setInlineComponentContextMenu] = useState<InlineComponentContextMenuState | null>(null);
  const [pipeEditPanel, setPipeEditPanel] = useState<PipeEditPanelState | null>(null);
  const [referenceEndpointEditPanel, setReferenceEndpointEditPanel] = useState<ReferenceEndpointEditPanelState | null>(null);
  const [inlineComponentEditPanel, setInlineComponentEditPanel] = useState<InlineComponentEditPanelState | null>(null);
  const [pendingPipeEndpoint, setPendingPipeEndpoint] = useState<PendingPipeEndpointState | null>(null);
  const syncingRef = useRef(false);
  const draggingPortRef = useRef<{ equipmentId: string; portId: string; x: number; y: number } | null>(null);
  const portDraftRef = useRef<Record<string, Record<string, Point>>>({});
  const pendingEdgeRouteRef = useRef<{ streamId: string; waypoints: Point[]; pieceIndex?: number } | null>(null);
  const canvasRoutesRef = useRef<Map<string, CanvasPipeRoute>>(new Map());
  const snappingPipeNodeRef = useRef(false);
  const resizingEquipmentRef = useRef('');
  const transformPluginRef = useRef<Transform | null>(null);
  const clearCanvasCellViews = useCallback(() => {
    containerRef.current
      ?.querySelectorAll('.x6-graph-svg .x6-cell')
      .forEach((element) => element.remove());
  }, []);
  const clearCanvasTransientUi = useCallback((includeTransform = false) => {
    const graph = graphRef.current;
    graph?.getEdges().forEach((edge) => edge.removeTools());
    (graph as (Graph & { cleanSelection?: () => Graph }) | null)?.cleanSelection?.();
    if (includeTransform) transformPluginRef.current?.clearWidgets();
    const selectors = [
      '.x6-cell-tool',
      '.x6-edge-tool',
      '.x6-widget-selection',
      '.x6-widget-selection-box',
      '.x6-widget-vertices',
      '.x6-widget-segments',
      ...(includeTransform ? ['.x6-widget-transform'] : []),
    ];
    containerRef.current
      ?.querySelectorAll(selectors.join(', '))
      .forEach((element) => element.remove());
  }, []);
  const equipmentWithDraftPorts = (equipment: Equipment) => {
    const drafts = portDraftRef.current[equipment.id] || {};
    return {
      ...equipment,
      ports: equipment.ports.map((port) => ({ ...port, ...(drafts[port.id] || {}) })),
    };
  };
  const syncEquipmentPortDomTransforms = (node: Node, equipment: Equipment) => {
    const size = node.size();
    const nodeView = graphRef.current?.findViewByCell(node) as unknown as { container?: Element } | undefined;
    const portElements = Array.from(nodeView?.container?.querySelectorAll('[port]') || []);
    equipmentWithDraftPorts(equipment).ports.forEach((port) => {
      const args = { x: size.width * port.x / 100, y: size.height * port.y / 100 };
      const portBody = portElements.find((element) => element.getAttribute('port') === port.id);
      portBody?.parentElement?.setAttribute('transform', `matrix(1,0,0,1,${args.x},${args.y})`);
    });
  };
	  const syncEquipmentPortDraftsToNode = (node: Node, equipment: Equipment) => {
	    const graph = graphRef.current;
	    const portEquipment = equipmentWithDraftPorts(equipment);
	    node.prop('ports/items', equipmentPortItems(portEquipment));
    const nodeView = graph?.findViewByCell(node) as unknown as { update?: () => void; renderPorts?: () => void } | undefined;
    nodeView?.renderPorts?.();
    nodeView?.update?.();
    syncEquipmentPortDomTransforms(node, equipment);
    graph?.getConnectedEdges(node).forEach((edge) => {
      (graph.findViewByCell(edge) as unknown as { update?: () => void })?.update?.();
    });
    window.requestAnimationFrame(() => {
      syncEquipmentPortDomTransforms(node, equipment);
      graph?.getConnectedEdges(node).forEach((edge) => {
        (graph.findViewByCell(edge) as unknown as { update?: () => void })?.update?.();
	      });
	    });
	  };
	  const pipeNodeRouteAnchor = (node: Node) => {
	    const data = node.getData() as { routeAnchor?: Point };
	    const size = node.size();
	    return data.routeAnchor || { x: size.width / 2, y: size.height / 2 };
	  };
	  const pipeNodeRoutePoint = (node: Node) => {
	    const bbox = node.getBBox();
	    const anchor = pipeNodeRouteAnchor(node);
	    return { x: bbox.x + anchor.x, y: bbox.y + anchor.y };
	  };
	  const positionPipeNodeAtRoutePoint = (node: Node, point: Point, options?: Record<string, unknown>) => {
	    const anchor = pipeNodeRouteAnchor(node);
	    node.position(point.x - anchor.x, point.y - anchor.y, options);
	  };
	  const edgeRouteSnapshot = (edge: Edge) => {
    const data = edge.getData() as { streamId?: string; renderedStreamId?: string; splitByInline?: boolean; pieceIndex?: number };
    if (!data.streamId) return null;
    const edgeView = graphRef.current?.findViewByCell(edge) as unknown as {
      sourcePoint?: { x: number; y: number };
      targetPoint?: { x: number; y: number };
    } | undefined;
    const sourcePoint = edgeView?.sourcePoint ? { x: snapToGrid(edgeView.sourcePoint.x), y: snapToGrid(edgeView.sourcePoint.y) } : undefined;
    const targetPoint = edgeView?.targetPoint ? { x: snapToGrid(edgeView.targetPoint.x), y: snapToGrid(edgeView.targetPoint.y) } : undefined;
    const vertices = edge.getVertices().map((point) => ({ x: snapToGrid(point.x), y: snapToGrid(point.y) }));
    const route = compactRoutePoints([
      ...(sourcePoint ? [sourcePoint] : []),
      ...vertices,
      ...(targetPoint ? [targetPoint] : []),
    ]);
    return {
      streamId: data.streamId,
      renderedStreamId: data.renderedStreamId,
      route,
      waypoints: route.slice(1, -1),
      pieceIndex: data.splitByInline ? data.pieceIndex : undefined,
    };
  };
  const syncAttachedPipeNodesToEdge = (edge: Edge) => {
    const graph = graphRef.current;
    if (!graph) return;
    const snapshot = edgeRouteSnapshot(edge);
    if (!snapshot) return;
    const stream = sheetStreams.find((item) => item.id === snapshot.renderedStreamId)
      || sheetStreams.find((item) => item.id === snapshot.streamId || item.sourceStreamId === snapshot.streamId);
    if (!stream) return;
    const route = snapshot.route;
    canvasRoutesRef.current.set(stream.id, { stream, route });
    const nodes = sortTopologyItems(
      buildRenderPipeNodes(project, sheetStreams).filter((node) => node.segmentId === stream.id),
    );
	    nodes.forEach((node) => {
	      const graphNode = graph.getCellById(pipeNodeGraphId(node.id));
	      if (!graphNode?.isNode()) return;
	      const point = pointAtRatio(route, topologyAutoRatio(node, nodes));
	      positionPipeNodeAtRoutePoint(graphNode, point, { ui: true });
	    });
	  };
  const nearestStreamAttachment = (point: Point, preferredStreamId = '', blockedStreamIds: string[] = []) => {
    const blockedIds = blockedStreamIds.filter(Boolean);
    const candidates = Array.from(canvasRoutesRef.current.values())
      .filter(({ stream }) => !blockedIds.some((streamId) => streamMatchesId(stream, streamId)))
      .map(({ stream, route }) => {
        const attachment = nearestPointOnRoute(route, point);
        return attachment ? { stream, route, ...attachment } : null;
      })
      .filter(Boolean) as Array<{ stream: CanvasStream; route: Point[]; point: Point; ratio: number; distance: number }>;
    const preferred = candidates.find((candidate) => preferredStreamId && streamMatchesId(candidate.stream, preferredStreamId));
    const nearest = candidates.sort((left, right) => left.distance - right.distance)[0];
    return nearest && nearest.distance <= 44 ? nearest : preferred || nearest || null;
  };
  const completePendingPipeEndpoint = (target: PipeEndpointSelectionTarget) => {
    if (!pendingPipeEndpoint) return false;
    onCompletePipeStreamEndpoint(pendingPipeEndpoint.streamId, pendingPipeEndpoint.side, target);
    setPendingPipeEndpoint(null);
    setPipeContextMenu(null);
    setDeviceContextMenu(null);
    setReferenceEndpointEditPanel(null);
    setInlineComponentContextMenu(null);
    setInlineComponentEditPanel(null);
    return true;
  };
  const endpointSelectionFromEdge = (edge: Edge, event: MouseEvent): PipeEndpointSelectionTarget | null => {
    const data = edge.getData() as { streamId?: string; renderedStreamId?: string };
    const routeId = data.renderedStreamId || data.streamId;
    const canvasRoute = routeId ? canvasRoutesRef.current.get(routeId) : undefined;
    if (!canvasRoute) return null;
    const streamId = canvasRoute.stream.sourceStreamId || canvasRoute.stream.id;
    const local = graphRef.current?.clientToLocal(event.clientX, event.clientY);
    if (pendingPipeEndpoint && streamId === pendingPipeEndpoint.streamId) {
      const fallback = local ? nearestStreamAttachment(local, '', [pendingPipeEndpoint.streamId]) : null;
      return fallback
        ? { kind: '管段接点', segmentId: fallback.stream.sourceStreamId || fallback.stream.id, ratio: clampPercent(Math.round(fallback.ratio)) }
        : null;
    }
    const attachment = local ? nearestPointOnRoute(canvasRoute.route, local) : null;
    if (!attachment) return null;
    return { kind: '管段接点', segmentId: streamId, ratio: clampPercent(Math.round(attachment.ratio)) };
  };

  useEffect(() => {
    if (!containerRef.current) return;
    const graph = new Graph({
      container: containerRef.current,
      width: X6_CANVAS_WIDTH,
      height: X6_CANVAS_HEIGHT,
      grid: {
        size: 10,
        visible: true,
        type: 'doubleMesh',
        args: [{ color: '#e8f1ff', thickness: 1 }, { color: '#cfe0f5', thickness: 1, factor: 4 }],
      },
      background: { color: '#ffffff' },
      panning: { enabled: true, eventTypes: ['rightMouseDown'] },
      mousewheel: { enabled: true, modifiers: ['ctrl', 'meta'], factor: 1.08, maxScale: 2.2, minScale: 0.35 },
      connecting: {
        router: { name: 'normal' },
        connector: { name: 'normal' },
        anchor: 'center',
        connectionPoint: 'anchor',
        allowBlank: false,
        allowLoop: false,
        allowNode: false,
        allowEdge: false,
        allowPort: true,
        allowMulti: 'withPort',
        highlight: true,
        snap: { radius: 24 },
        validateMagnet: ({ e }) => {
          const event = e as unknown as MouseEvent;
          return Boolean(event.shiftKey || event.altKey);
        },
        validateConnection: ({ sourceCell, targetCell, sourcePort, targetPort }) => (
          Boolean(sourceCell && targetCell && sourceCell !== targetCell && sourcePort && targetPort)
        ),
        createEdge() {
          return this.createEdge({
            shape: 'edge',
            zIndex: 1,
            router: { name: 'normal' },
            connector: { name: 'normal' },
            attrs: {
              line: {
                stroke: '#1677ff',
                strokeWidth: 2,
                targetMarker: { name: 'block', width: 8, height: 6 },
              },
            },
          });
        },
      },
      interacting: {
        nodeMovable: ({ cell }) => {
          const data = cell?.getData?.() as { kind?: string } | undefined;
          return draggingPortRef.current == null && data?.kind !== 'crossing';
        },
        magnetConnectable: true,
        edgeMovable: false,
      },
    });

    graph.use(new Selection({
      enabled: true,
      multiple: false,
      rubberband: false,
      movable: false,
      showNodeSelectionBox: true,
    }));
    const transformPlugin = new Transform({
      resizing: {
        enabled: (node) => {
          const data = node.getData() as { kind?: string };
          return data.kind === 'equipment';
        },
        minWidth: EQUIPMENT_MIN_WIDTH,
        minHeight: EQUIPMENT_MIN_HEIGHT,
        maxWidth: HEADER_MAX_WIDTH,
        maxHeight: EQUIPMENT_MAX_HEIGHT,
        orthogonal: true,
        preserveAspectRatio: false,
        allowReverse: false,
      },
      rotating: false,
    });
    graph.use(transformPlugin);
    transformPluginRef.current = transformPlugin;

    graphRef.current = graph;
    return () => {
      clearCanvasTransientUi(true);
      transformPluginRef.current = null;
      graph.dispose();
      graphRef.current = null;
    };
  }, [clearCanvasTransientUi]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;
    syncingRef.current = true;
	    try {
		      clearCanvasTransientUi(true);
		      graph.clearCells();
		      clearCanvasCellViews();

    const referenceNodeId = (stream: CanvasStream, side: 'from' | 'to') => `ref:${stream.id}:${side}`;
    const equipmentIdSet = new Set(sheetEquipments.map((equipment) => equipment.id));
    const pipeNodesByStream = new Map<string, RenderPipeNode[]>();
    const renderPipeNodes = buildRenderPipeNodes(project, sheetStreams);
    renderPipeNodes.forEach((node) => {
      const next = pipeNodesByStream.get(node.segmentId) || [];
      next.push(node);
      pipeNodesByStream.set(node.segmentId, next);
    });
    const canvasRoutes = new Map<string, CanvasPipeRoute>();
    sheetStreams.forEach((stream) => {
      const route = getStreamRoute(stream);
      if (route?.length) {
        const simplifiedRoute = simplifyOrthogonalRoute(route, sheetEquipments);
        canvasRoutes.set(stream.id, {
          stream,
          route: stream.manualWaypoints?.length ? simplifiedRoute : cleanSmallRouteDetours(simplifiedRoute, sheetEquipments),
        });
      }
    });
    const adjustedRoutes = avoidDisplayRouteOverlaps(Array.from(canvasRoutes.values()), sheetEquipments);
    canvasRoutes.clear();
    adjustedRoutes.forEach((route) => canvasRoutes.set(route.stream.id, route));
    canvasRoutesRef.current = canvasRoutes;
    const referenceStreams = sheetStreams.flatMap((stream) => ([
      { stream, side: 'from' as const, kind: stream.fromKind, x: stream.fromReferenceX, y: stream.fromReferenceY },
      { stream, side: 'to' as const, kind: stream.toKind, x: stream.toReferenceX, y: stream.toReferenceY },
    ])).filter((endpoint) => isReferenceEndpoint(endpoint.kind));

    sheetEquipments.forEach((equipment) => {
      const node = graph.addNode({
        id: equipment.id,
        x: equipment.x,
        y: equipment.y,
        width: equipment.width,
        height: equipment.height,
        shape: 'rect',
        zIndex: 10,
        data: { kind: 'equipment', equipmentId: equipment.id },
        attrs: {
          body: {
            fill: equipment.id === selectedEquipmentId ? '#eaf3ff' : '#ffffff',
            stroke: equipment.id === selectedEquipmentId ? '#1677ff' : '#1f3b57',
            strokeWidth: equipment.id === selectedEquipmentId ? 2 : 1.2,
            rx: 4,
            ry: 4,
          },
          label: {
            text: `${equipment.tag}\n${equipment.name}`,
            fill: '#0f172a',
            fontSize: 12,
            fontWeight: 600,
            lineHeight: 16,
          },
        },
        ports: {
          groups: {
            absolute: {
              position: { name: 'absolute' },
              attrs: {
                circle: { r: 5, magnet: true, fill: '#1677ff', stroke: '#ffffff', strokeWidth: 1.5, cursor: 'move' },
                text: { fill: '#334155', fontSize: 10, textAnchor: 'middle', textVerticalAnchor: 'middle' },
              },
              label: { position: { name: 'inside', args: { offset: 12 } } },
            },
          },
          items: equipmentPortItems(equipmentWithDraftPorts(equipment)),
        },
      });
      if (equipment.id === selectedEquipmentId) graph.select(node);
    });

    referenceStreams.forEach(({ stream, side, kind, x, y }) => {
      graph.addNode({
        id: referenceNodeId(stream, side),
        x: x - REFERENCE_NODE_WIDTH / 2,
        y: y - REFERENCE_NODE_HEIGHT / 2,
        width: REFERENCE_NODE_WIDTH,
        height: REFERENCE_NODE_HEIGHT,
        shape: 'rect',
        zIndex: 12,
        data: {
          kind: 'reference',
          streamId: stream.sourceStreamId || stream.id,
          renderedStreamId: stream.id,
          side,
          sourceSide: stream.virtual && stream.continuationSide ? stream.continuationSide : side,
          endpointKind: kind,
        },
        attrs: {
          body: {
            fill: kind === '界外来源' ? '#f0fdf4' : kind === '界外去向' ? '#fff7ed' : '#eff6ff',
            stroke: kind === '界外来源' ? '#16a34a' : kind === '界外去向' ? '#f97316' : '#2563eb',
            strokeWidth: 1.2,
            strokeDasharray: '4 3',
            rx: 4,
            ry: 4,
          },
          label: {
            text: `${side === 'from' ? '入' : '出'} ${referenceEndpointText(stream, side)}`,
            fill: kind === '界外来源' ? '#15803d' : kind === '界外去向' ? '#c2410c' : '#1d4ed8',
            fontSize: 11,
            fontWeight: 700,
          },
        },
        ports: {
          groups: {
            center: {
              position: { name: 'absolute' },
              attrs: { circle: { r: 1, magnet: false, fill: 'transparent', stroke: 'transparent' } },
            },
          },
          items: [{ id: 'p', group: 'center', args: { x: '50%', y: '50%' } }],
        },
      });
    });

    const endpointTerminal = (stream: CanvasStream, side: 'from' | 'to') => {
      const kind = side === 'from' ? stream.fromKind : stream.toKind;
      if (kind === '设备端口') {
        const equipmentId = side === 'from' ? stream.fromEquipmentId : stream.toEquipmentId;
        const portId = side === 'from' ? stream.fromPortId : stream.toPortId;
        return equipmentIdSet.has(equipmentId) && portId ? { cell: equipmentId, port: portId } : undefined;
      }
      if (kind === '管段接点') {
        const route = canvasRoutes.get(stream.id)?.route;
        const point = side === 'from' ? route?.[0] : route?.[route.length - 1];
        return point ? { x: point.x, y: point.y } : undefined;
      }
      if (isReferenceEndpoint(kind)) return { cell: referenceNodeId(stream, side), port: 'p' };
      return undefined;
    };

    pipeNodesByStream.forEach((nodes, streamId) => {
      const stream = sheetStreams.find((item) => item.id === streamId);
      const route = stream ? canvasRoutes.get(stream.id)?.route : null;
      if (!stream || !route) return;
      const orderedNodes = sortTopologyItems(nodes);
      orderedNodes
        .forEach((node) => {
          const ratio = topologyAutoRatio(node, orderedNodes);
          const point = pointAtRatio(route, ratio);
          const isInline = node.kind === '在线元件';
	          const inlineType = node.inlineType || '手动阀';
	          const routeAxis = routeAxisAtRatio(route, ratio);
	          const inlineVisual = isInline ? orientInlineComponentVisual(inlineComponentVisual(inlineType, node.tag), inlineType, routeAxis) : null;
	          const size = inlineVisual?.size || { width: 5, height: 5 };
	          const routeAnchor = inlineVisual?.routeAnchor || { x: size.width / 2, y: size.height / 2 };
	          graph.addNode({
	            id: pipeNodeGraphId(node.id),
	            x: point.x - routeAnchor.x,
	            y: point.y - routeAnchor.y,
	            width: size.width,
	            height: size.height,
	            shape: inlineVisual?.shape || 'circle',
            ...(inlineVisual?.markup ? { markup: inlineVisual.markup } : {}),
            zIndex: 20,
            data: {
              kind: 'pipe-node',
              renderNodeId: node.id,
              pipeNodeId: node.source === 'semantic' ? node.id : undefined,
              pipeNodeSource: node.source,
              pipeNodeKind: node.kind,
              componentId: node.inlineComponentId,
              segmentId: node.segmentId,
              renderedStreamId: stream.id,
	              streamId: node.streamId,
	              blockedStreamIds: node.blockedStreamIds || (node.streamId ? [node.streamId] : []),
	              side: node.side,
	              routeAnchor,
	            },
	            attrs: (inlineVisual?.attrs || {
	              body: {
	                fill: node.kind === '汇入点' ? '#2563eb' : '#0f766e',
	                stroke: node.kind === '汇入点' ? '#2563eb' : '#0f766e',
                strokeWidth: 0,
              },
              label: {
                text: '',
                fill: '#0f766e',
                fontSize: 8,
                fontWeight: 700,
              },
              text: {
                text: '',
                fill: '#0f766e',
                fontSize: 8,
	                fontWeight: 700,
	              },
	            }) as Cell.Metadata['attrs'],
	          });
        });
    });

    sheetStreams.forEach((stream) => {
      const source = endpointTerminal(stream, 'from');
      const target = endpointTerminal(stream, 'to');
      if (!source || !target) return;
      const active = selectedStreamId === (stream.sourceStreamId || stream.id);
      const displayRoute = canvasRoutes.get(stream.id)?.route;
      const lineColor = streamLineColor(stream);

      const edge = graph.addEdge({
        id: stream.id,
        source,
        target,
        zIndex: 1,
        router: { name: 'normal' },
        connector: { name: 'normal' },
        vertices: displayRoute
          ? compactRouteInteriorPoints(displayRoute.slice(1, -1), displayRoute[0], displayRoute[displayRoute.length - 1])
          : stream.manualWaypoints || [],
        data: {
          kind: 'stream',
          streamId: stream.sourceStreamId || stream.id,
          renderedStreamId: stream.id,
          splitByInline: false,
        },
        attrs: {
          line: {
            stroke: lineColor,
            strokeWidth: active ? 3 : 2,
            targetMarker: { name: 'block', width: 8, height: 6 },
            sourceMarker: stream.directionMode === '双向' ? { name: 'block', width: 8, height: 6 } : undefined,
            title: `${streamDisplayLabel(stream)} ${stream.branchType}${stream.medium ? ` / ${stream.medium}` : ''}`,
          },
        },
        labels: [],
      });
      if (active) {
        graph.select(edge);
      }
    });

    computeRouteCrossings(Array.from(canvasRoutes.values())).forEach((crossing, index) => {
      const color = streamLineColor(crossing.horizontalStream);
      const verticalColor = streamLineColor(crossing.verticalStream);
      graph.addNode({
        id: `crossing:${index}:${crossing.point.x}:${crossing.point.y}`,
        x: crossing.point.x - 8,
        y: crossing.point.y - 8,
        width: 16,
        height: 16,
        shape: 'rect',
        zIndex: 5,
        markup: [
          { tagName: 'rect', selector: 'body' },
          { tagName: 'path', selector: 'break' },
          { tagName: 'path', selector: 'underpass' },
          { tagName: 'path', selector: 'bridge' },
        ],
        data: { kind: 'crossing' },
        attrs: {
          body: { fill: 'transparent', stroke: 'transparent', refWidth: '100%', refHeight: '100%', pointerEvents: 'none' },
          break: { d: 'M 2 8 L 14 8', fill: 'none', stroke: '#ffffff', strokeWidth: 5, strokeLinecap: 'round', pointerEvents: 'none' },
          underpass: { d: 'M 8 0 L 8 16', fill: 'none', stroke: verticalColor, strokeWidth: 2, strokeLinecap: 'round', pointerEvents: 'none' },
          bridge: { d: 'M 2 8 C 5 2 11 2 14 8', fill: 'none', stroke: color, strokeWidth: 2.1, strokeLinecap: 'round', pointerEvents: 'none' },
        },
      });
    });

    } finally {
      syncingRef.current = false;
    }
  }, [project, sheetEquipments, sheetStreams, selectedEquipmentId, selectedStreamId, getStreamRoute, referenceEndpointText, clearCanvasCellViews, clearCanvasTransientUi]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;
    const clearEdgeTools = () => {
      clearCanvasTransientUi();
    };
    const addEdgeTools = (edge: Edge) => {
      clearEdgeTools();
      addPipeEdgeTools(edge);
    };
    const streamForEdge = (edge: Edge) => {
      const data = edge.getData() as { streamId?: string; renderedStreamId?: string };
      const streamId = data.renderedStreamId || data.streamId;
      return streamId ? sheetStreams.find((stream) => stream.id === streamId || stream.sourceStreamId === streamId) : undefined;
    };
    type PipeNodeCellData = {
      kind?: string;
      renderNodeId?: string;
      pipeNodeKind?: PipeNodeKind;
      pipeNodeId?: string;
      pipeNodeSource?: 'semantic' | 'inline' | 'endpoint';
      componentId?: string;
      segmentId?: string;
	      renderedStreamId?: string;
	      streamId?: string;
	      side?: 'from' | 'to';
	      blockedStreamIds?: string[];
	      routeAnchor?: Point;
	    };
    const blockedPipeNodeAttachmentStreamIds = (data: PipeNodeCellData) => (
      data.pipeNodeKind === '分出点' || data.pipeNodeKind === '汇入点' || data.pipeNodeKind === '支管点'
        ? Array.from(new Set([...(data.blockedStreamIds || []), data.streamId || ''].filter(Boolean)))
        : []
    );
	    const placePipeNodeOnPoint = (node: Node, point: Point) => {
	      snappingPipeNodeRef.current = true;
	      positionPipeNodeAtRoutePoint(node, point, { ui: true });
	      snappingPipeNodeRef.current = false;
	    };
    const resetPipeNodeToCurrentRoute = (node: Node, data: PipeNodeCellData) => {
      const streamId = data.renderedStreamId || data.segmentId;
      const canvasRoute = streamId ? canvasRoutesRef.current.get(streamId) : undefined;
      if (!canvasRoute) return;
      const currentNodes = sortTopologyItems(
        buildRenderPipeNodes(project, sheetStreams).filter((item) => item.segmentId === canvasRoute.stream.id),
      );
      const renderNodeId = data.renderNodeId || String(node.id || '').replace(/^pipe-node:/, '');
      const renderNode = currentNodes.find((item) => item.id === renderNodeId);
      if (!renderNode) return;
      placePipeNodeOnPoint(node, pointAtRatio(canvasRoute.route, topologyAutoRatio(renderNode, currentNodes)));
    };
    const snapPipeNodeToRoute = (node: Node) => {
	      const data = node.getData() as PipeNodeCellData;
	      if (data.kind !== 'pipe-node') return null;
	      const routePoint = pipeNodeRoutePoint(node);
	      const center = { x: snapToGrid(routePoint.x), y: snapToGrid(routePoint.y) };
      const attachment = nearestStreamAttachment(
        center,
        data.renderedStreamId || data.segmentId,
        blockedPipeNodeAttachmentStreamIds(data),
      );
      if (!attachment) {
        resetPipeNodeToCurrentRoute(node, data);
        return null;
      }
      placePipeNodeOnPoint(node, attachment.point);
      return attachment;
    };
	    const pipeNodePositionHandler = ({ node }: { node: Node }) => {
	      if (syncingRef.current || snappingPipeNodeRef.current) return;
	      snapPipeNodeToRoute(node);
	    };
	    const equipmentResizeStartHandler = ({ node }: { node: Node }) => {
	      const data = node.getData() as { kind?: string; equipmentId?: string };
	      if (data.kind !== 'equipment' || !data.equipmentId) return;
	      resizingEquipmentRef.current = data.equipmentId;
	    };
	    const equipmentResizingHandler = ({ node }: { node: Node }) => {
	      if (syncingRef.current) return;
	      const data = node.getData() as { kind?: string; equipmentId?: string };
	      if (data.kind !== 'equipment' || !data.equipmentId) return;
	      const equipment = sheetEquipments.find((item) => item.id === data.equipmentId);
	      if (equipment) syncEquipmentPortDomTransforms(node, equipment);
	      graph.getConnectedEdges(node).forEach((edge) => {
	        (graph.findViewByCell(edge) as unknown as { update?: () => void })?.update?.();
	      });
	    };
	    const equipmentResizedHandler = ({ node }: { node: Node }) => {
	      if (syncingRef.current) return;
	      const data = node.getData() as { kind?: string; equipmentId?: string };
	      resizingEquipmentRef.current = '';
	      if (data.kind !== 'equipment' || !data.equipmentId) return;
	      const position = node.position();
	      const size = node.size();
	      const equipment = project.equipments.find((item) => item.id === data.equipmentId);
	      const width = Math.min(equipmentWidthLimit(equipment?.type || 'reactor'), Math.max(EQUIPMENT_MIN_WIDTH, snapToGrid(size.width)));
	      const height = Math.min(EQUIPMENT_MAX_HEIGHT, Math.max(EQUIPMENT_MIN_HEIGHT, snapToGrid(size.height)));
	      const x = snapToGrid(position.x);
	      const y = snapToGrid(position.y);
	      onEquipmentResize(data.equipmentId, x, y, width, height);
	    };
	    const nodeMovedHandler = ({ node }: { node: Node }) => {
	      if (syncingRef.current) return;
	      const data = node.getData() as {
        kind?: string;
        equipmentId?: string;
        renderedStreamId?: string;
        side?: 'from' | 'to';
        componentId?: string;
        segmentId?: string;
        pipeNodeId?: string;
        pipeNodeSource?: 'semantic' | 'inline' | 'endpoint';
        streamId?: string;
      };
	      const position = node.position();
	      if (data.kind === 'equipment' && data.equipmentId) {
	        if (resizingEquipmentRef.current === data.equipmentId) return;
	        clearCanvasTransientUi();
	        onEquipmentMove(data.equipmentId, snapToGrid(position.x), snapToGrid(position.y));
	      }
      if (data.kind === 'reference' && data.renderedStreamId && data.side) {
        const stream = sheetStreams.find((item) => item.id === data.renderedStreamId);
        if (stream) onReferenceMove(stream, data.side, snapToGrid(position.x + REFERENCE_NODE_WIDTH / 2), snapToGrid(position.y + REFERENCE_NODE_HEIGHT / 2));
      }
      if (data.kind === 'pipe-node' && data.segmentId) {
        const attachment = snapPipeNodeToRoute(node);
        if (!attachment) return;
        const segmentId = attachment.stream.sourceStreamId || attachment.stream.id;
        const ratio = clampPercent(Math.round(attachment.ratio));
        if (data.pipeNodeSource === 'inline' && data.componentId) onInlineComponentMove(data.componentId, segmentId, ratio);
        if (data.pipeNodeSource === 'semantic' && data.pipeNodeId) onPipeNodeMove(data.pipeNodeId, segmentId, ratio);
        if (data.pipeNodeSource === 'endpoint' && data.streamId && data.side) onStreamEndpointMove(data.streamId, data.side, segmentId, ratio);
      }
    };
    const edgeVertexHandler = ({ edge }: { edge: Edge }) => {
      if (syncingRef.current) return;
      const data = edge.getData() as { streamId?: string; splitByInline?: boolean; pieceIndex?: number };
      if (!data.streamId) return;
      pendingEdgeRouteRef.current = {
        ...edgeRouteSnapshot(edge)!,
      };
      syncAttachedPipeNodesToEdge(edge);
    };
    const commitPendingEdgeRoute = () => {
      const pending = pendingEdgeRouteRef.current;
      if (!pending) return false;
      pendingEdgeRouteRef.current = null;
      onStreamWaypointsChange(
        pending.streamId,
        pending.waypoints,
        pending.pieceIndex,
      );
      return true;
    };
    const edgeMouseMoveHandler = ({ e, edge }: { e: MouseEvent; edge: Edge }) => {
      if (pendingPipeEndpoint || draggingPortRef.current) {
        setStreamTooltip(null);
        return;
      }
      const rect = containerRef.current?.getBoundingClientRect();
      const stream = streamForEdge(edge);
      if (!rect || !stream) {
        setStreamTooltip(null);
        return;
      }
      setPortTooltip(null);
      setStreamTooltip({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        tag: stream.tag,
        name: stream.name,
        branchType: stream.branchType,
        role: stream.role,
        medium: stream.medium,
        directionMode: stream.directionMode,
        dn: stream.dn,
        pn: stream.pn,
        material: stream.material,
        intent: stream.intent,
      });
    };
    const edgeMouseLeaveHandler = () => setStreamTooltip(null);
    const edgeClickHandler = ({ e, edge }: { e: MouseEvent; edge: Edge }) => {
      if (pendingPipeEndpoint) {
        const target = endpointSelectionFromEdge(edge, e);
        if (target) completePendingPipeEndpoint(target);
        return;
      }
      setStreamTooltip(null);
	      setPipeContextMenu(null);
	      setPortContextMenu(null);
	      setDeviceContextMenu(null);
	      setPipeEditPanel(null);
	      setReferenceEndpointEditPanel(null);
	      setInlineComponentContextMenu(null);
	      setInlineComponentEditPanel(null);
      const data = edge.getData() as { streamId?: string; splitByInline?: boolean };
      if (data.streamId) onSelectStream(data.streamId);
      clearEdgeTools();
    };
	    const edgeDblClickHandler = ({ edge }: { edge: Edge }) => {
	      const data = edge.getData() as { streamId?: string; splitByInline?: boolean };
	      if (data.streamId) onSelectStream(data.streamId);
	      setStreamTooltip(null);
	      setPipeContextMenu(null);
	      setReferenceEndpointEditPanel(null);
	      addEdgeTools(edge);
	    };
	    const openPipeContextMenuForEdge = (edge: Edge, event: MouseEvent) => {
	      const data = edge.getData() as { streamId?: string; renderedStreamId?: string };
	      const routeId = data.renderedStreamId || data.streamId;
	      const canvasRoute = routeId ? canvasRoutesRef.current.get(routeId) : undefined;
	      if (!canvasRoute) return false;
	      const local = graph.clientToLocal(event.clientX, event.clientY);
	      const attachment = nearestPointOnRoute(canvasRoute.route, local);
	      if (!attachment) return false;
	      const rect = containerRef.current?.getBoundingClientRect();
	      if (!rect) return false;
	      const sourceStreamId = canvasRoute.stream.sourceStreamId || canvasRoute.stream.id;
	      setStreamTooltip(null);
	      setPortContextMenu(null);
	      setDeviceContextMenu(null);
	      setPipeEditPanel(null);
	      setReferenceEndpointEditPanel(null);
	      setInlineComponentContextMenu(null);
	      setInlineComponentEditPanel(null);
	      setPipeContextMenu({
	        x: event.clientX - rect.left,
	        y: event.clientY - rect.top,
	        streamId: sourceStreamId,
	        streamTag: canvasRoute.stream.tag,
	        ratio: clampPercent(Math.round(attachment.ratio)),
	        point: attachment.point,
	      });
	      onSelectStream(sourceStreamId);
	      clearEdgeTools();
	      return true;
	    };
	    const openDeviceContextMenuForNode = (node: Node, event: MouseEvent) => {
	      const data = node.getData() as { kind?: string; equipmentId?: string };
	      if (data.kind !== 'equipment' || !data.equipmentId) return false;
	      const rect = containerRef.current?.getBoundingClientRect();
	      if (!rect) return false;
	      const equipment = sheetEquipments.find((item) => item.id === data.equipmentId);
	      setPipeContextMenu(null);
	      setPortContextMenu(null);
	      setPipeEditPanel(null);
	      setReferenceEndpointEditPanel(null);
	      setInlineComponentContextMenu(null);
	      setInlineComponentEditPanel(null);
	      setDeviceContextMenu({
	        x: event.clientX - rect.left,
	        y: event.clientY - rect.top,
	        equipmentId: data.equipmentId,
	        equipmentTag: equipment?.tag || data.equipmentId,
	      });
	      onSelectEquipment(data.equipmentId);
	      clearEdgeTools();
	      return true;
	    };
	    const openInlineComponentContextMenuForNode = (node: Node, event: MouseEvent) => {
	      const data = node.getData() as {
	        kind?: string;
	        pipeNodeSource?: 'semantic' | 'inline' | 'endpoint';
	        componentId?: string;
	        renderedStreamId?: string;
	      };
	      if (data.kind !== 'pipe-node' || data.pipeNodeSource !== 'inline' || !data.componentId) return false;
	      const rect = containerRef.current?.getBoundingClientRect();
	      if (!rect) return false;
	      const component = project.inlineComponents.find((item) => item.id === data.componentId);
	      if (!component) return false;
	      setPipeContextMenu(null);
	      setPortContextMenu(null);
	      setDeviceContextMenu(null);
	      setPipeEditPanel(null);
	      setReferenceEndpointEditPanel(null);
	      setInlineComponentEditPanel(null);
	      setInlineComponentContextMenu({
	        x: event.clientX - rect.left,
	        y: event.clientY - rect.top,
	        componentId: component.id,
	        componentTag: component.tag || component.type,
	      });
	      if (data.renderedStreamId) onSelectStream(data.renderedStreamId);
	      clearEdgeTools();
	      return true;
	    };
	    const openReferenceEndpointEditPanelForNode = (node: Node, event: MouseEvent) => {
	      const data = node.getData() as {
	        kind?: string;
	        streamId?: string;
	        renderedStreamId?: string;
	        side?: 'from' | 'to';
	        sourceSide?: 'from' | 'to';
	      };
	      if (data.kind !== 'reference' || !data.streamId || !data.side) return false;
	      const rect = containerRef.current?.getBoundingClientRect();
	      if (!rect) return false;
	      setPipeContextMenu(null);
	      setPortContextMenu(null);
	      setDeviceContextMenu(null);
	      setPipeEditPanel(null);
	      setReferenceEndpointEditPanel(null);
	      setInlineComponentContextMenu(null);
	      setInlineComponentEditPanel(null);
	      setReferenceEndpointEditPanel({
	        x: event.clientX - rect.left,
	        y: event.clientY - rect.top,
	        streamId: data.streamId,
	        renderedStreamId: data.renderedStreamId || data.streamId,
	        side: data.sourceSide || data.side,
	        renderedSide: data.side,
	      });
	      onSelectStream(data.streamId);
	      clearEdgeTools();
	      return true;
	    };
	    const edgeContextMenuHandler = ({ e, edge }: { e: MouseEvent; edge: Edge }) => {
	      e.preventDefault();
	      e.stopPropagation();
	      setStreamTooltip(null);
      if (pendingPipeEndpoint) {
        const target = endpointSelectionFromEdge(edge, e);
	        if (target) completePendingPipeEndpoint(target);
	        return;
	      }
	      openPipeContextMenuForEdge(edge, e);
	    };
    const edgeConnectedHandler = ({ edge, isNew }: { edge: Edge; isNew: boolean }) => {
      if (!isNew) return;
      const source = edge.getSource() as { cell?: string; port?: string };
      const target = edge.getTarget() as { cell?: string; port?: string };
      const sourceNode = source.cell ? graph.getCellById(source.cell) : null;
      const targetNode = target.cell ? graph.getCellById(target.cell) : null;
      const sourceData = sourceNode?.isNode() ? sourceNode.getData() as { kind?: string; equipmentId?: string } : null;
      const targetData = targetNode?.isNode() ? targetNode.getData() as { kind?: string; equipmentId?: string } : null;
      edge.remove();
      if (
        sourceData?.kind === 'equipment'
        && targetData?.kind === 'equipment'
        && sourceData.equipmentId
        && targetData.equipmentId
        && source.port
        && target.port
      ) {
        onCreateStreamFromPorts(sourceData.equipmentId, source.port, targetData.equipmentId, target.port);
      }
    };
	    const nodeClickHandler = ({ node }: { node: Node }) => {
	      if (pendingPipeEndpoint) return;
	      setStreamTooltip(null);
	      setPipeContextMenu(null);
	      setPortContextMenu(null);
	      setDeviceContextMenu(null);
	      setPipeEditPanel(null);
	      setReferenceEndpointEditPanel(null);
	      setInlineComponentContextMenu(null);
	      setInlineComponentEditPanel(null);
	      const data = node.getData() as { kind?: string; equipmentId?: string; streamId?: string; renderedStreamId?: string };
	      if (data.kind === 'equipment' && data.equipmentId) {
	        onSelectEquipment(data.equipmentId);
	        window.requestAnimationFrame(() => {
	          if (graph.getCellById(node.id)) transformPluginRef.current?.createWidget(node);
	        });
	      } else {
	        transformPluginRef.current?.clearWidgets();
	      }
	      if (data.kind === 'reference' && data.streamId) onSelectStream(data.streamId);
	      if (data.kind === 'pipe-node' && data.renderedStreamId) onSelectStream(data.renderedStreamId);
	      clearEdgeTools();
	    };
    const selectionChangedHandler = ({ selected }: { selected: Cell[] }) => {
      if (syncingRef.current) return;
      setStreamTooltip(null);
      const primary = selected[selected.length - 1];
      if (!primary) return;
      if (primary.isNode()) {
        const data = primary.getData() as { kind?: string; equipmentId?: string; streamId?: string; renderedStreamId?: string };
        if (data.kind === 'equipment' && data.equipmentId) onSelectEquipment(data.equipmentId);
        if (data.kind === 'reference' && data.streamId) onSelectStream(data.streamId);
        if (data.kind === 'pipe-node' && data.renderedStreamId) onSelectStream(data.renderedStreamId);
      }
      if (primary.isEdge()) {
        const data = primary.getData() as { streamId?: string };
        if (data.streamId) {
          onSelectStream(data.streamId);
        }
      }
    };
    const nodeDblClickHandler = ({ node }: { node: Node }) => {
	      setStreamTooltip(null);
	      const data = node.getData() as { kind?: string; equipmentId?: string; streamId?: string; renderedStreamId?: string };
	      if (data.kind === 'equipment' && data.equipmentId) onOpenEquipment(data.equipmentId);
	      if (data.kind === 'reference' && data.streamId) onOpenStreams(data.streamId);
	      if (data.kind === 'pipe-node' && data.renderedStreamId) onOpenStreams(data.renderedStreamId);
	    };
    const blankClickHandler = ({ e }: { e: MouseEvent }) => {
      if (pendingPipeEndpoint) {
        const local = graph.clientToLocal(e.clientX, e.clientY);
        completePendingPipeEndpoint({
          kind: pendingPipeEndpoint.side === 'from' ? '界外来源' : '界外去向',
          x: snapToGrid(local.x),
          y: snapToGrid(local.y),
        });
        return;
      }
	      setStreamTooltip(null);
	      setPipeContextMenu(null);
	      setPortContextMenu(null);
	      setDeviceContextMenu(null);
	      setPipeEditPanel(null);
	      setReferenceEndpointEditPanel(null);
	      setInlineComponentContextMenu(null);
	      setInlineComponentEditPanel(null);
	      clearEdgeTools();
	    };
	    const blankContextMenuHandler = ({ e }: { e: MouseEvent }) => {
	      e.preventDefault();
	      setStreamTooltip(null);
	      setPipeContextMenu(null);
	      setPortContextMenu(null);
	      setDeviceContextMenu(null);
	      setPipeEditPanel(null);
	      setReferenceEndpointEditPanel(null);
	      setInlineComponentContextMenu(null);
	      setInlineComponentEditPanel(null);
	    };
    const findPortIdFromEvent = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return '';
      return target.closest('[port]')?.getAttribute('port') || '';
    };
    const findCellIdFromEvent = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return '';
      return target.closest('[data-cell-id]')?.getAttribute('data-cell-id') || '';
    };
    const updatePortTooltipFromEvent = (event: MouseEvent) => {
      if (draggingPortRef.current) {
        setPortTooltip(null);
        setStreamTooltip(null);
        return;
      }
      const portId = findPortIdFromEvent(event);
      const graph = graphRef.current;
      const cellId = findCellIdFromEvent(event);
      const cell = cellId ? graph?.getCellById(cellId) : null;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!portId || !cell?.isNode() || !rect) {
        setPortTooltip(null);
        return;
      }
      const data = cell.getData() as { kind?: string; equipmentId?: string };
      if (data.kind !== 'equipment' || !data.equipmentId) {
        setPortTooltip(null);
        return;
      }
      const equipment = sheetEquipments.find((item) => item.id === data.equipmentId);
      const port = equipment?.ports.find((item) => item.id === portId);
      if (!equipment || !port) {
        setPortTooltip(null);
        return;
      }
      setPortTooltip({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        equipmentTag: equipment.tag,
        portId,
        portName: port.name || port.id,
        direction: port.direction,
        role: port.role,
        medium: port.medium,
      });
      setStreamTooltip(null);
    };
    const updateStreamTooltipFromEvent = (event: MouseEvent) => {
      if (draggingPortRef.current || pendingPipeEndpoint || pipeContextMenu) {
        setStreamTooltip(null);
        return;
      }
      if (findPortIdFromEvent(event)) {
        setStreamTooltip(null);
        return;
      }
      const graph = graphRef.current;
      const cellId = findCellIdFromEvent(event);
      const cell = cellId ? graph?.getCellById(cellId) : null;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!cell?.isEdge() || !rect) {
        setStreamTooltip(null);
        return;
      }
      const stream = streamForEdge(cell);
      if (!stream) {
        setStreamTooltip(null);
        return;
      }
      setPortTooltip(null);
      setStreamTooltip({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        tag: stream.tag,
        name: stream.name,
        branchType: stream.branchType,
        role: stream.role,
        medium: stream.medium,
        directionMode: stream.directionMode,
        dn: stream.dn,
        pn: stream.pn,
        material: stream.material,
        intent: stream.intent,
      });
    };
    const clearPortTooltipHandler = () => {
      setPortTooltip(null);
      setStreamTooltip(null);
    };
	    const nodeContextMenuHandler = ({ e, node }: { e: MouseEvent; node: Node }) => {
	      if (pendingPipeEndpoint) return;
	      const data = node.getData() as { kind?: string };
	      if (findPortIdFromEvent(e) && data.kind !== 'reference') return;
	      e.preventDefault();
	      e.stopPropagation();
	      if (openReferenceEndpointEditPanelForNode(node, e)) return;
	      if (openInlineComponentContextMenuForNode(node, e)) return;
	      openDeviceContextMenuForNode(node, e);
	    };
	    const containerContextMenuHandler = (event: MouseEvent) => {
	      const portId = findPortIdFromEvent(event);
	      const graph = graphRef.current;
	      const cellId = findCellIdFromEvent(event);
	      const cell = cellId ? graph?.getCellById(cellId) : null;
	      if (!graph || !cell) return;
	      if (cell.isNode()) {
	        const data = cell.getData() as { kind?: string };
	        if (data.kind === 'reference') {
	          event.preventDefault();
	          event.stopPropagation();
	          openReferenceEndpointEditPanelForNode(cell, event);
	          return;
	        }
	      }
	      if (!portId && cell.isEdge()) {
	        event.preventDefault();
	        event.stopPropagation();
	        if (pendingPipeEndpoint) {
	          const target = endpointSelectionFromEdge(cell, event);
	          if (target) completePendingPipeEndpoint(target);
	          return;
	        }
	        openPipeContextMenuForEdge(cell, event);
	        return;
	      }
	      if (!portId && cell.isNode()) {
	        if (openReferenceEndpointEditPanelForNode(cell, event) || openInlineComponentContextMenuForNode(cell, event) || openDeviceContextMenuForNode(cell, event)) {
	          event.preventDefault();
	          event.stopPropagation();
	        }
	        return;
	      }
	      if (!portId || !cell.isNode()) return;
	      const data = cell.getData() as { kind?: string; equipmentId?: string };
	      if (data.kind !== 'equipment' || !data.equipmentId) return;
      const equipment = sheetEquipments.find((item) => item.id === data.equipmentId);
      const port = equipment?.ports.find((item) => item.id === portId);
      const rect = containerRef.current?.getBoundingClientRect();
      if (!equipment || !port || !rect) return;
      event.preventDefault();
      event.stopPropagation();
      setPortTooltip(null);
      if (pendingPipeEndpoint) {
        completePendingPipeEndpoint({ kind: '设备端口', equipmentId: equipment.id, portId });
        return;
	      }
	      setPipeContextMenu(null);
	      setDeviceContextMenu(null);
	      setPipeEditPanel(null);
	      setReferenceEndpointEditPanel(null);
	      setInlineComponentContextMenu(null);
	      setInlineComponentEditPanel(null);
      setPortContextMenu({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        equipmentId: equipment.id,
        equipmentTag: equipment.tag,
        portId,
        point: portPoint(equipment, port),
      });
    };
    const startPortDragging = (e: MouseEvent, node: Node, portId: string) => {
      const data = node.getData() as { kind?: string; equipmentId?: string };
      if (data.kind !== 'equipment' || !data.equipmentId || !portId) return;
      if (e.shiftKey || e.altKey) return;
      setPortTooltip(null);
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      const equipment = sheetEquipments.find((item) => item.id === data.equipmentId);
      if (equipment) syncEquipmentPortDraftsToNode(node, equipment);
      const port = equipment?.ports.find((item) => item.id === portId);
      const draft = portDraftRef.current[data.equipmentId]?.[portId];
      draggingPortRef.current = { equipmentId: data.equipmentId, portId, x: draft?.x ?? port?.x ?? 0, y: draft?.y ?? port?.y ?? 0 };
    };
    const containerMouseDownHandler = (event: MouseEvent) => {
      const portId = findPortIdFromEvent(event);
      const graph = graphRef.current;
      const cellId = findCellIdFromEvent(event);
      const cell = cellId ? graph?.getCellById(cellId) : null;
      if (event.button === 2 && portId) return;
      if (pendingPipeEndpoint) {
        if (portId && cell?.isNode()) {
          const data = cell.getData() as { kind?: string; equipmentId?: string };
          if (data.kind === 'equipment' && data.equipmentId) {
            event.preventDefault();
            event.stopPropagation();
            completePendingPipeEndpoint({ kind: '设备端口', equipmentId: data.equipmentId, portId });
          }
          return;
        }
        if (cell?.isEdge()) {
          const target = endpointSelectionFromEdge(cell, event);
          if (target) {
            event.preventDefault();
            event.stopPropagation();
            completePendingPipeEndpoint(target);
          }
          return;
        }
        if (graph) {
          const local = graph.clientToLocal(event.clientX, event.clientY);
          const fallback = nearestStreamAttachment(local, '', [pendingPipeEndpoint.streamId]);
          if (fallback && fallback.distance <= 44) {
            event.preventDefault();
            event.stopPropagation();
            completePendingPipeEndpoint({
              kind: '管段接点',
              segmentId: fallback.stream.sourceStreamId || fallback.stream.id,
              ratio: clampPercent(Math.round(fallback.ratio)),
            });
            return;
          }
        }
        if (!cellId && graph) {
          const local = graph.clientToLocal(event.clientX, event.clientY);
          event.preventDefault();
          event.stopPropagation();
          completePendingPipeEndpoint({
            kind: pendingPipeEndpoint.side === 'from' ? '界外来源' : '界外去向',
            x: snapToGrid(local.x),
            y: snapToGrid(local.y),
          });
        }
        return;
      }
      if (!portId || !cell || !cell.isNode()) return;
      startPortDragging(event, cell, portId);
    };
    const nodeMouseDownHandler = ({ e, node }: { e: MouseEvent; node: Node }) => {
      const portId = findPortIdFromEvent(e);
      if (pendingPipeEndpoint && portId) {
        const data = node.getData() as { kind?: string; equipmentId?: string };
        if (data.kind === 'equipment' && data.equipmentId) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          completePendingPipeEndpoint({ kind: '设备端口', equipmentId: data.equipmentId, portId });
        }
        return;
      }
      const data = node.getData() as { kind?: string };
      if (data.kind === 'equipment') {
        commitPendingEdgeRoute();
        clearCanvasTransientUi();
      }
      startPortDragging(e, node, portId);
    };
    const portMouseDownHandler = ({ e, node, port }: { e: MouseEvent; node: Node; port: { id?: string } | string }) => {
      const portId = typeof port === 'string' ? port : port?.id || findPortIdFromEvent(e);
      if (pendingPipeEndpoint && portId) {
        const data = node.getData() as { kind?: string; equipmentId?: string };
        if (data.kind === 'equipment' && data.equipmentId) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          completePendingPipeEndpoint({ kind: '设备端口', equipmentId: data.equipmentId, portId });
        }
        return;
      }
      startPortDragging(e, node, portId);
    };
    const documentMouseMoveHandler = (event: MouseEvent) => {
      const dragging = draggingPortRef.current;
      const graph = graphRef.current;
      if (!dragging || !graph) return;
      event.preventDefault();
      const node = graph.getCellById(dragging.equipmentId);
      if (!node || !node.isNode()) return;
      const local = graph.clientToLocal(event.clientX, event.clientY);
      const position = node.position();
      const size = node.size();
      const x = clampPercent((local.x - position.x) / size.width * 100);
      const y = clampPercent((local.y - position.y) / size.height * 100);
      const nextX = snapPercent(x);
      const nextY = snapPercent(y);
      portDraftRef.current = {
        ...portDraftRef.current,
        [dragging.equipmentId]: {
          ...(portDraftRef.current[dragging.equipmentId] || {}),
          [dragging.portId]: { x: nextX, y: nextY },
        },
      };
      const equipment = sheetEquipments.find((item) => item.id === dragging.equipmentId);
      if (equipment) syncEquipmentPortDraftsToNode(node, equipment);
      draggingPortRef.current = { ...dragging, x: nextX, y: nextY };
    };
    const documentMouseUpHandler = () => {
      const dragging = draggingPortRef.current;
      draggingPortRef.current = null;
      if (dragging) {
        window.setTimeout(() => {
          onEquipmentPortMove(dragging.equipmentId, dragging.portId, dragging.x, dragging.y);
        }, 0);
      }
      if (commitPendingEdgeRoute()) {
        window.setTimeout(clearCanvasTransientUi, 0);
      }
    };
    const cancelPortDraggingHandler = () => {
      draggingPortRef.current = null;
      setPortTooltip(null);
      setStreamTooltip(null);
    };
    const keyDownHandler = (event: KeyboardEvent) => {
	      if (event.key === 'Escape') {
	        setPendingPipeEndpoint(null);
	        setPipeContextMenu(null);
	        setPortContextMenu(null);
	        setPortTooltip(null);
	        setStreamTooltip(null);
	        setDeviceContextMenu(null);
	        setPipeEditPanel(null);
	        setReferenceEndpointEditPanel(null);
	        setInlineComponentContextMenu(null);
	        setInlineComponentEditPanel(null);
	      }
	    };

	    graph.on('node:moved', nodeMovedHandler);
	    graph.on('node:change:position', pipeNodePositionHandler);
	    graph.on('node:resize', equipmentResizeStartHandler);
	    graph.on('node:resizing', equipmentResizingHandler);
	    graph.on('node:resized', equipmentResizedHandler);
	    graph.on('edge:change:vertices', edgeVertexHandler);
    graph.on('edge:mousemove', edgeMouseMoveHandler);
    graph.on('edge:mouseleave', edgeMouseLeaveHandler);
    graph.on('edge:click', edgeClickHandler);
    graph.on('edge:dblclick', edgeDblClickHandler);
    graph.on('edge:contextmenu', edgeContextMenuHandler);
    graph.on('edge:connected', edgeConnectedHandler);
    graph.on('node:click', nodeClickHandler);
	    graph.on('selection:changed', selectionChangedHandler);
	    graph.on('node:dblclick', nodeDblClickHandler);
	    graph.on('node:contextmenu', nodeContextMenuHandler);
	    graph.on('blank:click', blankClickHandler);
    graph.on('blank:contextmenu', blankContextMenuHandler);
    graph.on('node:mousedown', nodeMouseDownHandler);
    graph.on('node:port:mousedown', portMouseDownHandler);
    containerRef.current?.addEventListener('mousemove', updatePortTooltipFromEvent, true);
    containerRef.current?.addEventListener('mousemove', updateStreamTooltipFromEvent, true);
    containerRef.current?.addEventListener('mouseleave', clearPortTooltipHandler, true);
    containerRef.current?.addEventListener('mousedown', containerMouseDownHandler, true);
    containerRef.current?.addEventListener('contextmenu', containerContextMenuHandler, true);
    document.addEventListener('mousemove', documentMouseMoveHandler);
    document.addEventListener('mouseup', documentMouseUpHandler, true);
    document.addEventListener('keydown', keyDownHandler);
    window.addEventListener('blur', cancelPortDraggingHandler);
    document.addEventListener('mouseleave', cancelPortDraggingHandler);
    return () => {
      clearCanvasTransientUi();
	      graph.off('node:moved', nodeMovedHandler);
	      graph.off('node:change:position', pipeNodePositionHandler);
	      graph.off('node:resize', equipmentResizeStartHandler);
	      graph.off('node:resizing', equipmentResizingHandler);
	      graph.off('node:resized', equipmentResizedHandler);
	      graph.off('edge:change:vertices', edgeVertexHandler);
      graph.off('edge:mousemove', edgeMouseMoveHandler);
      graph.off('edge:mouseleave', edgeMouseLeaveHandler);
      graph.off('edge:click', edgeClickHandler);
      graph.off('edge:dblclick', edgeDblClickHandler);
      graph.off('edge:contextmenu', edgeContextMenuHandler);
      graph.off('edge:connected', edgeConnectedHandler);
      graph.off('node:click', nodeClickHandler);
	      graph.off('selection:changed', selectionChangedHandler);
	      graph.off('node:dblclick', nodeDblClickHandler);
	      graph.off('node:contextmenu', nodeContextMenuHandler);
	      graph.off('blank:click', blankClickHandler);
      graph.off('blank:contextmenu', blankContextMenuHandler);
      graph.off('node:mousedown', nodeMouseDownHandler);
      graph.off('node:port:mousedown', portMouseDownHandler);
      containerRef.current?.removeEventListener('mousemove', updatePortTooltipFromEvent, true);
      containerRef.current?.removeEventListener('mousemove', updateStreamTooltipFromEvent, true);
      containerRef.current?.removeEventListener('mouseleave', clearPortTooltipHandler, true);
      containerRef.current?.removeEventListener('mousedown', containerMouseDownHandler, true);
      containerRef.current?.removeEventListener('contextmenu', containerContextMenuHandler, true);
      document.removeEventListener('mousemove', documentMouseMoveHandler);
      document.removeEventListener('mouseup', documentMouseUpHandler, true);
      document.removeEventListener('keydown', keyDownHandler);
      window.removeEventListener('blur', cancelPortDraggingHandler);
      document.removeEventListener('mouseleave', cancelPortDraggingHandler);
    };
	  }, [
	    project,
	    sheetEquipments,
	    sheetStreams,
    getStreamRoute,
    onSelectEquipment,
    onSelectStream,
    onOpenEquipment,
    onOpenStreams,
	    onEquipmentMove,
	    onEquipmentResize,
	    onReferenceMove,
    onStreamWaypointsChange,
    onInlineComponentMove,
    onPipeNodeMove,
    onStreamEndpointMove,
    onEquipmentPortMove,
    onCreateStreamFromPorts,
    onCreateInlineComponentAt,
    onCreatePipeNodeAt,
    onCreatePipeStreamFromPoint,
    onCreatePipeStreamFromPort,
	    onCompletePipeStreamEndpoint,
	    onPatchStream,
    pendingPipeEndpoint,
    clearCanvasTransientUi,
  ]);

  const editingStream = pipeEditPanel
    ? sheetStreams.find((stream) => stream.id === pipeEditPanel.streamId || stream.sourceStreamId === pipeEditPanel.streamId)
    : undefined;
	  const editingStreamId = editingStream?.sourceStreamId || editingStream?.id || pipeEditPanel?.streamId || '';
  const pipeGroupOptions = project.lineGroups
    .filter((group) => group.sheetId === project.currentSheetId || group.id === editingStream?.groupId)
    .map((group) => option(group.id, `${group.tag} ${group.name || group.medium || group.role}`));
  const editingInlineComponent = inlineComponentEditPanel
    ? project.inlineComponents.find((component) => component.id === inlineComponentEditPanel.componentId)
    : undefined;
  const editingInlineComponentIsMeasurement = editingInlineComponent ? isMeasurementInlineType(editingInlineComponent.type) : false;
  const editingReferenceStream = referenceEndpointEditPanel
    ? project.streams.find((stream) => stream.id === referenceEndpointEditPanel.streamId)
    : undefined;
  const editingReferenceRenderedStream = referenceEndpointEditPanel
    ? sheetStreams.find((stream) => stream.id === referenceEndpointEditPanel.renderedStreamId)
    : undefined;
  const editingReferenceSide = referenceEndpointEditPanel?.side || 'from';
  const editingReferenceFallbackKind: PipeEndpointKind = editingReferenceSide === 'from' ? '界外来源' : '界外去向';
  const editingReferenceKind = editingReferenceSide === 'from' ? editingReferenceStream?.fromKind : editingReferenceStream?.toKind;
  const editingReferenceLabel = referenceDisplayName(editingReferenceSide === 'from' ? editingReferenceStream?.fromReferenceLabel || '' : editingReferenceStream?.toReferenceLabel || '');
  const editingReferenceSheet = editingReferenceSide === 'from' ? editingReferenceStream?.fromReferenceSheet : editingReferenceStream?.toReferenceSheet;
  const editingReferenceEquipment = editingReferenceSide === 'from' ? editingReferenceStream?.fromReferenceEquipment : editingReferenceStream?.toReferenceEquipment;
  const editingReferencePort = editingReferenceSide === 'from' ? editingReferenceStream?.fromReferencePort : editingReferenceStream?.toReferencePort;
  const editingReferenceIsContinuation = Boolean(
    editingReferenceRenderedStream?.virtual
      && editingReferenceRenderedStream.sourceStreamId === editingReferenceStream?.id
      && editingReferenceRenderedStream.continuationSide,
  );
  const editingReferenceContinuationSide = editingReferenceRenderedStream?.continuationSide || editingReferenceSide;
  const editingReferenceX = editingReferenceIsContinuation
    ? editingReferenceContinuationSide === 'from' ? editingReferenceStream?.fromContinuationX : editingReferenceStream?.toContinuationX
    : editingReferenceSide === 'from' ? editingReferenceStream?.fromReferenceX : editingReferenceStream?.toReferenceX;
  const editingReferenceY = editingReferenceIsContinuation
    ? editingReferenceContinuationSide === 'from' ? editingReferenceStream?.fromContinuationY : editingReferenceStream?.toContinuationY
    : editingReferenceSide === 'from' ? editingReferenceStream?.fromReferenceY : editingReferenceStream?.toReferenceY;
  const referenceSheetOptions = project.areas.flatMap((area) => area.sheets.map((sheet) => option(sheet.id, `${area.name} / ${sheet.name}`)));
  const referenceSheetAreaId = (sheetId: string) => project.areas.find((area) => area.sheets.some((sheet) => sheet.id === sheetId))?.id || '';
  const referenceSheetEquipmentOptions = (sheetId: string) => project.equipments
    .filter((equipment) => !sheetId || equipment.sheetId === sheetId)
    .map((equipment) => option(equipment.id, `${equipment.tag} ${equipment.name}`));
  const editingReferenceEquipmentObject = project.equipments.find((equipment) => (
    equipment.id === editingReferenceEquipment || equipment.tag === editingReferenceEquipment || equipment.name === editingReferenceEquipment
  ));
  const inlineEditableStreams = project.streams.filter((stream) => (
    sheetStreams.some((item) => item.id === stream.id || item.sourceStreamId === stream.id)
  ));
	  const closePipeContextMenu = () => setPipeContextMenu(null);
  const closeInlineComponentContextMenu = () => setInlineComponentContextMenu(null);
	  const deleteStreamFromContextMenu = () => {
	    if (!pipeContextMenu) return;
	    onDeleteStream(pipeContextMenu.streamId);
	    setPendingPipeEndpoint(null);
	    setPipeEditPanel(null);
	    setReferenceEndpointEditPanel(null);
	    closePipeContextMenu();
	  };
	  const deleteEquipmentFromContextMenu = () => {
	    if (!deviceContextMenu) return;
	    onDeleteEquipment(deviceContextMenu.equipmentId);
	    setPendingPipeEndpoint(null);
	    setPipeEditPanel(null);
	    setReferenceEndpointEditPanel(null);
	    setInlineComponentEditPanel(null);
	    setInlineComponentContextMenu(null);
	    setDeviceContextMenu(null);
	  };
  const deleteInlineComponentFromContextMenu = () => {
    if (!inlineComponentContextMenu) return;
    onDeleteInlineComponent(inlineComponentContextMenu.componentId);
    setPendingPipeEndpoint(null);
    setReferenceEndpointEditPanel(null);
    setInlineComponentEditPanel(null);
    closeInlineComponentContextMenu();
  };
	  const createInlineFromContextMenu = (type: InlinePipeComponentType) => {
	    if (!pipeContextMenu) return;
	    onCreateInlineComponentAt(pipeContextMenu.streamId, pipeContextMenu.ratio, type);
    closePipeContextMenu();
  };
  const createPipeNodeFromContextMenu = (kind: PipeNodeKind) => {
    if (!pipeContextMenu) return;
    onCreatePipeNodeAt(pipeContextMenu.streamId, pipeContextMenu.ratio, kind);
    closePipeContextMenu();
  };
  const createPipeStreamFromContextMenu = (branchType: PipeBranchType, attachSide: 'from' | 'to') => {
    if (!pipeContextMenu) return;
    const streamId = onCreatePipeStreamFromPoint({
      segmentId: pipeContextMenu.streamId,
      ratio: pipeContextMenu.ratio,
      point: pipeContextMenu.point,
      branchType,
      attachSide,
    });
    if (!streamId) return;
    setPendingPipeEndpoint({
      streamId,
      side: attachSide === 'from' ? 'to' : 'from',
      label: attachSide === 'from' ? '选择这条新管线的终点' : '选择这条新管线的起点',
    });
    closePipeContextMenu();
  };
  const editPipeFromContextMenu = () => {
    if (!pipeContextMenu) return;
    setPipeEditPanel({
      x: pipeContextMenu.x,
      y: pipeContextMenu.y,
      streamId: pipeContextMenu.streamId,
    });
    closePipeContextMenu();
  };
  const editInlineComponentFromContextMenu = () => {
    if (!inlineComponentContextMenu) return;
    setInlineComponentEditPanel({
      x: inlineComponentContextMenu.x,
      y: inlineComponentContextMenu.y,
      componentId: inlineComponentContextMenu.componentId,
    });
    closeInlineComponentContextMenu();
  };
  const createPipeStreamFromPortContextMenu = (branchType: PipeBranchType, attachSide: 'from' | 'to') => {
    if (!portContextMenu) return;
    const streamId = onCreatePipeStreamFromPort({
      equipmentId: portContextMenu.equipmentId,
      portId: portContextMenu.portId,
      point: portContextMenu.point,
      branchType,
      attachSide,
    });
    if (!streamId) return;
    setPendingPipeEndpoint({
      streamId,
      side: attachSide === 'from' ? 'to' : 'from',
      label: attachSide === 'from' ? '选择这条新管线的终点' : '选择这条新管线的起点',
    });
    setPortContextMenu(null);
  };
  const patchEditingStream = (patch: Partial<Stream>) => {
    if (!editingStreamId) return;
    onPatchStream(editingStreamId, patch);
  };
  const patchEditingReferenceEndpoint = (patch: Partial<Stream>) => {
    if (!editingReferenceStream) return;
    onPatchStream(editingReferenceStream.id, patch);
  };
  const patchEditingReferencePosition = (axis: 'x' | 'y', value: string) => {
    if (!editingReferenceStream) return;
    const nextValue = snapToGrid(Number(value));
    if (editingReferenceIsContinuation) {
      if (editingReferenceContinuationSide === 'from') {
        patchEditingReferenceEndpoint(axis === 'x' ? { fromContinuationX: nextValue } : { fromContinuationY: nextValue });
      } else {
        patchEditingReferenceEndpoint(axis === 'x' ? { toContinuationX: nextValue } : { toContinuationY: nextValue });
      }
      return;
    }
    if (editingReferenceSide === 'from') {
      patchEditingReferenceEndpoint(axis === 'x' ? { fromReferenceX: nextValue } : { fromReferenceY: nextValue });
    } else {
      patchEditingReferenceEndpoint(axis === 'x' ? { toReferenceX: nextValue } : { toReferenceY: nextValue });
    }
  };
  const patchEditingInlineComponent = (patch: Partial<InlinePipeComponent>) => {
    if (!editingInlineComponent) return;
    onPatchInlineComponent(editingInlineComponent.id, patch);
  };

  return (
    <div className="pid-x6-canvas-shell" onContextMenu={(event) => event.preventDefault()}>
      <div ref={containerRef} className="pid-x6-canvas-host" />
      {portTooltip && !portContextMenu && (
        <div
          className="pid-port-tooltip"
          style={{ left: portTooltip.x, top: portTooltip.y }}
        >
          <strong>{portTooltip.equipmentTag}.{portTooltip.portId} {portTooltip.portName}</strong>
          <span>{PORT_DIRECTION_LABELS[portTooltip.direction]} / {portTooltip.role}{portTooltip.medium ? ` / ${portTooltip.medium}` : ''}</span>
        </div>
      )}
      {streamTooltip && !pipeContextMenu && !portTooltip && (
        <div
          className="pid-stream-tooltip"
          style={{ left: streamTooltip.x, top: streamTooltip.y }}
        >
          <strong>{streamTooltip.tag} {streamTooltip.name || streamTooltip.branchType}</strong>
          <span>{streamTooltip.branchType} / {streamTooltip.role}{streamTooltip.medium ? ` / ${streamTooltip.medium}` : ''}</span>
          <span>{[streamTooltip.dn, streamTooltip.pn, streamTooltip.material].filter(Boolean).join(' / ') || '未填写管径、压力等级、材质'}</span>
          {streamTooltip.intent && <span>意图：{streamTooltip.intent}</span>}
        </div>
      )}
      {pipeContextMenu && (
        <div
          className="pid-pipe-context-menu"
          style={{ left: pipeContextMenu.x, top: pipeContextMenu.y }}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="pid-pipe-context-menu-title">{pipeContextMenu.streamTag} @ {pipeContextMenu.ratio}%</div>
          <button type="button" onClick={() => createInlineFromContextMenu('手动阀')}>插入手阀</button>
          <button type="button" onClick={() => createInlineFromContextMenu('控制阀')}>插入控制阀</button>
          <button type="button" onClick={() => createInlineFromContextMenu('流量计')}>插入流量计</button>
          <button type="button" onClick={() => createInlineFromContextMenu('爆破片')}>插入爆破片</button>
          <button type="button" onClick={() => createInlineFromContextMenu('就地压力测点')}>插入就地压力测点</button>
          <button type="button" onClick={() => createInlineFromContextMenu('远传压力测点')}>插入远传压力测点</button>
          <button type="button" onClick={() => createInlineFromContextMenu('就地温度测点')}>插入就地温度测点</button>
          <button type="button" onClick={() => createInlineFromContextMenu('远传温度测点')}>插入远传温度测点</button>
          <button type="button" onClick={() => createPipeStreamFromContextMenu('支管', 'from')}>以此点为起点新建支管</button>
          <button type="button" onClick={() => createPipeStreamFromContextMenu('旁路', 'from')}>以此点为起点新建旁路</button>
	          <button type="button" onClick={() => createPipeStreamFromContextMenu('汇入', 'to')}>以此点为终点新建汇入管</button>
	          <button type="button" onClick={() => createPipeNodeFromContextMenu('变径点')}>新增变径点</button>
	          <button type="button" onClick={editPipeFromContextMenu}>编辑管段信息</button>
	          <button type="button" className="pid-context-menu-danger" onClick={deleteStreamFromContextMenu}>删除管线</button>
	        </div>
	      )}
	      {deviceContextMenu && (
	        <div
	          className="pid-pipe-context-menu"
	          style={{ left: deviceContextMenu.x, top: deviceContextMenu.y }}
	          onMouseDown={(event) => event.stopPropagation()}
	          onClick={(event) => event.stopPropagation()}
	        >
	          <div className="pid-pipe-context-menu-title">{deviceContextMenu.equipmentTag}</div>
	          <button type="button" onClick={() => onOpenEquipment(deviceContextMenu.equipmentId)}>编辑设备语义</button>
	          <button type="button" className="pid-context-menu-danger" onClick={deleteEquipmentFromContextMenu}>删除设备</button>
	        </div>
	      )}
	      {inlineComponentContextMenu && (
	        <div
	          className="pid-pipe-context-menu"
	          style={{ left: inlineComponentContextMenu.x, top: inlineComponentContextMenu.y }}
	          onMouseDown={(event) => event.stopPropagation()}
	          onClick={(event) => event.stopPropagation()}
	        >
	          <div className="pid-pipe-context-menu-title">{inlineComponentContextMenu.componentTag}</div>
	          <button type="button" onClick={editInlineComponentFromContextMenu}>编辑元件信息</button>
	          <button type="button" className="pid-context-menu-danger" onClick={deleteInlineComponentFromContextMenu}>删除元件</button>
	        </div>
	      )}
	      {portContextMenu && (
        <div
          className="pid-pipe-context-menu"
          style={{ left: portContextMenu.x, top: portContextMenu.y }}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="pid-pipe-context-menu-title">{portContextMenu.equipmentTag}.{portContextMenu.portId}</div>
          <button type="button" onClick={() => createPipeStreamFromPortContextMenu('主管段', 'from')}>以此端口为起点新建管线</button>
          <button type="button" onClick={() => createPipeStreamFromPortContextMenu('汇入', 'to')}>以此端口为终点新建汇入管</button>
        </div>
      )}
      {pipeEditPanel && editingStream && (
        <div
          className="pid-pipe-edit-panel"
          style={{ left: pipeEditPanel.x, top: pipeEditPanel.y }}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="pid-pipe-edit-panel-title">
            <strong>管段信息</strong>
            <button type="button" onClick={() => setPipeEditPanel(null)}>×</button>
          </div>
          <label>
            <span>管段号</span>
            <Input size="small" value={editingStream.tag} onChange={(event) => patchEditingStream({ tag: event.target.value })} />
          </label>
          <label>
            <span>管段名称</span>
            <Input size="small" value={editingStream.name} onChange={(event) => patchEditingStream({ name: event.target.value })} />
          </label>
          <label>
            <span>所在管组</span>
            <Select
              size="small"
              value={editingStream.groupId}
              options={pipeGroupOptions}
              onChange={(groupId) => patchEditingStream({ groupId })}
            />
          </label>
          <label>
            <span>管线类型</span>
            <Select size="small" value={editingStream.branchType} options={PIPE_BRANCH_TYPES.map((item) => option(item))} onChange={(branchType) => patchEditingStream({ branchType })} />
          </label>
          <label>
            <span>介质</span>
            <Input size="small" value={editingStream.medium} onChange={(event) => patchEditingStream({ medium: event.target.value })} />
          </label>
          <div className="pid-pipe-edit-grid">
            <label>
              <span>直径</span>
              <Input size="small" value={editingStream.dn} onChange={(event) => patchEditingStream({ dn: event.target.value })} />
            </label>
            <label>
              <span>压力等级</span>
              <Input size="small" value={editingStream.pn} onChange={(event) => patchEditingStream({ pn: event.target.value })} />
            </label>
          </div>
          <label>
            <span>材质</span>
            <Input size="small" value={editingStream.material} onChange={(event) => patchEditingStream({ material: event.target.value })} />
          </label>
          <label>
            <span>用途说明</span>
            <Input.TextArea rows={2} value={editingStream.intent} onChange={(event) => patchEditingStream({ intent: event.target.value })} />
          </label>
        </div>
      )}
      {referenceEndpointEditPanel && editingReferenceStream && (
        <div
          className="pid-pipe-edit-panel pid-reference-edit-panel"
          style={{ left: referenceEndpointEditPanel.x, top: referenceEndpointEditPanel.y }}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="pid-pipe-edit-panel-title">
            <strong>界外/跨图端点</strong>
            <button type="button" onClick={() => setReferenceEndpointEditPanel(null)}>×</button>
          </div>
          <label>
            <span>所属管段</span>
            <Input size="small" disabled value={`${editingReferenceStream.tag}${editingReferenceStream.name ? ` ${editingReferenceStream.name}` : ''}`} />
          </label>
          <div className="pid-pipe-edit-grid">
            <label>
              <span>端点位置</span>
              <Input size="small" disabled value={editingReferenceSide === 'from' ? '起点' : '终点'} />
            </label>
            <label>
              <span>端点类型</span>
              <Select
                size="small"
                value={editingReferenceKind || editingReferenceFallbackKind}
                options={(editingReferenceSide === 'from' ? PIPE_FROM_ENDPOINT_KINDS : PIPE_TO_ENDPOINT_KINDS)
                  .filter(isReferenceEndpoint)
                  .map((item) => option(item))}
                onChange={(kind: PipeEndpointKind) => patchEditingReferenceEndpoint(editingReferenceSide === 'from' ? { fromKind: kind } : { toKind: kind })}
              />
            </label>
          </div>
          <label>
            <span>显示名称</span>
            <Input
              size="small"
              placeholder={referencePlaceholder(editingReferenceKind || editingReferenceFallbackKind, editingReferenceSide)}
              value={editingReferenceLabel || ''}
              onChange={(event) => patchEditingReferenceEndpoint(editingReferenceSide === 'from'
                ? { fromReferenceLabel: event.target.value }
                : { toReferenceLabel: event.target.value })}
            />
          </label>
          {(editingReferenceKind || editingReferenceFallbackKind) === '跨图引用' ? (
            <>
              <label>
                <span>目标图纸</span>
                <Select
                  size="small"
                  placeholder="选择图纸"
                  value={editingReferenceSheet || undefined}
                  options={referenceSheetOptions.filter((item) => item.value !== editingReferenceStream.sheetId)}
                  onChange={(sheetId: string) => patchEditingReferenceEndpoint(editingReferenceSide === 'from'
                    ? { fromReferenceSheet: sheetId, fromReferenceArea: referenceSheetAreaId(sheetId), fromReferenceEquipment: '', fromReferencePort: '' }
                    : { toReferenceSheet: sheetId, toReferenceArea: referenceSheetAreaId(sheetId), toReferenceEquipment: '', toReferencePort: '' })}
                />
              </label>
              <label>
                <span>目标设备</span>
                <Select
                  size="small"
                  placeholder="选择目标设备"
                  value={editingReferenceEquipment || undefined}
                  options={referenceSheetEquipmentOptions(editingReferenceSheet || '')}
                  onChange={(equipmentId: string) => {
                    const equipment = project.equipments.find((item) => item.id === equipmentId);
                    patchEditingReferenceEndpoint(editingReferenceSide === 'from'
                      ? {
                        fromReferenceSheet: equipment?.sheetId || editingReferenceSheet || '',
                        fromReferenceArea: equipment ? referenceSheetAreaId(equipment.sheetId) : referenceSheetAreaId(editingReferenceSheet || ''),
                        fromReferenceEquipment: equipmentId,
                        fromReferencePort: equipment?.ports[0]?.id || '',
                      }
                      : {
                        toReferenceSheet: equipment?.sheetId || editingReferenceSheet || '',
                        toReferenceArea: equipment ? referenceSheetAreaId(equipment.sheetId) : referenceSheetAreaId(editingReferenceSheet || ''),
                        toReferenceEquipment: equipmentId,
                        toReferencePort: equipment?.ports[0]?.id || '',
                      });
                  }}
                />
              </label>
              <label>
                <span>目标端口/连接点</span>
                <Select
                  size="small"
                  placeholder="选择目标连接桩"
                  value={editingReferencePort || undefined}
                  options={(editingReferenceEquipmentObject?.ports || []).map((port) => option(port.id, `${port.id} ${port.name}`))}
                  onChange={(portId: string) => patchEditingReferenceEndpoint(editingReferenceSide === 'from'
                    ? { fromReferencePort: portId }
                    : { toReferencePort: portId })}
                />
              </label>
            </>
          ) : (
            <>
              <label>
                <span>目标设备/边界</span>
                <Input
                  size="small"
                  value={editingReferenceEquipment || ''}
                  onChange={(event) => patchEditingReferenceEndpoint(editingReferenceSide === 'from'
                    ? { fromReferenceEquipment: event.target.value }
                    : { toReferenceEquipment: event.target.value })}
                />
              </label>
              <label>
                <span>目标端口/连接点</span>
                <Input
                  size="small"
                  value={editingReferencePort || ''}
                  onChange={(event) => patchEditingReferenceEndpoint(editingReferenceSide === 'from'
                    ? { fromReferencePort: event.target.value }
                    : { toReferencePort: event.target.value })}
                />
              </label>
            </>
          )}
          <label>
            <span>画布位置</span>
            <Space.Compact>
              <Input
                size="small"
                type="number"
                addonBefore="X"
                value={String(editingReferenceX ?? 0)}
                onChange={(event) => patchEditingReferencePosition('x', event.target.value)}
              />
              <Input
                size="small"
                type="number"
                addonBefore="Y"
                value={String(editingReferenceY ?? 0)}
                onChange={(event) => patchEditingReferencePosition('y', event.target.value)}
              />
            </Space.Compact>
          </label>
        </div>
      )}
      {inlineComponentEditPanel && editingInlineComponent && (
        <div
          className="pid-pipe-edit-panel pid-inline-edit-panel"
          style={{ left: inlineComponentEditPanel.x, top: inlineComponentEditPanel.y }}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="pid-pipe-edit-panel-title">
            <strong>管线元件</strong>
            <button type="button" onClick={() => setInlineComponentEditPanel(null)}>×</button>
          </div>
          <div className="pid-pipe-edit-grid">
            <label>
              <span>位号</span>
              <Input size="small" value={editingInlineComponent.tag} onChange={(event) => patchEditingInlineComponent({ tag: event.target.value })} />
            </label>
            <label>
              <span>类型</span>
              <Select
                size="small"
                value={normalizeInlineComponentType(editingInlineComponent.type)}
                options={INLINE_COMPONENT_TYPES.map((item) => option(item))}
                onChange={(type) => patchEditingInlineComponent(inlineComponentTypePatch(editingInlineComponent, type))}
              />
            </label>
          </div>
          <label>
            <span>名称</span>
            <Input size="small" value={editingInlineComponent.name} onChange={(event) => patchEditingInlineComponent({ name: event.target.value })} />
          </label>
          <div className="pid-pipe-edit-grid">
            <label>
              <span>所在管段</span>
              <Select
                size="small"
                value={editingInlineComponent.segmentId}
                options={inlineEditableStreams.map((stream) => option(stream.id, streamDisplayLabel(stream)))}
                onChange={(segmentId) => patchEditingInlineComponent({
                  segmentId,
                  positionRatio: 50,
                  order: 50,
                  x: undefined,
                  y: undefined,
                })}
              />
            </label>
            <label>
              <span>位置</span>
              <Input
                size="small"
                type="number"
                min={0}
                max={100}
                suffix="%"
                value={String(editingInlineComponent.positionRatio ?? 50)}
                onChange={(event) => {
                  const ratio = clampPercent(Number(event.target.value));
                  patchEditingInlineComponent({ positionRatio: ratio, order: ratio, x: undefined, y: undefined });
                }}
              />
            </label>
          </div>
          {!editingInlineComponentIsMeasurement && (
            <div className="pid-pipe-edit-grid">
              <label>
                <span>常态</span>
                <Select size="small" value={editingInlineComponent.normalState} options={INLINE_COMPONENT_STATES.map((item) => option(item))} onChange={(normalState) => patchEditingInlineComponent({ normalState })} />
              </label>
              <label>
                <span>执行机构/驱动</span>
                <Input size="small" value={editingInlineComponent.actuator} onChange={(event) => patchEditingInlineComponent({ actuator: event.target.value })} />
              </label>
            </div>
          )}
          <label>
            <span>控制信号</span>
            <Input size="small" value={editingInlineComponent.controlSignal} onChange={(event) => patchEditingInlineComponent({ controlSignal: event.target.value })} />
          </label>
          <label>
            <span>参数与说明</span>
            <Input.TextArea rows={2} value={editingInlineComponent.description} onChange={(event) => patchEditingInlineComponent({ description: event.target.value })} />
          </label>
        </div>
      )}
      {pendingPipeEndpoint && (
        <div className="pid-pipe-pick-hint">
          <strong>{pendingPipeEndpoint.label}</strong>
          <span>左键点击设备连接桩、另一条管线或空白界外点，Esc 取消。</span>
        </div>
      )}
    </div>
  );
}

function PidX6Workspace() {
  const [project, setProject] = useState<PidSemanticProject>(() => loadProject());
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('canvas');
  const [selectedEquipmentId, setSelectedEquipmentId] = useState(project.equipments[0]?.id || '');
  const [selectedLineGroupId, setSelectedLineGroupId] = useState(project.lineGroups[0]?.id || '');
  const [selectedStreamId, setSelectedStreamId] = useState(project.streams[0]?.id || '');
  const [selectedControlId, setSelectedControlId] = useState(project.controls[0]?.id || '');
  const [newEquipmentType, setNewEquipmentType] = useState<EquipmentType>('reactor');
  const [equipmentGuideStep, setEquipmentGuideStep] = useState<EquipmentGuideStep>('identity');
  const [networkProjects, setNetworkProjects] = useState<NetworkProjectSummary[]>([]);
  const [networkProjectId, setNetworkProjectId] = useState('');
  const [networkVersion, setNetworkVersion] = useState<number | null>(null);
  const [networkLoading, setNetworkLoading] = useState(false);
  const [sheetMoveTargetAreaId, setSheetMoveTargetAreaId] = useState('');
  const [newAreaName, setNewAreaName] = useState('');
  const [newSheetName, setNewSheetName] = useState('');

  const refreshNetworkProjects = useCallback(async () => {
    setNetworkLoading(true);
    try {
      const payload = await requestNetworkProject('/_api/network-projects');
      setNetworkProjects(payload.projects || []);
    } catch (error) {
      message.warning(`网络工程列表不可用：${(error as Error).message}`);
    } finally {
      setNetworkLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshNetworkProjects();
  }, [refreshNetworkProjects]);

  useEffect(() => {
    setProject((prev) => {
      let changed = false;
      const inlineComponents = prev.inlineComponents.map((component) => {
        const type = normalizeInlineComponentType(component.type);
        const measurement = isMeasurementInlineType(type);
        const nextNormalState = measurement ? '' : component.normalState;
        const nextActuator = measurement ? '' : component.actuator;
        if (type !== component.type || nextNormalState !== component.normalState || nextActuator !== component.actuator) changed = true;
        return { ...component, type, normalState: nextNormalState, actuator: nextActuator };
      });
      const streams = prev.streams.map((stream) => {
        const fromReferenceLabel = referenceDisplayName(stream.fromReferenceLabel || '');
        const toReferenceLabel = referenceDisplayName(stream.toReferenceLabel || '');
        if (fromReferenceLabel !== stream.fromReferenceLabel || toReferenceLabel !== stream.toReferenceLabel) changed = true;
        return { ...stream, fromReferenceLabel, toReferenceLabel };
      });
      return changed ? { ...prev, streams, inlineComponents } : prev;
    });
  }, []);

  const currentArea = project.areas.find((area) => area.id === project.currentAreaId) || project.areas[0];
  const currentSheet = currentArea?.sheets.find((sheet) => sheet.id === project.currentSheetId) || currentArea?.sheets[0];
  const sheetMoveTargetAreas = project.areas;
  const sheetEquipments = project.equipments.filter((equipment) => equipment.sheetId === project.currentSheetId);

  useEffect(() => {
    setSheetMoveTargetAreaId(currentArea?.id || '');
  }, [currentArea?.id, currentSheet?.id]);

  const findEquipmentByReference = (reference: string) => {
    const trimmed = reference.trim();
    if (!trimmed) return undefined;
    return project.equipments.find((equipment) => (
      equipment.id === trimmed || equipment.tag === trimmed || equipment.name === trimmed || `${equipment.tag} ${equipment.name}` === trimmed
    ));
  };
  const findPortByReference = (equipment: Equipment | undefined, reference: string) => {
    if (!equipment) return undefined;
    const trimmed = reference.trim();
    return equipment.ports.find((port) => port.id === trimmed || port.name === trimmed || `${equipment.tag}.${port.id}` === trimmed) || equipment.ports[0];
  };
  const referenceEquipmentLabel = (equipmentRef: string, portRef: string) => {
    const equipment = findEquipmentByReference(equipmentRef);
    if (!equipment) return [equipmentRef, portRef].filter(Boolean).join('.');
    const port = findPortByReference(equipment, portRef);
    return `${equipment.tag}${port ? `.${port.id} ${port.name}` : ''}`;
  };
  const endpointBrief = (stream: Stream, side: 'from' | 'to') => {
    const kind = side === 'from' ? stream.fromKind : stream.toKind;
    if (kind === '设备端口') {
      const equipment = project.equipments.find((item) => item.id === (side === 'from' ? stream.fromEquipmentId : stream.toEquipmentId));
      const portId = side === 'from' ? stream.fromPortId : stream.toPortId;
      return `${equipment?.tag || '未知设备'}.${portId || portLabel(equipment, portId)}`;
    }
      if (kind === '管段接点') {
        const pipeNodeId = side === 'from' ? stream.fromPipeNodeId : stream.toPipeNodeId;
        const pipeNode = project.pipeNodes.find((node) => node.id === pipeNodeId);
        if (pipeNode) return `${pipeNode.tag} ${pipeNode.kind}`;
        const segmentId = side === 'from' ? stream.fromSegmentId : stream.toSegmentId;
        const ratio = side === 'from' ? stream.fromSegmentRatio : stream.toSegmentRatio;
      const segment = project.streams.find((item) => item.id === segmentId);
      return `${segment?.tag || '管段'}@${ratio}%`;
    }
    const label = side === 'from' ? stream.fromReferenceLabel : stream.toReferenceLabel;
    const equipment = side === 'from' ? stream.fromReferenceEquipment : stream.toReferenceEquipment;
    const port = side === 'from' ? stream.fromReferencePort : stream.toReferencePort;
    if (kind === '跨图引用') {
      return referenceEquipmentLabel(equipment, port) || label || referencePlaceholder(kind, side);
    }
    return label || referenceEquipmentLabel(equipment, port) || referencePlaceholder(kind, side);
  };
  const continuationStreams: CanvasStream[] = project.streams.flatMap((stream) => {
    if (stream.sheetId === project.currentSheetId) return [];
    const continuations: CanvasStream[] = [];
    if (stream.toKind === '跨图引用') {
      const targetEquipment = findEquipmentByReference(stream.toReferenceEquipment);
      const targetPort = findPortByReference(targetEquipment, stream.toReferencePort);
      if (targetEquipment?.sheetId === project.currentSheetId && targetPort) {
        continuations.push({
          ...stream,
          id: `${stream.id}__to_continuation`,
          sheetId: project.currentSheetId,
          fromKind: '跨图引用',
          fromEquipmentId: '',
          fromPortId: '',
          fromSegmentId: '',
          fromReferenceLabel: `来自 ${endpointBrief(stream, 'from')}`,
          fromReferenceArea: stream.toReferenceArea,
          fromReferenceSheet: stream.toReferenceSheet,
          fromReferenceEquipment: '',
          fromReferencePort: '',
          fromReferenceX: stream.toContinuationX || snapToGrid(Math.max(40, targetEquipment.x - 140)),
          fromReferenceY: stream.toContinuationY || snapToGrid(targetEquipment.y + targetEquipment.height / 2),
          toKind: '设备端口',
          toEquipmentId: targetEquipment.id,
          toPortId: targetPort.id,
          toSegmentId: '',
          virtual: true,
          sourceStreamId: stream.id,
          continuationSide: 'to',
        });
      }
    }
    if (stream.fromKind === '跨图引用') {
      const targetEquipment = findEquipmentByReference(stream.fromReferenceEquipment);
      const targetPort = findPortByReference(targetEquipment, stream.fromReferencePort);
      if (targetEquipment?.sheetId === project.currentSheetId && targetPort) {
        continuations.push({
          ...stream,
          id: `${stream.id}__from_continuation`,
          sheetId: project.currentSheetId,
          fromKind: '设备端口',
          fromEquipmentId: targetEquipment.id,
          fromPortId: targetPort.id,
          fromSegmentId: '',
          toKind: '跨图引用',
          toEquipmentId: '',
          toPortId: '',
          toSegmentId: '',
          toReferenceLabel: `去 ${endpointBrief(stream, 'to')}`,
          toReferenceArea: stream.fromReferenceArea,
          toReferenceSheet: stream.fromReferenceSheet,
          toReferenceEquipment: '',
          toReferencePort: '',
          toReferenceX: stream.fromContinuationX || snapToGrid(targetEquipment.x + targetEquipment.width + 140),
          toReferenceY: stream.fromContinuationY || snapToGrid(targetEquipment.y + targetEquipment.height / 2),
          virtual: true,
          sourceStreamId: stream.id,
          continuationSide: 'from',
        });
      }
    }
    return continuations;
  });
  const sheetStreams: CanvasStream[] = [
    ...project.streams.filter((stream) => stream.sheetId === project.currentSheetId),
    ...continuationStreams,
  ];
  const visibleLineGroupIds = new Set(sheetStreams.map((stream) => stream.groupId));
  const sheetLineGroups = project.lineGroups.filter((group) => group.sheetId === project.currentSheetId || visibleLineGroupIds.has(group.id));
  const sheetOptions = project.areas.flatMap((area) => area.sheets.map((sheet) => option(sheet.id, `${area.name} / ${sheet.name}`)));
  const sheetAreaId = (sheetId: string) => project.areas.find((area) => area.sheets.some((sheet) => sheet.id === sheetId))?.id || '';
  const sheetEquipmentOptions = (sheetId: string) => project.equipments
    .filter((equipment) => !sheetId || equipment.sheetId === sheetId)
    .map((equipment) => option(equipment.id, `${equipment.tag} ${equipment.name}`));
  const selectedEquipment = project.equipments.find((equipment) => equipment.id === selectedEquipmentId);
  const selectedLineGroup = project.lineGroups.find((group) => group.id === selectedLineGroupId) || sheetLineGroups[0] || project.lineGroups[0];
  const selectedStream = project.streams.find((stream) => stream.id === selectedStreamId);
  const selectedControl = project.controls.find((control) => control.id === selectedControlId);

  const patchProject = (patch: Partial<PidSemanticProject['project']>) => {
    setProject((prev) => ({ ...prev, project: { ...prev.project, ...patch } }));
  };

  const patchArea = (areaId: string, patch: Partial<ProcessArea>) => {
    setProject((prev) => ({ ...prev, areas: prev.areas.map((area) => (area.id === areaId ? { ...area, ...patch } : area)) }));
  };

  const patchSheet = (sheetId: string, patch: Partial<DrawingSheet>) => {
    setProject((prev) => ({
      ...prev,
      areas: prev.areas.map((area) => ({
        ...area,
        sheets: area.sheets.map((sheet) => (sheet.id === sheetId ? { ...sheet, ...patch } : sheet)),
      })),
    }));
  };

  const patchEquipment = (id: string, patch: Partial<Equipment>) => {
    setProject((prev) => ({ ...prev, equipments: prev.equipments.map((equipment) => (equipment.id === id ? { ...equipment, ...patch } : equipment)) }));
  };

  const patchLineGroup = (id: string, patch: Partial<PipeGroup>) => {
    setProject((prev) => ({ ...prev, lineGroups: prev.lineGroups.map((group) => (group.id === id ? { ...group, ...patch } : group)) }));
  };

  const patchStream = (id: string, patch: Partial<Stream>) => {
    setProject((prev) => ({
      ...prev,
      streams: prev.streams.map((stream) => (stream.id === id ? { ...stream, ...patch } : stream)),
      pipeNodes: patch.groupId
        ? prev.pipeNodes.map((node) => (node.segmentId === id ? { ...node, groupId: patch.groupId || node.groupId } : node))
        : prev.pipeNodes,
    }));
  };

  const ensurePipeNodeForEndpoint = (streamId: string, side: 'from' | 'to', segmentId?: string) => {
    setProject((prev) => {
      const stream = prev.streams.find((item) => item.id === streamId);
      if (!stream) return prev;
      const currentNodeId = side === 'from' ? stream.fromPipeNodeId : stream.toPipeNodeId;
      if (currentNodeId && prev.pipeNodes.some((node) => node.id === currentNodeId)) return prev;
      const targetSegmentId = segmentId || (side === 'from' ? stream.fromSegmentId : stream.toSegmentId);
      const segment = prev.streams.find((item) => item.id === targetSegmentId);
      if (!segment) return prev;
      const ratio = side === 'from' ? stream.fromSegmentRatio : stream.toSegmentRatio;
      const x = side === 'from' ? stream.fromContinuationX : stream.toContinuationX;
      const y = side === 'from' ? stream.fromContinuationY : stream.toContinuationY;
      const nodeKind = endpointPipeNodeKind(stream, side);
      const node: PipeNode = {
        id: uid('pipe_node'),
        groupId: segment.groupId,
        segmentId: segment.id,
        kind: nodeKind,
        tag: `${nodeKind}-${String(prev.pipeNodes.length + 1).padStart(3, '0')}`,
        name: `${stream.tag}${side === 'from' ? '起点接点' : '终点接点'}`,
        positionRatio: clampPercent(ratio),
        order: nextTopologyOrder(prev, segment.id),
        x: x || undefined,
        y: y || undefined,
        description: `由 ${stream.tag} 的${side === 'from' ? '起点' : '终点'}管段接点自动创建。`,
      };
      return {
        ...prev,
        pipeNodes: [...prev.pipeNodes, node],
        streams: prev.streams.map((item) => {
          if (item.id !== stream.id) return item;
          return side === 'from'
            ? { ...item, fromKind: '管段接点', fromSegmentId: segment.id, fromPipeNodeId: node.id }
            : { ...item, toKind: '管段接点', toSegmentId: segment.id, toPipeNodeId: node.id };
        }),
      };
    });
  };

  const patchStreamEndpointKind = (stream: Stream, side: 'from' | 'to', kind: PipeEndpointKind) => {
    const patch = side === 'from' ? { fromKind: kind } : { toKind: kind };
    patchStream(stream.id, patch);
    if (kind !== '管段接点') return;
    const segmentId = side === 'from' ? stream.fromSegmentId : stream.toSegmentId;
    if (segmentId) ensurePipeNodeForEndpoint(stream.id, side, segmentId);
  };

  const patchStreamEndpointSegment = (stream: Stream, side: 'from' | 'to', segmentId: string) => {
    setProject((prev) => {
      const current = prev.streams.find((item) => item.id === stream.id) || stream;
      const currentNodeId = side === 'from' ? current.fromPipeNodeId : current.toPipeNodeId;
      const existingNode = prev.pipeNodes.find((node) => node.id === currentNodeId);
      if (existingNode) {
        return {
          ...prev,
          pipeNodes: prev.pipeNodes.map((node) => (node.id === existingNode.id ? { ...node, segmentId } : node)),
          streams: prev.streams.map((item) => (item.id === current.id
            ? side === 'from' ? { ...item, fromSegmentId: segmentId } : { ...item, toSegmentId: segmentId }
            : item)),
        };
      }
      const segment = prev.streams.find((item) => item.id === segmentId);
      if (!segment) return prev;
      const ratio = side === 'from' ? current.fromSegmentRatio : current.toSegmentRatio;
      const nodeKind = endpointPipeNodeKind(current, side);
      const node: PipeNode = {
        id: uid('pipe_node'),
        groupId: segment.groupId,
        segmentId,
        kind: nodeKind,
        tag: `${nodeKind}-${String(prev.pipeNodes.length + 1).padStart(3, '0')}`,
        name: `${current.tag}${side === 'from' ? '起点接点' : '终点接点'}`,
        positionRatio: clampPercent(ratio),
        order: nextTopologyOrder(prev, segmentId),
        description: `由 ${current.tag} 的${side === 'from' ? '起点' : '终点'}管段接点自动创建。`,
      };
      return {
        ...prev,
        pipeNodes: [...prev.pipeNodes, node],
        streams: prev.streams.map((item) => (item.id === current.id
          ? side === 'from'
            ? { ...item, fromKind: '管段接点', fromSegmentId: segmentId, fromPipeNodeId: node.id }
            : { ...item, toKind: '管段接点', toSegmentId: segmentId, toPipeNodeId: node.id }
          : item)),
      };
    });
  };

	  const streamTouchesEquipment = (stream: Stream, equipmentId: string) => (
	    (stream.fromKind === '设备端口' && stream.fromEquipmentId === equipmentId)
	    || (stream.toKind === '设备端口' && stream.toEquipmentId === equipmentId)
	  );
	  const collectDependentStreamIds = (source: PidSemanticProject, rootIds: string[]) => {
	    const deletedIds = new Set(rootIds.filter(Boolean));
	    let changed = true;
	    while (changed) {
	      changed = false;
	      source.streams.forEach((stream) => {
	        if (deletedIds.has(stream.id)) return;
	        const dependsOnDeletedSegment = (
	          (stream.fromKind === '管段接点' && deletedIds.has(stream.fromSegmentId))
	          || (stream.toKind === '管段接点' && deletedIds.has(stream.toSegmentId))
	        );
	        if (dependsOnDeletedSegment) {
	          deletedIds.add(stream.id);
	          changed = true;
	        }
	      });
	    }
	    return deletedIds;
	  };
	  const removeStreamsFromProject = (source: PidSemanticProject, deletedStreamIds: Set<string>): PidSemanticProject => {
	    const remainingStreams = source.streams.filter((stream) => !deletedStreamIds.has(stream.id));
	    const endpointPipeNodeIds = new Set<string>();
	    source.streams.forEach((stream) => {
	      if (!deletedStreamIds.has(stream.id)) return;
	      if (stream.fromPipeNodeId) endpointPipeNodeIds.add(stream.fromPipeNodeId);
	      if (stream.toPipeNodeId) endpointPipeNodeIds.add(stream.toPipeNodeId);
	    });
	    const remainingEndpointPipeNodeIds = new Set<string>();
	    remainingStreams.forEach((stream) => {
	      if (stream.fromPipeNodeId) remainingEndpointPipeNodeIds.add(stream.fromPipeNodeId);
	      if (stream.toPipeNodeId) remainingEndpointPipeNodeIds.add(stream.toPipeNodeId);
	    });
	    return {
	      ...source,
	      streams: remainingStreams,
	      pipeNodes: source.pipeNodes.filter((node) => (
	        !deletedStreamIds.has(node.segmentId)
	        && (!endpointPipeNodeIds.has(node.id) || remainingEndpointPipeNodeIds.has(node.id))
	      )),
	      inlineComponents: source.inlineComponents.filter((component) => !deletedStreamIds.has(component.segmentId)),
	    };
	  };

  const moveEquipmentAndReroute = (id: string, x: number, y: number) => {
    setProject((prev) => resetRoutesForMovedEquipment({
      ...prev,
      equipments: prev.equipments.map((equipment) => (equipment.id === id ? { ...equipment, x, y } : equipment)),
    }, id));
  };

  const resizeEquipmentAndReroute = (id: string, x: number, y: number, width: number, height: number) => {
    setProject((prev) => resetRoutesForMovedEquipment({
      ...prev,
      equipments: prev.equipments.map((equipment) => (
        equipment.id === id ? { ...equipment, x, y, width, height } : equipment
      )),
    }, id));
  };

  const moveEquipmentPortAndReroute = (equipmentId: string, portId: string, x: number, y: number) => {
    setProject((prev) => resetRoutesForMovedEquipment({
      ...prev,
      equipments: prev.equipments.map((equipment) => (
        equipment.id === equipmentId
          ? { ...equipment, ports: equipment.ports.map((port) => (port.id === portId ? { ...port, x, y } : port)) }
          : equipment
      )),
    }, equipmentId));
  };

  const patchPipeNode = (id: string, patch: Partial<PipeNode>) => {
    setProject((prev) => ({ ...prev, pipeNodes: prev.pipeNodes.map((node) => (node.id === id ? { ...node, ...patch } : node)) }));
  };

  const patchInlineComponent = (id: string, patch: Partial<InlinePipeComponent>) => {
    setProject((prev) => ({
      ...prev,
      inlineComponents: prev.inlineComponents.map((component) => (component.id === id ? { ...component, ...patch } : component)),
    }));
  };

  const deleteInlineComponentById = (id: string) => {
    setProject((prev) => ({
      ...prev,
      inlineComponents: prev.inlineComponents.filter((component) => component.id !== id),
    }));
  };

  const topologyItemsForProject = (source: PidSemanticProject, segmentId: string, excludeKey = ''): PipeTopologyItem[] => sortTopologyItems([
    ...source.pipeNodes
      .filter((node) => node.segmentId === segmentId && `pipe:${node.id}` !== excludeKey)
      .map((node) => ({
        key: `pipe:${node.id}`,
        segmentId: node.segmentId,
        tag: node.tag,
        kind: node.kind,
        order: node.order,
        positionRatio: node.positionRatio,
      })),
    ...source.inlineComponents
      .filter((component) => component.segmentId === segmentId && `inline:${component.id}` !== excludeKey)
      .map((component) => ({
        key: `inline:${component.id}`,
        segmentId: component.segmentId,
        tag: component.tag,
        kind: component.type,
        order: component.order,
        positionRatio: component.positionRatio,
      })),
  ]);

  const nextTopologyOrder = (source: PidSemanticProject, segmentId: string, afterKey = '__start__', excludeKey = '') => {
    const items = topologyItemsForProject(source, segmentId, excludeKey);
    const afterIndex = afterKey === '__start__' ? -1 : items.findIndex((item) => item.key === afterKey);
    const previous = afterIndex >= 0 ? items[afterIndex] : undefined;
    const next = items[afterIndex + 1];
    if (previous && next) return (topologyRouteRatio(previous) + topologyRouteRatio(next)) / 2;
    if (previous) return Math.min(95, topologyRouteRatio(previous) + 10);
    if (next) return Math.max(5, topologyRouteRatio(next) - 10);
    return 50;
  };

  const topologyAnchorOptions = (segmentId: string, currentKey = '') => [
    option('__start__', '管段起点之后'),
    ...topologyItemsForProject(project, segmentId, currentKey).map((item) => option(item.key, `在 ${item.tag} ${item.kind} 之后`)),
  ];

  const currentTopologyAnchor = (segmentId: string, currentKey: string) => {
    const items = topologyItemsForProject(project, segmentId);
    const index = items.findIndex((item) => item.key === currentKey);
    return index > 0 ? items[index - 1].key : '__start__';
  };
  const endpointPipeNodeKey = (stream: Stream, side: 'from' | 'to') => {
    const pipeNodeId = side === 'from' ? stream.fromPipeNodeId : stream.toPipeNodeId;
    return pipeNodeId ? `pipe:${pipeNodeId}` : '';
  };
  const endpointTopologyAnchor = (stream: Stream, side: 'from' | 'to') => {
    const segmentId = side === 'from' ? stream.fromSegmentId : stream.toSegmentId;
    const currentKey = endpointPipeNodeKey(stream, side);
    return currentKey ? currentTopologyAnchor(segmentId, currentKey) : '__start__';
  };
  const moveStreamEndpointAfter = (streamId: string, side: 'from' | 'to', afterKey: string) => {
    setProject((prev) => {
      const stream = prev.streams.find((item) => item.id === streamId);
      if (!stream) return prev;
      const segmentId = side === 'from' ? stream.fromSegmentId : stream.toSegmentId;
      const segment = prev.streams.find((item) => item.id === segmentId);
      if (!segment) return prev;
      const currentNodeId = side === 'from' ? stream.fromPipeNodeId : stream.toPipeNodeId;
      const currentNode = currentNodeId ? prev.pipeNodes.find((node) => node.id === currentNodeId) : undefined;
      const nodeId = currentNode?.id || uid('pipe_node');
      const excludeKey = currentNode ? `pipe:${nodeId}` : '';
      const order = nextTopologyOrder(prev, segmentId, afterKey, excludeKey);
      const patch = side === 'from'
        ? { fromKind: '管段接点' as PipeEndpointKind, fromSegmentId: segmentId, fromPipeNodeId: nodeId }
        : { toKind: '管段接点' as PipeEndpointKind, toSegmentId: segmentId, toPipeNodeId: nodeId };
      const nextNode: PipeNode = {
        id: nodeId,
        groupId: segment.groupId,
        segmentId,
        kind: endpointPipeNodeKind(stream, side),
        tag: currentNode?.tag || `${endpointPipeNodeKind(stream, side)}-${String(prev.pipeNodes.length + 1).padStart(3, '0')}`,
        name: currentNode?.name || `${stream.tag}${side === 'from' ? '起点接点' : '终点接点'}`,
        positionRatio: clampPercent(order),
        order,
        description: currentNode?.description || `由 ${stream.tag} 的${side === 'from' ? '起点' : '终点'}管段接点自动创建。`,
      };
      return {
        ...prev,
        pipeNodes: currentNode
          ? prev.pipeNodes.map((node) => (node.id === nodeId ? { ...node, ...nextNode, x: undefined, y: undefined } : node))
          : [...prev.pipeNodes, nextNode],
        streams: prev.streams.map((item) => (item.id === streamId ? { ...item, ...patch } : item)),
      };
    });
  };

  const movePipeNodeAfter = (id: string, afterKey: string) => {
    setProject((prev) => {
      const node = prev.pipeNodes.find((item) => item.id === id);
      if (!node) return prev;
      const order = nextTopologyOrder(prev, node.segmentId, afterKey, `pipe:${id}`);
      return {
        ...prev,
        pipeNodes: prev.pipeNodes.map((item) => (item.id === id ? { ...item, order, positionRatio: clampPercent(order), x: undefined, y: undefined } : item)),
      };
    });
  };

  const moveInlineComponentAfter = (id: string, afterKey: string) => {
    setProject((prev) => {
      const component = prev.inlineComponents.find((item) => item.id === id);
      if (!component) return prev;
      const order = nextTopologyOrder(prev, component.segmentId, afterKey, `inline:${id}`);
      return {
        ...prev,
        inlineComponents: prev.inlineComponents.map((item) => (item.id === id ? { ...item, order, positionRatio: clampPercent(order), x: undefined, y: undefined } : item)),
      };
    });
  };

  const patchControl = (id: string, patch: Partial<ControlInterlock>) => {
    setProject((prev) => ({ ...prev, controls: prev.controls.map((control) => (control.id === id ? { ...control, ...patch } : control)) }));
  };

  const addArea = () => {
    const id = uid('area');
    const sheetId = uid('sheet');
    setProject((prev) => ({
      ...prev,
      currentAreaId: id,
      currentSheetId: sheetId,
      areas: [...prev.areas, { id, name: newAreaName.trim() || `工段 ${prev.areas.length + 1}`, objective: '', sheets: [{ id: sheetId, name: '图纸 1', description: '' }] }],
    }));
    setNewAreaName('');
  };

  const addSheet = () => {
    const id = uid('sheet');
    setProject((prev) => ({
      ...prev,
      currentSheetId: id,
      areas: prev.areas.map((area) => (
        area.id === prev.currentAreaId
          ? { ...area, sheets: [...area.sheets, { id, name: newSheetName.trim() || `图纸 ${area.sheets.length + 1}`, description: '' }] }
          : area
      )),
    }));
    setNewSheetName('');
  };

  const deleteCurrentArea = () => {
    if (!currentArea) return;
    if (project.areas.length <= 1) {
      message.warning('至少需要保留一个工段。');
      return;
    }
    const deletedSheetIds = new Set(currentArea.sheets.map((sheet) => sheet.id));
    const deletedEquipmentIds = new Set(project.equipments.filter((equipment) => deletedSheetIds.has(equipment.sheetId)).map((equipment) => equipment.id));
    const deletedStreamIds = new Set(project.streams.filter((stream) => deletedSheetIds.has(stream.sheetId)).map((stream) => stream.id));
    const remainingAreas = project.areas.filter((area) => area.id !== currentArea.id);
    const nextArea = remainingAreas[0];
    const nextSheet = nextArea.sheets[0];
    setProject((prev) => ({
      ...prev,
      currentAreaId: nextArea.id,
      currentSheetId: nextSheet.id,
      areas: remainingAreas,
      equipments: prev.equipments.filter((equipment) => !deletedEquipmentIds.has(equipment.id)),
      lineGroups: prev.lineGroups.filter((group) => !deletedSheetIds.has(group.sheetId)),
      streams: prev.streams.filter((stream) => !deletedStreamIds.has(stream.id)),
      pipeNodes: prev.pipeNodes.filter((node) => !deletedStreamIds.has(node.segmentId)),
      inlineComponents: prev.inlineComponents.filter((component) => !deletedStreamIds.has(component.segmentId)),
      controls: prev.controls.filter((control) => !deletedEquipmentIds.has(control.triggerEquipmentId) && !deletedEquipmentIds.has(control.actionEquipmentId)),
    }));
    setSelectedEquipmentId('');
    setSelectedLineGroupId(project.lineGroups.find((group) => group.sheetId === nextSheet.id)?.id || '');
    setSelectedStreamId('');
  };

  const deleteCurrentSheet = () => {
    if (!currentArea || !currentSheet) return;
    if (currentArea.sheets.length <= 1) {
      message.warning('当前工段至少需要保留一张图纸。');
      return;
    }
    const nextSheet = currentArea.sheets.find((sheet) => sheet.id !== currentSheet.id);
    if (!nextSheet) return;
    const deletedEquipmentIds = new Set(project.equipments.filter((equipment) => equipment.sheetId === currentSheet.id).map((equipment) => equipment.id));
    const deletedStreamIds = new Set(project.streams.filter((stream) => stream.sheetId === currentSheet.id).map((stream) => stream.id));
    setProject((prev) => ({
      ...prev,
      currentSheetId: nextSheet.id,
      areas: prev.areas.map((area) => (
        area.id === currentArea.id
          ? { ...area, sheets: area.sheets.filter((sheet) => sheet.id !== currentSheet.id) }
          : area
      )),
      equipments: prev.equipments.filter((equipment) => !deletedEquipmentIds.has(equipment.id)),
      lineGroups: prev.lineGroups.filter((group) => group.sheetId !== currentSheet.id),
      streams: prev.streams.filter((stream) => !deletedStreamIds.has(stream.id)),
      pipeNodes: prev.pipeNodes.filter((node) => !deletedStreamIds.has(node.segmentId)),
      inlineComponents: prev.inlineComponents.filter((component) => !deletedStreamIds.has(component.segmentId)),
      controls: prev.controls.filter((control) => !deletedEquipmentIds.has(control.triggerEquipmentId) && !deletedEquipmentIds.has(control.actionEquipmentId)),
    }));
    setSelectedEquipmentId('');
    setSelectedLineGroupId(project.lineGroups.find((group) => group.sheetId === nextSheet.id)?.id || '');
    setSelectedStreamId('');
  };

  const changeCurrentSheetArea = (targetAreaId: string) => {
    if (!currentSheet) {
      message.warning('请先选择一张图纸。');
      return;
    }
    const sourceArea = project.areas.find((area) => area.sheets.some((sheet) => sheet.id === currentSheet.id));
    const targetArea = project.areas.find((area) => area.id === targetAreaId);
    if (!sourceArea || !targetArea) {
      message.warning('请选择图纸所属工段。');
      return;
    }
    if (sourceArea.id === targetArea.id) {
      setSheetMoveTargetAreaId(targetArea.id);
      return;
    }
    const placeholderSheet: DrawingSheet = {
      id: uid('sheet'),
      name: '待规划图纸',
      description: '调整图纸所属工段时自动保留，后续可重命名或删除。',
    };

    setProject((prev) => ({
      ...prev,
      currentAreaId: targetArea.id,
      currentSheetId: currentSheet.id,
      areas: prev.areas.map((area) => {
        if (area.id === sourceArea.id) {
          const remainingSheets = area.sheets.filter((sheet) => sheet.id !== currentSheet.id);
          return { ...area, sheets: remainingSheets.length > 0 ? remainingSheets : [placeholderSheet] };
        }
        if (area.id === targetArea.id) {
          const sheets = area.sheets.filter((sheet) => sheet.id !== currentSheet.id);
          return { ...area, sheets: [...sheets, currentSheet] };
        }
        return area;
      }),
      equipments: prev.equipments.map((equipment) => (
        equipment.sheetId === currentSheet.id ? { ...equipment, areaId: targetArea.id } : equipment
      )),
    }));
    setSheetMoveTargetAreaId(targetArea.id);
    message.success(`图纸已归入 ${targetArea.name}。`);
  };

  const nextTag = (type: EquipmentType) => {
    const prefix = EQUIPMENT_PREFIXES[type];
    const count = project.equipments.filter((equipment) => equipment.type === type).length + 1;
    return `${prefix}-${String(count).padStart(3, '0')}`;
  };

  const addEquipment = () => {
    const equipment = equipmentTemplate(
      newEquipmentType,
      nextTag(newEquipmentType),
      project.currentSheetId,
      project.currentAreaId || currentArea?.id || '',
      180 + sheetEquipments.length * 36,
      140 + sheetEquipments.length * 28,
    );
    setProject((prev) => ({ ...prev, equipments: [...prev.equipments, equipment] }));
    setSelectedEquipmentId(equipment.id);
    setActiveTab('canvas');
  };

	  const duplicateEquipment = () => {
    if (!selectedEquipment) return;
    const copy: Equipment = {
      ...structuredClone(selectedEquipment),
      id: uid('eq'),
      x: selectedEquipment.x + 30,
      y: selectedEquipment.y + 30,
    };
    setProject((prev) => ({ ...prev, equipments: [...prev.equipments, copy] }));
    setSelectedEquipmentId(copy.id);
	  };

	  const deleteEquipmentById = (equipmentId: string) => {
	    setProject((prev) => {
	      const equipment = prev.equipments.find((item) => item.id === equipmentId);
	      if (!equipment) return prev;
	      const rootStreamIds = prev.streams.filter((stream) => streamTouchesEquipment(stream, equipmentId)).map((stream) => stream.id);
	      const deletedStreamIds = collectDependentStreamIds(prev, rootStreamIds);
	      return {
	        ...removeStreamsFromProject(prev, deletedStreamIds),
	        equipments: prev.equipments.filter((item) => item.id !== equipmentId),
	        controls: prev.controls.filter((control) => control.triggerEquipmentId !== equipmentId && control.actionEquipmentId !== equipmentId),
	      };
	    });
	    setSelectedEquipmentId((current) => (current === equipmentId ? '' : current));
	    setSelectedStreamId('');
	    message.success('已删除设备及其关联管线。');
	  };

	  const deleteEquipment = () => {
	    if (!selectedEquipment) return;
	    deleteEquipmentById(selectedEquipment.id);
	  };

	  const deleteStreamById = (streamId: string) => {
	    setProject((prev) => {
	      if (!prev.streams.some((stream) => stream.id === streamId)) return prev;
	      const deletedStreamIds = collectDependentStreamIds(prev, [streamId]);
	      return removeStreamsFromProject(prev, deletedStreamIds);
	    });
	    setSelectedStreamId((current) => (current === streamId ? '' : current));
	    message.success('已删除管线及依赖的支管/元件。');
	  };

  const addStream = () => {
    if (project.equipments.length < 2) {
      message.warning('至少需要两个设备才能新增物流。');
      return;
    }
    const group = selectedLineGroup || project.lineGroups[0];
    const from = project.equipments[0];
    const to = project.equipments[1];
    const stream: Stream = {
      id: uid('line'),
      groupId: group?.id || '',
      sheetId: project.currentSheetId,
      tag: `L-${String(project.streams.length + 1).padStart(3, '0')}`,
      name: '',
      role: group?.role || '主物流',
      branchType: '主管段',
      directionMode: group?.directionMode || '单向',
      medium: group?.medium || from.ports[0]?.medium || '',
      fromKind: '设备端口',
      fromEquipmentId: from.id,
      fromPortId: from.ports[0]?.id || '',
      fromSegmentId: '',
      fromSegmentRatio: 50,
      fromReferenceLabel: '',
      fromReferenceArea: '',
      fromReferenceSheet: '',
      fromReferenceEquipment: '',
      fromReferencePort: '',
      fromReferenceX: 160,
      fromReferenceY: 200,
      fromContinuationX: 0,
      fromContinuationY: 0,
      toKind: '设备端口',
      toEquipmentId: to.id,
      toPortId: to.ports[0]?.id || '',
      toSegmentId: '',
      toSegmentRatio: 50,
      toReferenceLabel: '',
      toReferenceArea: '',
      toReferenceSheet: '',
      toReferenceEquipment: '',
      toReferencePort: '',
      toReferenceX: 900,
      toReferenceY: 200,
      toContinuationX: 0,
      toContinuationY: 0,
      manualWaypoints: [],
      dn: '',
      pn: '',
      material: 'CS',
      intent: '',
    };
    setProject((prev) => ({ ...prev, streams: [...prev.streams, stream] }));
    setSelectedStreamId(stream.id);
    setActiveTab('streams');
  };

  const streamOptionLabel = (stream: Pick<Stream, 'tag' | 'name' | 'branchType'>) => streamDisplayLabel(stream);

  const createStreamFromPorts = (fromEquipmentId: string, fromPortId: string, toEquipmentId: string, toPortId: string) => {
    const from = project.equipments.find((equipment) => equipment.id === fromEquipmentId);
    const to = project.equipments.find((equipment) => equipment.id === toEquipmentId);
    const fromPort = from?.ports.find((port) => port.id === fromPortId);
    const toPort = to?.ports.find((port) => port.id === toPortId);
    if (!from || !to || !fromPort || !toPort) return;
    const group = selectedLineGroup || project.lineGroups.find((item) => item.sheetId === project.currentSheetId) || project.lineGroups[0];
    const stream: Stream = {
      id: uid('line'),
      groupId: group?.id || '',
      sheetId: project.currentSheetId,
      tag: `L-${String(project.streams.length + 1).padStart(3, '0')}`,
      name: `${from.name || from.tag} 至 ${to.name || to.tag}`,
      role: group?.role || fromPort.role || '主物流',
      branchType: '主管段',
      directionMode: group?.directionMode || '单向',
      medium: group?.medium || fromPort.medium || toPort.medium || '',
      fromKind: '设备端口',
      fromEquipmentId,
      fromPortId,
      fromSegmentId: '',
      fromSegmentRatio: 50,
      fromReferenceLabel: '',
      fromReferenceArea: '',
      fromReferenceSheet: '',
      fromReferenceEquipment: '',
      fromReferencePort: '',
      fromReferenceX: from.x + from.width + 80,
      fromReferenceY: from.y + from.height / 2,
      fromContinuationX: 0,
      fromContinuationY: 0,
      toKind: '设备端口',
      toEquipmentId,
      toPortId,
      toSegmentId: '',
      toSegmentRatio: 50,
      toReferenceLabel: '',
      toReferenceArea: '',
      toReferenceSheet: '',
      toReferenceEquipment: '',
      toReferencePort: '',
      toReferenceX: to.x - 80,
      toReferenceY: to.y + to.height / 2,
      toContinuationX: 0,
      toContinuationY: 0,
      manualWaypoints: [],
      dn: '',
      pn: '',
      material: 'CS',
      intent: `${from.tag}.${fromPort.id} 至 ${to.tag}.${toPort.id}`,
    };
    setProject((prev) => ({ ...prev, streams: [...prev.streams, stream] }));
    setSelectedStreamId(stream.id);
    setSelectedEquipmentId('');
    setActiveTab('canvas');
  };

  const addInlineComponent = () => {
    const group = selectedLineGroup || project.lineGroups[0];
    const segment = project.streams.find((stream) => stream.groupId === group?.id) || project.streams[0];
    if (!segment) {
      message.warning('请先在管线组中新增管段。');
      return;
    }
    const component: InlinePipeComponent = {
      id: uid('inline'),
      segmentId: segment.id,
      tag: `HV-${String(project.inlineComponents.length + 1).padStart(3, '0')}`,
      type: '手动阀',
      name: '管道阀门',
      positionRatio: 50,
      order: nextTopologyOrder(project, segment.id),
      normalState: '常开',
      actuator: '手轮',
      controlSignal: '',
      description: '',
    };
    setProject((prev) => ({ ...prev, inlineComponents: [...prev.inlineComponents, component] }));
    setActiveTab('streams');
  };

  const createInlineComponentAt = (segmentId: string, positionRatio: number, type: InlinePipeComponentType) => {
    const segment = project.streams.find((stream) => stream.id === segmentId);
    if (!segment) {
      message.warning('没有找到可插入元件的管段。');
      return;
    }
    const prefixByType: Record<InlinePipeComponentType, string> = {
      手动阀: 'HV',
      控制阀: 'CV',
      切断阀: 'XV',
      止回阀: 'CV',
      安全阀: 'PSV',
      调节阀: 'LV',
      流量计: 'FI',
      压力测点: 'PI',
      温度测点: 'TI',
      就地压力测点: 'PG',
      远传压力测点: 'PI',
      就地温度测点: 'TG',
      远传温度测点: 'TI',
      分析测点: 'AI',
      过滤器: 'F',
      爆破片: 'BD',
      盲板: 'BL',
      疏水阀: 'ST',
    };
    const component: InlinePipeComponent = {
      id: uid('inline'),
      segmentId: segment.id,
      tag: `${prefixByType[type]}-${String(project.inlineComponents.length + 1).padStart(3, '0')}`,
      type,
      name: type,
      positionRatio,
      order: positionRatio,
      normalState: isMeasurementInlineType(type) || type === '过滤器' || type === '爆破片' || type === '盲板' ? '' : '常开',
      actuator: isMeasurementInlineType(type) ? '' : defaultInlineActuator(type),
      controlSignal: type === '控制阀' || type === '调节阀' ? '控制信号' : '',
      description: '',
    };
    setProject((prev) => ({ ...prev, inlineComponents: [...prev.inlineComponents, component] }));
    setSelectedStreamId(segment.id);
    setActiveTab('canvas');
  };

  const addPipeNode = () => {
    const group = selectedLineGroup || project.lineGroups[0];
    const segment = project.streams.find((stream) => stream.groupId === group?.id) || project.streams[0];
    if (!segment) {
      message.warning('请先在管线组中新增管段。');
      return;
    }
    const node: PipeNode = {
      id: uid('pipe_node'),
      groupId: segment.groupId,
      segmentId: segment.id,
      kind: '支管点',
      tag: `NODE-${String(project.pipeNodes.length + 1).padStart(3, '0')}`,
      name: '管线拓扑节点',
      positionRatio: 50,
      order: nextTopologyOrder(project, segment.id),
      description: '',
    };
    setProject((prev) => ({ ...prev, pipeNodes: [...prev.pipeNodes, node] }));
    setActiveTab('streams');
  };

  const createPipeNodeAt = (segmentId: string, positionRatio: number, kind: PipeNodeKind) => {
    const segment = project.streams.find((stream) => stream.id === segmentId);
    if (!segment) {
      message.warning('没有找到可增加拓扑点的管段。');
      return;
    }
    const prefixByKind: Record<PipeNodeKind, string> = {
      支管点: 'BR',
      汇入点: 'MJ',
      分出点: 'BR',
      变径点: 'RD',
      取样点: 'SP',
      排净点: 'DR',
      在线元件: 'IN',
    };
    const node: PipeNode = {
      id: uid('pipe_node'),
      groupId: segment.groupId,
      segmentId: segment.id,
      kind,
      tag: `${prefixByKind[kind]}-${String(project.pipeNodes.length + 1).padStart(3, '0')}`,
      name: kind === '分出点' ? '分支点' : kind,
      positionRatio,
      order: positionRatio,
      description: '',
    };
    setProject((prev) => ({ ...prev, pipeNodes: [...prev.pipeNodes, node] }));
    setSelectedStreamId(segment.id);
    setActiveTab('canvas');
  };

  const createPipeStreamFromPort = ({ equipmentId, portId, point, branchType, attachSide }: PipeStreamPortStartParams) => {
    const equipment = project.equipments.find((item) => item.id === equipmentId);
    const port = equipment?.ports.find((item) => item.id === portId);
    const group = selectedLineGroup || project.lineGroups.find((item) => item.sheetId === project.currentSheetId) || project.lineGroups[0];
    if (!equipment || !port || !group) {
      message.warning('没有找到可用于创建管线的设备连接桩。');
      return undefined;
    }
    const streamId = uid('line');
    const stream: Stream = {
      id: streamId,
      groupId: group.id,
      sheetId: project.currentSheetId,
      tag: `L-${String(project.streams.length + 1).padStart(3, '0')}`,
      name: `${equipment.name || equipment.tag}${branchType}`,
      role: group.role || port.role || '主物流',
      branchType,
      directionMode: group.directionMode || '单向',
      medium: group.medium || port.medium || '',
      fromKind: attachSide === 'from' ? '设备端口' : '界外来源',
      fromEquipmentId: attachSide === 'from' ? equipment.id : '',
      fromPortId: attachSide === 'from' ? port.id : '',
      fromSegmentId: '',
      fromSegmentRatio: 50,
      fromPipeNodeId: '',
      fromReferenceLabel: attachSide === 'from' ? '' : '待选择起点',
      fromReferenceArea: '',
      fromReferenceSheet: '',
      fromReferenceEquipment: '',
      fromReferencePort: '',
      fromReferenceX: snapToGrid(point.x - 140),
      fromReferenceY: snapToGrid(point.y),
      fromContinuationX: 0,
      fromContinuationY: 0,
      toKind: attachSide === 'to' ? '设备端口' : '界外去向',
      toEquipmentId: attachSide === 'to' ? equipment.id : '',
      toPortId: attachSide === 'to' ? port.id : '',
      toSegmentId: '',
      toSegmentRatio: 50,
      toPipeNodeId: '',
      toReferenceLabel: attachSide === 'to' ? '' : '待选择终点',
      toReferenceArea: '',
      toReferenceSheet: '',
      toReferenceEquipment: '',
      toReferencePort: '',
      toReferenceX: snapToGrid(point.x + 140),
      toReferenceY: snapToGrid(point.y),
      toContinuationX: 0,
      toContinuationY: 0,
      manualWaypoints: [],
      dn: '',
      pn: '',
      material: 'CS',
      intent: `${equipment.tag}.${port.id} ${branchType}`,
    };
    setProject((prev) => ({ ...prev, streams: [...prev.streams, stream] }));
    setSelectedStreamId(streamId);
    setSelectedEquipmentId('');
    setActiveTab('canvas');
    return streamId;
  };

  const createPipeStreamFromPoint = ({ segmentId, ratio, point, branchType, attachSide }: PipeStreamStartParams) => {
    const segment = project.streams.find((stream) => stream.id === segmentId);
    if (!segment) {
      message.warning('没有找到用于创建新管线的主管段。');
      return undefined;
    }
    const sourceGroup = project.lineGroups.find((group) => group.id === segment.groupId);
    const inheritedRole = segment.role || sourceGroup?.role || '主物流';
    const inheritedDirectionMode = segment.directionMode || sourceGroup?.directionMode || '单向';
    const inheritedMedium = segment.medium || sourceGroup?.medium || '';
    const nodeKind: PipeNodeKind = attachSide === 'from' ? '分出点' : '汇入点';
    const nodeId = uid('pipe_node');
    const streamId = uid('line');
    const node: PipeNode = {
      id: nodeId,
      groupId: segment.groupId,
      segmentId: segment.id,
      kind: nodeKind,
      tag: `${nodeKind}-${String(project.pipeNodes.length + 1).padStart(3, '0')}`,
      name: `${segment.tag}${attachSide === 'from' ? '分出接点' : '汇入接点'}`,
      positionRatio: ratio,
      order: ratio,
      description: `由画布右键在 ${segment.tag} 上创建。`,
    };
    const stream: Stream = {
      id: streamId,
      groupId: segment.groupId,
      sheetId: project.currentSheetId,
      tag: `L-${String(project.streams.length + 1).padStart(3, '0')}`,
      name: `${segment.name || segment.tag}派生${branchType}`,
      role: inheritedRole,
      branchType,
      directionMode: inheritedDirectionMode,
      medium: inheritedMedium,
      fromKind: attachSide === 'from' ? '管段接点' : '界外来源',
      fromEquipmentId: '',
      fromPortId: '',
      fromSegmentId: attachSide === 'from' ? segment.id : '',
      fromSegmentRatio: attachSide === 'from' ? ratio : 50,
      fromPipeNodeId: attachSide === 'from' ? nodeId : '',
      fromReferenceLabel: attachSide === 'from' ? '' : '待选择起点',
      fromReferenceArea: '',
      fromReferenceSheet: '',
      fromReferenceEquipment: '',
      fromReferencePort: '',
      fromReferenceX: snapToGrid(point.x - 140),
      fromReferenceY: snapToGrid(point.y),
      fromContinuationX: 0,
      fromContinuationY: 0,
      toKind: attachSide === 'to' ? '管段接点' : '界外去向',
      toEquipmentId: '',
      toPortId: '',
      toSegmentId: attachSide === 'to' ? segment.id : '',
      toSegmentRatio: attachSide === 'to' ? ratio : 50,
      toPipeNodeId: attachSide === 'to' ? nodeId : '',
      toReferenceLabel: attachSide === 'to' ? '' : '待选择终点',
      toReferenceArea: '',
      toReferenceSheet: '',
      toReferenceEquipment: '',
      toReferencePort: '',
      toReferenceX: snapToGrid(point.x + 140),
      toReferenceY: snapToGrid(point.y),
      toContinuationX: 0,
      toContinuationY: 0,
      manualWaypoints: [],
      dn: segment.dn,
      pn: segment.pn,
      material: segment.material,
      intent: `由 ${segment.tag} 派生的${branchType}`,
    };
    setProject((prev) => ({ ...prev, pipeNodes: [...prev.pipeNodes, node], streams: [...prev.streams, stream] }));
    setSelectedStreamId(streamId);
    setSelectedEquipmentId('');
    setActiveTab('canvas');
    return streamId;
  };

  const completePipeStreamEndpoint = (streamId: string, side: 'from' | 'to', target: PipeEndpointSelectionTarget) => {
    setProject((prev) => {
      const stream = prev.streams.find((item) => item.id === streamId);
      if (!stream) return prev;
      const patch: Partial<Stream> = {};
      const clearReference = side === 'from'
        ? {
          fromReferenceLabel: '',
          fromReferenceArea: '',
          fromReferenceSheet: '',
          fromReferenceEquipment: '',
          fromReferencePort: '',
        }
        : {
          toReferenceLabel: '',
          toReferenceArea: '',
          toReferenceSheet: '',
          toReferenceEquipment: '',
          toReferencePort: '',
        };
      let nextPipeNodes = prev.pipeNodes;
      if (target.kind === '设备端口') {
        Object.assign(patch, side === 'from'
          ? {
            fromKind: '设备端口',
            fromEquipmentId: target.equipmentId,
            fromPortId: target.portId,
            fromSegmentId: '',
            fromPipeNodeId: '',
            ...clearReference,
          }
          : {
            toKind: '设备端口',
            toEquipmentId: target.equipmentId,
            toPortId: target.portId,
            toSegmentId: '',
            toPipeNodeId: '',
            ...clearReference,
          });
      } else if (target.kind === '管段接点') {
        const segment = prev.streams.find((item) => item.id === target.segmentId);
        if (!segment) return prev;
        const nodeKind: PipeNodeKind = side === 'from' ? '分出点' : '汇入点';
        const nodeId = uid('pipe_node');
        const node: PipeNode = {
          id: nodeId,
          groupId: segment.groupId,
          segmentId: segment.id,
          kind: nodeKind,
          tag: `${nodeKind}-${String(prev.pipeNodes.length + 1).padStart(3, '0')}`,
          name: `${stream.tag}${side === 'from' ? '起点接点' : '终点接点'}`,
          positionRatio: target.ratio,
          order: target.ratio,
          description: `由画布选择 ${segment.tag} 作为${side === 'from' ? '起点' : '终点'}。`,
        };
        nextPipeNodes = [...prev.pipeNodes, node];
        Object.assign(patch, side === 'from'
          ? {
            fromKind: '管段接点',
            fromSegmentId: segment.id,
            fromSegmentRatio: target.ratio,
            fromPipeNodeId: nodeId,
            ...clearReference,
          }
          : {
            toKind: '管段接点',
            toSegmentId: segment.id,
            toSegmentRatio: target.ratio,
            toPipeNodeId: nodeId,
            ...clearReference,
          });
      } else {
        Object.assign(patch, side === 'from'
          ? {
            fromKind: '界外来源',
            fromEquipmentId: '',
            fromPortId: '',
            fromSegmentId: '',
            fromPipeNodeId: '',
            fromReferenceLabel: '',
            fromReferenceX: target.x,
            fromReferenceY: target.y,
          }
          : {
            toKind: '界外去向',
            toEquipmentId: '',
            toPortId: '',
            toSegmentId: '',
            toPipeNodeId: '',
            toReferenceLabel: '',
            toReferenceX: target.x,
            toReferenceY: target.y,
          });
      }
      return {
        ...prev,
        pipeNodes: nextPipeNodes,
        streams: prev.streams.map((item) => (item.id === streamId ? { ...item, ...patch } : item)),
      };
    });
    setSelectedStreamId(streamId);
    setActiveTab('canvas');
  };

  const addLineGroup = () => {
    const group: PipeGroup = {
      id: uid('pipe_group'),
      sheetId: project.currentSheetId,
      tag: `PIPE-GROUP-${String(project.lineGroups.length + 1).padStart(3, '0')}`,
      name: '管线组',
      role: '主物流',
      medium: '',
      directionMode: '单向',
      boundaryIn: '',
      boundaryOut: '',
      purpose: '',
      reverseCondition: '',
      notes: '',
    };
    setProject((prev) => ({ ...prev, lineGroups: [...prev.lineGroups, group] }));
    setSelectedLineGroupId(group.id);
  };

  const addControl = () => {
    const equipment = selectedEquipment || project.equipments[0];
    const control: ControlInterlock = {
      id: uid('ctl'),
      kind: '联锁保护',
      tag: `SIS-${String(project.controls.length + 1).padStart(3, '0')}`,
      scope: currentArea?.name || '',
      triggerEquipmentId: equipment?.id || '',
      triggerPartId: equipment?.parts[0]?.id || '',
      condition: '',
      actionEquipmentId: equipment?.id || '',
      actionTargetId: equipment?.parts[0]?.id || '',
      action: '',
      purpose: '',
      reset: '',
    };
    setProject((prev) => ({ ...prev, controls: [...prev.controls, control] }));
    setSelectedControlId(control.id);
    setActiveTab('controls');
  };

  const addNarrative = () => {
    const item: ProcessNarrativeItem = { id: uid('nar'), level: '工段', subject: currentArea?.name || '工艺工段', generated: '', reviewed: '' };
    setProject((prev) => ({ ...prev, narratives: [...prev.narratives, item] }));
    setActiveTab('narrative');
  };

  const saveLocal = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    message.success('已保存到浏览器本地。');
  };

  const applyLoadedProject = (next: PidSemanticProject) => {
    setProject(next);
    setSelectedEquipmentId(next.equipments[0]?.id || '');
    setSelectedLineGroupId(next.lineGroups[0]?.id || '');
    setSelectedStreamId(next.streams[0]?.id || '');
    setSelectedControlId(next.controls[0]?.id || '');
    setActiveTab('canvas');
  };

  const saveProjectToNetwork = async (projectToSave: PidSemanticProject, successText = '网络工程已保存。', forceCreate = false) => {
    setNetworkLoading(true);
    try {
      const activeProjectId = forceCreate ? '' : networkProjectId;
      const payload = await requestNetworkProject(
        activeProjectId ? `/_api/network-projects/${encodeURIComponent(activeProjectId)}` : '/_api/network-projects',
        {
          method: activeProjectId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(activeProjectId
            ? { project: projectToSave, expectedVersion: networkVersion ?? undefined }
            : { project: projectToSave }),
        },
      );
      if (!payload.metadata) throw new Error('Missing network project metadata');
      setNetworkProjectId(payload.metadata.id);
      setNetworkVersion(payload.metadata.version);
      await refreshNetworkProjects();
      message.success(`${successText} v${payload.metadata.version}`);
    } catch (error) {
      message.error(`网络保存失败：${(error as Error).message}`);
    } finally {
      setNetworkLoading(false);
    }
  };

  const saveNetworkProject = async () => {
    await saveProjectToNetwork(project);
  };

  const loadNetworkProject = async (id: string) => {
    if (!id) return;
    setNetworkLoading(true);
    try {
      const payload = await requestNetworkProject(`/_api/network-projects/${encodeURIComponent(id)}`);
      if (!payload.project || !payload.metadata) throw new Error('Network project payload incomplete');
      const next = normalizeProject(payload.project);
      applyLoadedProject(next);
      setNetworkProjectId(payload.metadata.id);
      setNetworkVersion(payload.metadata.version);
      message.success(`已加载网络工程：${payload.metadata.name || payload.metadata.id}`);
    } catch (error) {
      message.error(`加载网络工程失败：${(error as Error).message}`);
    } finally {
      setNetworkLoading(false);
    }
  };

  const importLocalAsNetworkProject = async () => {
    try {
      const next = await readProjectFile();
      if (!next) return;
      applyLoadedProject(next);
      setNetworkProjectId('');
      setNetworkVersion(null);
      await saveProjectToNetwork(next, '本地工程已导入为网络工程。', true);
    } catch {
      message.error('项目文件格式不正确。');
    }
  };

  const appendLocalProjectToCurrent = async () => {
    try {
      const imported = await readProjectFile();
      if (!imported) return;
      const result = appendProjectAsSheets(project, imported);
      setProject(result.project);
      setSelectedEquipmentId(result.firstEquipmentId || selectedEquipmentId);
      setSelectedLineGroupId(result.firstLineGroupId || selectedLineGroupId);
      setSelectedStreamId(result.firstStreamId || selectedStreamId);
      setSelectedControlId(result.firstControlId || selectedControlId);
      setActiveTab('canvas');
      await saveProjectToNetwork(result.project, `已追加 ${result.addedSheetCount} 张图纸、${result.addedEquipmentCount} 台设备、${result.addedStreamCount} 条管段。`);
    } catch {
      message.error('追加导入失败，请确认选择的是工程项目 JSON。');
    }
  };

  const exportDataFile = async (options: {
    fileName: string;
    content: string;
    mimeType: string;
    description: string;
    extensions: string[];
    successText: string;
  }) => {
    const blob = new Blob([options.content], { type: options.mimeType });
    const filePicker = (window as Window & {
      showSaveFilePicker?: (options: {
        suggestedName: string;
        types: Array<{ description: string; accept: Record<string, string[]> }>;
      }) => Promise<{ createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }> }>;
    }).showSaveFilePicker;

    if (filePicker) {
      try {
        const handle = await filePicker({
          suggestedName: options.fileName,
          types: [{ description: options.description, accept: { [options.mimeType]: options.extensions } }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        message.success(options.successText);
        return;
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
      }
    }

    try {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = options.fileName;
      link.rel = 'noopener';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      window.setTimeout(() => {
        URL.revokeObjectURL(url);
        link.remove();
      }, 1000);
      message.success(options.successText);
    } catch {
      message.error('导出失败，请检查浏览器下载权限。');
    }
  };

  type DirectoryPickerFileHandle = {
    createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }>;
  };
  type DirectoryPickerHandle = {
    getDirectoryHandle: (name: string, options?: { create?: boolean }) => Promise<DirectoryPickerHandle>;
    getFileHandle: (name: string, options?: { create?: boolean }) => Promise<DirectoryPickerFileHandle>;
  };
  const publishDirectoryName = (project.project.drawingNo || 'pid-semantic-project').replace(/[\\/:*?"<>|\s]+/g, '_');
  const writeFileToDirectory = async (root: DirectoryPickerHandle, filePath: string, content: string) => {
    const parts = filePath.split('/').filter(Boolean);
    const fileName = parts.pop();
    if (!fileName) return;
    let directory = root;
    for (const part of parts) {
      directory = await directory.getDirectoryHandle(part, { create: true });
    }
    const handle = await directory.getFileHandle(fileName, { create: true });
    const writable = await handle.createWritable();
    await writable.write(new Blob([content], { type: fileName.endsWith('.md') ? 'text/markdown' : 'application/json' }));
    await writable.close();
  };
  const publishAgentPackageWithDevServer = async (packageFiles: Record<string, string>) => {
    const response = await fetch('/_api/publish-agent-package', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        directoryName: publishDirectoryName,
        files: packageFiles,
      }),
    });
    const text = await response.text();
    let body: { success?: boolean; directory?: string; message?: string; files?: number } = {};
    try {
      body = JSON.parse(text) as typeof body;
    } catch {
      body = { success: false, message: text };
    }
    if (!response.ok || !body.success) throw new Error(body.message || `HTTP ${response.status}`);
    return body;
  };
  const publishAgentPackageToDirectory = async () => {
    const packageFiles = buildAgentPublishPackage(project).files;
    try {
      const result = await publishAgentPackageWithDevServer(packageFiles);
      message.success(`已发布到 ${result.directory || `agent-packages/${publishDirectoryName}`}`);
      return;
    } catch {
      // Dev server API is only available in local development; browser directory access is the fallback.
    }

    const directoryPicker = (window as Window & {
      showDirectoryPicker?: (options?: { id?: string; mode?: 'read' | 'readwrite' }) => Promise<DirectoryPickerHandle>;
    }).showDirectoryPicker;
    if (!directoryPicker) {
      message.error('当前运行环境不支持直接目录发布。请重启本地 dev server 后重试，或使用“下载发布包”。');
      return;
    }
    try {
      const root = await directoryPicker({ id: 'pid-agent-packages', mode: 'readwrite' });
      const packageDirectory = await root.getDirectoryHandle(publishDirectoryName, { create: true });
      await Promise.all(Object.entries(packageFiles).map(([filePath, content]) => writeFileToDirectory(packageDirectory, filePath, content)));
      message.success(`已发布到目录：${publishDirectoryName}`);
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;
      message.error('发布到目录失败，请确认浏览器目录写入权限。');
    }
  };

  const exportProject = async () => {
    await exportDataFile({
      fileName: `${project.project.drawingNo || 'pid-semantic-project'}.pid-project.json`,
      content: JSON.stringify(project, null, 2),
      mimeType: 'application/json',
      description: 'P&ID 工程编辑项目 JSON',
      extensions: ['.json'],
      successText: '工程项目已导出。',
    });
  };

  const exportAgentSemanticIR = async () => {
    const packageFiles = buildAgentPublishPackage(project).files;
    await exportDataFile({
      fileName: `${project.project.drawingNo || 'pid-semantic-project'}.semantic-ir.json`,
      content: packageFiles['semantic-ir.json'],
      mimeType: 'application/json',
      description: '智能体语义 IR JSON',
      extensions: ['.json'],
      successText: '智能体语义 IR 已导出。',
    });
  };

  const exportAgentPackage = async () => {
    const packageFiles = buildAgentPublishPackage(project).files;
    await exportDataFile({
      fileName: `${project.project.drawingNo || 'pid-semantic-project'}.agent-package.json`,
      content: packageFiles['agent-package.json'],
      mimeType: 'application/json',
      description: '智能体发布资料包 JSON',
      extensions: ['.json'],
      successText: '智能体发布包已导出。',
    });
  };

  const exportEquipmentAgentContext = async () => {
    const equipmentAgentContext = selectedEquipment ? buildEquipmentAgentContext(project, selectedEquipment.id) : undefined;
    if (!equipmentAgentContext) {
      message.warning('请先选择一个设备。');
      return;
    }
    await exportDataFile({
      fileName: `${equipmentAgentContext.focus.tag || equipmentAgentContext.focus.equipmentId}.equipment-context.md`,
      content: renderEquipmentAgentContextMarkdown(equipmentAgentContext),
      mimeType: 'text/markdown',
      description: '设备智能体上下文 Markdown',
      extensions: ['.md'],
      successText: '设备上下文已导出。',
    });
  };

  const exportStreamAgentContext = async () => {
    const streamAgentContext = selectedStream ? buildStreamAgentContext(project, selectedStream.id) : undefined;
    if (!streamAgentContext) {
      message.warning('请先选择一条管线。');
      return;
    }
    await exportDataFile({
      fileName: `${streamAgentContext.focus.tag || streamAgentContext.focus.streamId}.stream-context.md`,
      content: renderStreamAgentContextMarkdown(streamAgentContext),
      mimeType: 'text/markdown',
      description: '管线智能体上下文 Markdown',
      extensions: ['.md'],
      successText: '管线上下文已导出。',
    });
  };

  const importProject = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const next = normalizeProject(JSON.parse(await file.text()) as PidSemanticProject);
        if (next.version !== 'pid-layered-semantic/v1') throw new Error('version mismatch');
        setProject(next);
        setSelectedEquipmentId(next.equipments[0]?.id || '');
        setSelectedLineGroupId(next.lineGroups[0]?.id || '');
        setSelectedStreamId(next.streams[0]?.id || '');
        setSelectedControlId(next.controls[0]?.id || '');
        message.success('项目已打开。');
      } catch {
        message.error('项目文件格式不正确。');
      }
    };
    input.click();
  };

  const resetProject = () => {
    const next = createSeedProject();
    setProject(next);
    setSelectedEquipmentId(next.equipments[0]?.id || '');
    setSelectedLineGroupId(next.lineGroups[0]?.id || '');
    setSelectedStreamId(next.streams[0]?.id || '');
    setSelectedControlId(next.controls[0]?.id || '');
  };

  const equipmentOptions = project.equipments.map((equipment) => option(equipment.id, `${equipment.tag} ${equipment.name}`));
  const triggerEquipment = project.equipments.find((equipment) => equipment.id === selectedControl?.triggerEquipmentId);
  const actionEquipment = project.equipments.find((equipment) => equipment.id === selectedControl?.actionEquipmentId);

  const getStreamRoute = (stream: Stream, seen = new Set<string>()): Point[] | null => {
    if (seen.has(stream.id)) return null;
    seen.add(stream.id);
    const endpoint = (side: 'from' | 'to'): { point: Point; equipment?: Equipment; port?: ExternalPort; attachedAxis?: 'horizontal' | 'vertical' } | null => {
      const kind = side === 'from' ? stream.fromKind : stream.toKind;
      if (kind === '管段接点') {
        const pipeNodeId = side === 'from' ? stream.fromPipeNodeId : stream.toPipeNodeId;
        const pipeNode = project.pipeNodes.find((node) => node.id === pipeNodeId);
        if (pipeNode) {
          const segment = sheetStreams.find((item) => item.id === pipeNode.segmentId);
          const route = segment ? getStreamRoute(segment, new Set(seen)) : null;
          const siblings = [
            ...project.pipeNodes.filter((node) => node.segmentId === pipeNode.segmentId),
            ...project.inlineComponents
              .filter((component) => component.segmentId === pipeNode.segmentId)
              .map((component) => ({ ...component, id: `inline:${component.id}`, kind: '在线元件' as PipeNodeKind })),
          ];
          const ratio = topologyAutoRatio(pipeNode, siblings);
          const ratioPoint = route ? pointAtRatio(route, ratio) : null;
          if (typeof pipeNode.x !== 'number' && typeof pipeNode.y !== 'number' && !ratioPoint) return null;
          return {
            point: {
              x: typeof pipeNode.x === 'number' ? pipeNode.x : ratioPoint!.x,
              y: typeof pipeNode.y === 'number' ? pipeNode.y : ratioPoint!.y,
            },
            equipment: undefined,
            port: undefined,
            attachedAxis: route ? routeAxisAtRatio(route, ratio) : undefined,
          };
        }
        const segmentId = side === 'from' ? stream.fromSegmentId : stream.toSegmentId;
        const ratio = side === 'from' ? stream.fromSegmentRatio : stream.toSegmentRatio;
        const segment = sheetStreams.find((item) => item.id === segmentId);
        const route = segment ? getStreamRoute(segment, new Set(seen)) : null;
        return route ? { point: pointAtRatio(route, ratio), equipment: undefined, port: undefined, attachedAxis: routeAxisAtRatio(route, ratio) } : null;
      }
      if (isReferenceEndpoint(kind)) {
        return {
          point: {
            x: side === 'from' ? stream.fromReferenceX : stream.toReferenceX,
            y: side === 'from' ? stream.fromReferenceY : stream.toReferenceY,
          },
          equipment: undefined,
          port: undefined,
        };
      }
      const equipment = project.equipments.find((item) => item.id === (side === 'from' ? stream.fromEquipmentId : stream.toEquipmentId));
      const port = equipment?.ports.find((item) => item.id === (side === 'from' ? stream.fromPortId : stream.toPortId));
      return equipment && port ? { point: portPoint(equipment, port), equipment, port } : null;
    };
    const from = endpoint('from');
    const to = endpoint('to');
    if (!from || !to) return null;
    if (stream.manualWaypoints?.length) {
      return simplifyOrthogonalRoute([
        from.point,
        ...stream.manualWaypoints,
        to.point,
      ], sheetEquipments);
    }
    const startExit = from.equipment && from.port
      ? portExitPoint(from.equipment, from.port)
      : from.attachedAxis
        ? perpendicularExitPoint(from.point, from.attachedAxis, to.point)
        : undefined;
    const endExit = to.equipment && to.port
      ? portExitPoint(to.equipment, to.port)
      : to.attachedAxis
        ? perpendicularExitPoint(to.point, to.attachedAxis, from.point)
        : undefined;
    if (from.equipment && from.port && to.equipment && to.port) {
      return cleanSmallRouteDetours(simplifyOrthogonalRoute(routeManhattan(from.equipment, from.port, to.equipment, to.port, sheetEquipments), sheetEquipments), sheetEquipments);
    }
    return cleanSmallRouteDetours(simplifyOrthogonalRoute(routeBetweenPoints(
      from.point,
      to.point,
      sheetEquipments,
      startExit,
      endExit,
    ), sheetEquipments), sheetEquipments);
  };

  const referenceEndpointText = (stream: Stream, side: 'from' | 'to') => {
    const kind = side === 'from' ? stream.fromKind : stream.toKind;
    const label = referenceDisplayName(side === 'from' ? stream.fromReferenceLabel : stream.toReferenceLabel);
    const equipment = side === 'from' ? stream.fromReferenceEquipment : stream.toReferenceEquipment;
    const port = side === 'from' ? stream.fromReferencePort : stream.toReferencePort;
    const target = [equipment, port].filter(Boolean).join('.');
    if (kind === '界外来源') return label || target || '来自界外';
    if (kind === '界外去向') return label || target || '去往界外';
    if (kind === '跨图引用') {
      const resolved = referenceEquipmentLabel(equipment, port);
      const text = resolved || label || target || '其他图纸';
      return side === 'from' ? `来自 ${text}` : `去 ${text}`;
    }
    if (label) return label;
    return side === 'from' ? `来自 ${target || '其他图纸'}` : `去 ${target || '其他图纸'}`;
  };

  const renderCanvas = () => (
    <div className="pid-layered-canvas pid-layered-canvas-x6">
      <PidSemanticX6Canvas
        project={project}
        sheetEquipments={sheetEquipments}
        sheetStreams={sheetStreams}
        selectedEquipmentId={selectedEquipmentId}
        selectedStreamId={selectedStreamId}
        getStreamRoute={getStreamRoute}
        referenceEndpointText={referenceEndpointText}
        onSelectEquipment={(id) => {
          setSelectedEquipmentId(id);
          setSelectedStreamId('');
        }}
        onSelectStream={(id) => {
          setSelectedStreamId(id);
          setSelectedEquipmentId('');
        }}
        onOpenEquipment={(id) => {
          setSelectedEquipmentId(id);
          setActiveTab('equipment');
        }}
        onOpenStreams={(id) => {
          setSelectedStreamId(id);
          setSelectedEquipmentId('');
          setActiveTab('streams');
	        }}
	        onEquipmentMove={moveEquipmentAndReroute}
	        onEquipmentResize={resizeEquipmentAndReroute}
	        onReferenceMove={(stream, side, x, y) => {
          if (stream.virtual && stream.sourceStreamId) {
            patchStream(stream.sourceStreamId, stream.continuationSide === 'to'
              ? { toContinuationX: x, toContinuationY: y }
              : { fromContinuationX: x, fromContinuationY: y });
            return;
          }
          patchStream(stream.id, side === 'from'
            ? { fromReferenceX: x, fromReferenceY: y }
            : { toReferenceX: x, toReferenceY: y });
        }}
        onStreamWaypointsChange={(id, waypoints, pieceIndex) => {
          const points = compactRoutePoints(waypoints);
          if (typeof pieceIndex === 'number') {
            const stream = project.streams.find((item) => item.id === id);
            patchStream(id, { pieceWaypoints: { ...(stream?.pieceWaypoints || {}), [String(pieceIndex)]: points } });
            return;
          }
          patchStream(id, { manualWaypoints: points });
        }}
        onInlineComponentMove={(id, segmentId, positionRatio) => patchInlineComponent(id, { segmentId, positionRatio, order: positionRatio, x: undefined, y: undefined })}
        onPipeNodeMove={(id, segmentId, positionRatio) => {
          const segment = project.streams.find((stream) => stream.id === segmentId);
          patchPipeNode(id, { segmentId, groupId: segment?.groupId || '', positionRatio, order: positionRatio, x: undefined, y: undefined });
        }}
        onStreamEndpointMove={(id, side, segmentId, positionRatio) => patchStream(id, side === 'from'
          ? { fromSegmentId: segmentId, fromSegmentRatio: positionRatio, fromContinuationX: 0, fromContinuationY: 0 }
          : { toSegmentId: segmentId, toSegmentRatio: positionRatio, toContinuationX: 0, toContinuationY: 0 })}
        onEquipmentPortMove={moveEquipmentPortAndReroute}
        onCreateStreamFromPorts={createStreamFromPorts}
        onCreateInlineComponentAt={createInlineComponentAt}
        onCreatePipeNodeAt={createPipeNodeAt}
        onCreatePipeStreamFromPoint={createPipeStreamFromPoint}
	        onCreatePipeStreamFromPort={createPipeStreamFromPort}
	        onCompletePipeStreamEndpoint={completePipeStreamEndpoint}
	        onPatchStream={patchStream}
	        onPatchInlineComponent={patchInlineComponent}
	        onDeleteEquipment={deleteEquipmentById}
	        onDeleteStream={deleteStreamById}
	        onDeleteInlineComponent={deleteInlineComponentById}
	      />
    </div>
  );

  const renderProjectTab = () => (
    <div className="pid-panel-grid">
      <section className="pid-editor-card">
        <div className="pid-section-heading">图纸信息</div>
        <LabeledInput label="项目名称" value={project.project.name} onChange={(name) => patchProject({ name })} />
        <LabeledInput label="图纸号" value={project.project.drawingNo} onChange={(drawingNo) => patchProject({ drawingNo })} />
        <LabeledInput label="责任方" value={project.project.owner} onChange={(owner) => patchProject({ owner })} />
        <LabeledText label="设计边界" value={project.project.designBasis} onChange={(designBasis) => patchProject({ designBasis })} />
      </section>
      <section className="pid-editor-card">
        <div className="pid-section-heading">工段与图纸</div>
        <div className="pid-drawing-toolbar">
          <label className="pid-field">
            <span>当前工段</span>
            <Select value={project.currentAreaId} options={project.areas.map((area) => option(area.id, area.name))} onChange={(currentAreaId) => setProject((prev) => ({ ...prev, currentAreaId, currentSheetId: prev.areas.find((area) => area.id === currentAreaId)?.sheets[0]?.id || prev.currentSheetId }))} />
          </label>
          <label className="pid-field">
            <span>当前图纸</span>
            <Select value={project.currentSheetId} options={currentArea?.sheets.map((sheet) => option(sheet.id, sheet.name))} onChange={(currentSheetId) => setProject((prev) => ({ ...prev, currentSheetId }))} />
          </label>
          <Button danger icon={<DeleteOutlined />} disabled={project.areas.length <= 1} onClick={deleteCurrentArea}>删除工段</Button>
          <Button danger icon={<DeleteOutlined />} disabled={!currentArea || currentArea.sheets.length <= 1} onClick={deleteCurrentSheet}>删除图纸</Button>
        </div>
        <div className="pid-create-row">
          <label className="pid-field">
            <span>新工段名称</span>
            <Input value={newAreaName} placeholder={`工段 ${project.areas.length + 1}`} onChange={(event) => setNewAreaName(event.target.value)} />
          </label>
          <Button icon={<PlusOutlined />} onClick={addArea}>新增工段</Button>
          <label className="pid-field">
            <span>新图纸名称</span>
            <Input value={newSheetName} placeholder={`图纸 ${(currentArea?.sheets.length || 0) + 1}`} onChange={(event) => setNewSheetName(event.target.value)} />
          </label>
          <Button icon={<PlusOutlined />} disabled={!currentArea} onClick={addSheet}>新增图纸</Button>
        </div>
        <div className="pid-drawing-editor-grid">
          {currentArea && <LabeledInput label="工段名称" value={currentArea.name} onChange={(name) => patchArea(currentArea.id, { name })} />}
          {currentSheet && <LabeledInput label="图纸名称" value={currentSheet.name} onChange={(name) => patchSheet(currentSheet.id, { name })} />}
          <label className="pid-field">
            <span>图纸所属工段</span>
            <Select
              value={sheetMoveTargetAreaId || undefined}
              disabled={!currentSheet || sheetMoveTargetAreas.length === 0}
              options={sheetMoveTargetAreas.map((area) => option(area.id, area.name))}
              onChange={changeCurrentSheetArea}
            />
          </label>
        </div>
        {currentArea && <LabeledText label="工段说明" value={currentArea.objective} onChange={(objective) => patchArea(currentArea.id, { objective })} />}
        {currentSheet && <LabeledText label="图纸说明" value={currentSheet.description} onChange={(description) => patchSheet(currentSheet.id, { description })} />}
      </section>
    </div>
  );

  const renderEquipmentGuide = () => {
    if (!selectedEquipment) {
      return <div className="pid-empty">请选择设备，或在顶部新建设备。</div>;
    }
    const patchProfile = (patch: Partial<EquipmentProfile>) => patchEquipment(selectedEquipment.id, { profile: { ...selectedEquipment.profile, ...patch } });
    const updatePart = (partId: string, patch: Partial<InternalPart>) => patchEquipment(selectedEquipment.id, {
      parts: selectedEquipment.parts.map((part) => (part.id === partId ? { ...part, ...patch } : part)),
    });
    const portPrefix = (direction: ExternalPort['direction']) => {
      if (direction === 'out') return 'out';
      if (direction === 'bi') return 'bi';
      return 'in';
    };
    const nextPortId = (direction: ExternalPort['direction'], excludeId = '') => {
      const prefix = portPrefix(direction);
      const used = new Set(
        selectedEquipment.ports
          .filter((port) => port.id !== excludeId)
          .map((port) => port.id),
      );
      let index = 1;
      while (used.has(`${prefix}${index}`)) index += 1;
      return `${prefix}${index}`;
    };
    const updatePort = (portId: string, patch: Partial<ExternalPort>) => patchEquipment(selectedEquipment.id, {
      ports: selectedEquipment.ports.map((port) => (port.id === portId ? { ...port, ...patch } : port)),
    });
    const updatePortDirection = (port: ExternalPort, direction: ExternalPort['direction']) => {
      const id = nextPortId(direction, port.id);
      setProject((prev) => ({
        ...prev,
        equipments: prev.equipments.map((equipment) => (
          equipment.id === selectedEquipment.id
            ? { ...equipment, ports: equipment.ports.map((item) => (item.id === port.id ? { ...item, id, direction } : item)) }
            : equipment
        )),
        streams: prev.streams.map((stream) => ({
          ...stream,
          fromPortId: stream.fromEquipmentId === selectedEquipment.id && stream.fromPortId === port.id ? id : stream.fromPortId,
          toPortId: stream.toEquipmentId === selectedEquipment.id && stream.toPortId === port.id ? id : stream.toPortId,
        })),
      }));
    };
    const updateRelation = (relationId: string, patch: Partial<InternalRelation>) => patchEquipment(selectedEquipment.id, {
      relations: selectedEquipment.relations.map((relation) => (relation.id === relationId ? { ...relation, ...patch } : relation)),
    });
    const partOptions = selectedEquipment.parts.map((part) => option(part.id, `${part.name}（${part.type}）`));
    const stepIndex = EQUIPMENT_GUIDE_STEPS.findIndex((step) => step.key === equipmentGuideStep);
    const activeGuideStep = EQUIPMENT_GUIDE_STEPS[stepIndex] || EQUIPMENT_GUIDE_STEPS[0];
    const selectedTagKey = selectedEquipment.tag.trim().toUpperCase();
    const sameTagInstanceCount = selectedTagKey
      ? project.equipments.filter((equipment) => equipment.tag.trim().toUpperCase() === selectedTagKey).length
      : 0;
    const goStep = (offset: number) => {
      const nextIndex = Math.max(0, Math.min(EQUIPMENT_GUIDE_STEPS.length - 1, stepIndex + offset));
      setEquipmentGuideStep(EQUIPMENT_GUIDE_STEPS[nextIndex].key);
    };
    return (
      <div className="pid-equipment-wizard">
        <aside className="pid-wizard-rail">
          <div>
            <strong>{selectedEquipment.tag}</strong>
            <span>{selectedEquipment.name}</span>
            {sameTagInstanceCount > 1 && <span>同位号实例：{sameTagInstanceCount} 处</span>}
          </div>
          {EQUIPMENT_GUIDE_STEPS.map((step) => (
            <button
              key={step.key}
              className={`pid-wizard-step ${equipmentGuideStep === step.key ? 'active' : ''}`}
              onClick={() => setEquipmentGuideStep(step.key)}
            >
              <strong>{step.title}</strong>
              <span>{step.hint}</span>
            </button>
          ))}
        </aside>
        <div className="pid-guide">
          <div className="pid-wizard-head">
            <div>
              <strong>{activeGuideStep.title}</strong>
              <span>{activeGuideStep.hint}</span>
            </div>
            <Space>
              <Button onClick={() => setActiveTab('canvas')}>返回画布</Button>
              <Button disabled={stepIndex <= 0} onClick={() => goStep(-1)}>上一步</Button>
              <Button type="primary" disabled={stepIndex >= EQUIPMENT_GUIDE_STEPS.length - 1} onClick={() => goStep(1)}>下一步</Button>
            </Space>
          </div>
        {equipmentGuideStep === 'identity' && (
        <section className="pid-editor-card">
          <div className="pid-section-heading">设备身份</div>
          <LabeledSelect label="设备类型" value={selectedEquipment.type} options={EQUIPMENT_OPTIONS.map((item) => item.value)} labels={EQUIPMENT_LABELS} onChange={(type) => {
            const fresh = equipmentTemplate(type as EquipmentType, selectedEquipment.tag, selectedEquipment.sheetId, sheetAreaId(selectedEquipment.sheetId) || selectedEquipment.areaId, selectedEquipment.x, selectedEquipment.y);
            patchEquipment(selectedEquipment.id, { ...fresh, id: selectedEquipment.id, tag: selectedEquipment.tag });
          }} />
          <div className="pid-two-cols">
            <LabeledInput label="位号" value={selectedEquipment.tag} onChange={(tag) => patchEquipment(selectedEquipment.id, { tag })} />
            <LabeledInput label="名称" value={selectedEquipment.name} onChange={(name) => patchEquipment(selectedEquipment.id, { name })} />
            <LabeledSelect
              label="所属工段/系统"
              value={sheetAreaId(selectedEquipment.sheetId) || selectedEquipment.areaId}
              options={project.areas.map((area) => area.id)}
              labels={Object.fromEntries(project.areas.map((area) => [area.id, area.name]))}
              disabled
              onChange={() => undefined}
            />
            <LabeledSelect label="材质" value={selectedEquipment.material} options={MATERIALS} onChange={(material) => patchEquipment(selectedEquipment.id, { material })} />
          </div>
          <LabeledText label="描述" value={selectedEquipment.description} onChange={(description) => patchEquipment(selectedEquipment.id, { description })} />
        </section>
        )}
        {equipmentGuideStep === 'profile' && (
        <section className="pid-editor-card">
          <div className="pid-section-heading">功能与原理</div>
          <div className="pid-two-cols">
            <LabeledText label="核心功能" value={selectedEquipment.profile.coreFunction} onChange={(coreFunction) => patchProfile({ coreFunction })} />
            <LabeledText label="工作原理" value={selectedEquipment.profile.workingPrinciple} onChange={(workingPrinciple) => patchProfile({ workingPrinciple })} />
          </div>
        </section>
        )}
        {equipmentGuideStep === 'parts' && (
        <section className="pid-editor-card">
          <div className="pid-section-heading">
            内部组成
            <Button size="small" icon={<PlusOutlined />} onClick={() => patchEquipment(selectedEquipment.id, { parts: [...selectedEquipment.parts, { id: uid('part'), category: 'fluid_space', type: '封头', name: '内部组成', phase: '任意', role: '' }] })}>新增</Button>
          </div>
          <TableShell columns={['类别', '类型', '名称', '相态', '作用', '']}>
            {selectedEquipment.parts.map((part) => (
              <tr key={part.id}>
                <td><Select value={part.category} options={PART_CATEGORIES} onChange={(category) => updatePart(part.id, { category, type: PART_TYPES[category][0] })} /></td>
                <td><Select value={part.type} options={PART_TYPES[part.category].map((item) => option(item))} onChange={(type) => updatePart(part.id, { type })} /></td>
                <td><Input value={part.name} onChange={(event) => updatePart(part.id, { name: event.target.value })} /></td>
                <td><Select value={part.phase} options={PHASES.map((item) => option(item))} onChange={(phase) => updatePart(part.id, { phase })} /></td>
                <td><Input value={part.role} onChange={(event) => updatePart(part.id, { role: event.target.value })} /></td>
                <td><Button danger size="small" onClick={() => patchEquipment(selectedEquipment.id, { parts: selectedEquipment.parts.filter((item) => item.id !== part.id) })}>删除</Button></td>
              </tr>
            ))}
          </TableShell>
        </section>
        )}
        {equipmentGuideStep === 'ports' && (
        <section className="pid-editor-card">
          <div className="pid-section-heading">
            对外连接桩
            <Button size="small" icon={<PlusOutlined />} onClick={() => patchEquipment(selectedEquipment.id, { ports: [...selectedEquipment.ports, { id: nextPortId('in'), name: '连接桩', ownerPartId: selectedEquipment.parts[0]?.id || '', direction: 'in', role: '主物流', medium: '', x: 0, y: 50 }] })}>新增</Button>
          </div>
          <TableShell columns={['ID', '名称', '挂接组成', '方向', '角色', '介质', 'X', 'Y', '']}>
            {selectedEquipment.ports.map((port) => (
              <tr key={port.id}>
                <td><Input value={port.id} onChange={(event) => updatePort(port.id, { id: event.target.value })} /></td>
                <td><Input value={port.name} onChange={(event) => updatePort(port.id, { name: event.target.value })} /></td>
                <td><Select value={port.ownerPartId} options={partOptions} onChange={(ownerPartId) => updatePort(port.id, { ownerPartId })} /></td>
                <td><Select value={port.direction} options={[option('in', '入口'), option('out', '出口'), option('bi', '双向')]} onChange={(direction) => updatePortDirection(port, direction)} /></td>
                <td><Select value={port.role} options={STREAM_ROLES.map((item) => option(item))} onChange={(role) => updatePort(port.id, { role })} /></td>
                <td><Input value={port.medium} onChange={(event) => updatePort(port.id, { medium: event.target.value })} /></td>
                <td><Input type="number" value={port.x} onChange={(event) => updatePort(port.id, { x: Number(event.target.value) })} /></td>
                <td><Input type="number" value={port.y} onChange={(event) => updatePort(port.id, { y: Number(event.target.value) })} /></td>
                <td><Button danger size="small" onClick={() => patchEquipment(selectedEquipment.id, { ports: selectedEquipment.ports.filter((item) => item.id !== port.id) })}>删除</Button></td>
              </tr>
            ))}
          </TableShell>
        </section>
        )}
        {equipmentGuideStep === 'relations' && (
        <section className="pid-editor-card">
          <div className="pid-section-heading">
            内部关系
            <Button size="small" icon={<PlusOutlined />} onClick={() => patchEquipment(selectedEquipment.id, { relations: [...selectedEquipment.relations, { id: uid('rel'), sourcePartId: selectedEquipment.parts[0]?.id || '', relation: '供给/流入', targetPartId: selectedEquipment.parts[1]?.id || selectedEquipment.parts[0]?.id || '', description: '' }] })}>新增</Button>
          </div>
          <TableShell columns={['源', '关系', '目标', '说明', '']}>
            {selectedEquipment.relations.map((relation) => (
              <tr key={relation.id}>
                <td><Select value={relation.sourcePartId} options={partOptions} onChange={(sourcePartId) => updateRelation(relation.id, { sourcePartId })} /></td>
                <td><Select value={relation.relation} options={RELATIONS.map((item) => option(item))} onChange={(nextRelation) => updateRelation(relation.id, { relation: nextRelation })} /></td>
                <td><Select value={relation.targetPartId} options={partOptions} onChange={(targetPartId) => updateRelation(relation.id, { targetPartId })} /></td>
                <td><Input value={relation.description} onChange={(event) => updateRelation(relation.id, { description: event.target.value })} /></td>
                <td><Button danger size="small" onClick={() => patchEquipment(selectedEquipment.id, { relations: selectedEquipment.relations.filter((item) => item.id !== relation.id) })}>删除</Button></td>
              </tr>
            ))}
          </TableShell>
        </section>
        )}
        </div>
      </div>
    );
  };

  const renderStreamsTab = () => (
    <div className="pid-panel-grid">
      <section className="pid-editor-card">
        <div className="pid-section-heading">管线组</div>
        <Button icon={<PlusOutlined />} onClick={addLineGroup}>新增管线组</Button>
        <div className="pid-list">
          {sheetLineGroups.map((group) => (
            <button key={group.id} className={`pid-list-item ${selectedLineGroup?.id === group.id ? 'active' : ''}`} onClick={() => {
              setSelectedLineGroupId(group.id);
              setSelectedStreamId(project.streams.find((stream) => stream.groupId === group.id)?.id || '');
            }}>
              <strong>{group.tag}</strong>
              <span>{group.name} / {group.medium || '-'}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="pid-editor-card">
        <div className="pid-section-heading">
          管线组语义
          <Button icon={<PlusOutlined />} size="small" onClick={addStream}>新增管段/分支</Button>
        </div>
        {selectedLineGroup ? (
          <>
            <div className="pid-two-cols">
              <LabeledInput label="管线组号" value={selectedLineGroup.tag} onChange={(tag) => patchLineGroup(selectedLineGroup.id, { tag })} />
              <LabeledInput label="管线组名称" value={selectedLineGroup.name} onChange={(name) => patchLineGroup(selectedLineGroup.id, { name })} />
              <LabeledSelect label="物流角色" value={selectedLineGroup.role} options={STREAM_ROLES} onChange={(role) => patchLineGroup(selectedLineGroup.id, { role })} />
              <LabeledSelect label="流向模式" value={selectedLineGroup.directionMode} options={FLOW_DIRECTION_MODES} onChange={(directionMode) => patchLineGroup(selectedLineGroup.id, { directionMode })} />
              <LabeledInput label="介质" value={selectedLineGroup.medium} onChange={(medium) => patchLineGroup(selectedLineGroup.id, { medium })} />
              <LabeledInput label="反向条件" value={selectedLineGroup.reverseCondition} onChange={(reverseCondition) => patchLineGroup(selectedLineGroup.id, { reverseCondition })} />
            </div>
            <div className="pid-two-cols">
              <LabeledInput label="边界入口" value={selectedLineGroup.boundaryIn} onChange={(boundaryIn) => patchLineGroup(selectedLineGroup.id, { boundaryIn })} />
              <LabeledInput label="边界出口" value={selectedLineGroup.boundaryOut} onChange={(boundaryOut) => patchLineGroup(selectedLineGroup.id, { boundaryOut })} />
            </div>
            <LabeledText label="管线组目的" value={selectedLineGroup.purpose} onChange={(purpose) => patchLineGroup(selectedLineGroup.id, { purpose })} />
            <div className="pid-section-heading">管段 / 分支 / 变径段</div>
            <TableShell columns={['管段号', '管段名称', '分支类型', '流向', '起点类型', '起点对象', '起点端口/位置', '终点类型', '终点对象', '终点端口/位置', '介质', 'DN', 'PN', '材质', '工艺意图', '']}>
              {project.streams.filter((stream) => stream.groupId === selectedLineGroup.id).map((stream) => {
                const fromEquipment = project.equipments.find((equipment) => equipment.id === stream.fromEquipmentId);
                const toEquipment = project.equipments.find((equipment) => equipment.id === stream.toEquipmentId);
                const segmentOptions = project.streams
                  .filter((item) => item.groupId === selectedLineGroup.id && item.id !== stream.id)
                  .map((item) => option(item.id, streamOptionLabel(item)));
                const renderEndpointObject = (side: 'from' | 'to') => {
                  const kind = side === 'from' ? stream.fromKind : stream.toKind;
                  if (kind === '跨图引用') {
                    const referenceSheet = side === 'from' ? stream.fromReferenceSheet : stream.toReferenceSheet;
                    const referenceEquipment = side === 'from' ? stream.fromReferenceEquipment : stream.toReferenceEquipment;
                    return (
                      <div className="pid-reference-fields">
                        <Select
                          placeholder="选择图纸"
                          value={referenceSheet || undefined}
                          options={sheetOptions.filter((item) => item.value !== stream.sheetId)}
                          onChange={(sheetId) => patchStream(stream.id, side === 'from'
                            ? { fromReferenceSheet: sheetId, fromReferenceArea: sheetAreaId(sheetId), fromReferenceEquipment: '', fromReferencePort: '' }
                            : { toReferenceSheet: sheetId, toReferenceArea: sheetAreaId(sheetId), toReferenceEquipment: '', toReferencePort: '' })}
                        />
                        <Select
                          placeholder="选择目标设备"
                          value={referenceEquipment || undefined}
                          options={sheetEquipmentOptions(referenceSheet)}
                          onChange={(equipmentId) => {
                            const equipment = project.equipments.find((item) => item.id === equipmentId);
                            patchStream(stream.id, side === 'from'
                              ? {
                                fromReferenceSheet: equipment?.sheetId || referenceSheet,
                                fromReferenceArea: equipment ? sheetAreaId(equipment.sheetId) : sheetAreaId(referenceSheet),
                                fromReferenceEquipment: equipmentId,
                                fromReferencePort: equipment?.ports[0]?.id || '',
                              }
                              : {
                                toReferenceSheet: equipment?.sheetId || referenceSheet,
                                toReferenceArea: equipment ? sheetAreaId(equipment.sheetId) : sheetAreaId(referenceSheet),
                                toReferenceEquipment: equipmentId,
                                toReferencePort: equipment?.ports[0]?.id || '',
                              });
                          }}
                        />
                      </div>
                    );
                  }
                  if (isReferenceEndpoint(kind)) {
                    return (
                      <div className="pid-reference-fields">
                        <Input
                          placeholder={referencePlaceholder(kind, side)}
                          value={side === 'from' ? stream.fromReferenceLabel : stream.toReferenceLabel}
                          onChange={(event) => patchStream(stream.id, side === 'from' ? { fromReferenceLabel: event.target.value } : { toReferenceLabel: event.target.value })}
                        />
                        <Input
                          placeholder="目标设备/边界"
                          value={side === 'from' ? stream.fromReferenceEquipment : stream.toReferenceEquipment}
                          onChange={(event) => patchStream(stream.id, side === 'from' ? { fromReferenceEquipment: event.target.value } : { toReferenceEquipment: event.target.value })}
                        />
                      </div>
                    );
                  }
                  if (kind === '设备端口') {
                    return (
                      <Select
                        value={side === 'from' ? stream.fromEquipmentId : stream.toEquipmentId}
                        options={equipmentOptions}
                        onChange={(equipmentId) => patchStream(stream.id, side === 'from'
                          ? { fromEquipmentId: equipmentId, fromPortId: project.equipments.find((equipment) => equipment.id === equipmentId)?.ports[0]?.id || '' }
                          : { toEquipmentId: equipmentId, toPortId: project.equipments.find((equipment) => equipment.id === equipmentId)?.ports[0]?.id || '' })}
                      />
                    );
                  }
                  return (
                    <Select
                      value={side === 'from' ? stream.fromSegmentId : stream.toSegmentId}
                      options={segmentOptions}
                      onChange={(segmentId) => patchStreamEndpointSegment(stream, side, segmentId)}
                    />
                  );
                };
                const renderEndpointDetail = (side: 'from' | 'to') => {
                  const kind = side === 'from' ? stream.fromKind : stream.toKind;
                  if (kind === '跨图引用') {
                    const referenceEquipment = findEquipmentByReference(side === 'from' ? stream.fromReferenceEquipment : stream.toReferenceEquipment);
                    const referencePort = side === 'from' ? stream.fromReferencePort : stream.toReferencePort;
                    return (
                      <div className="pid-reference-fields">
                        <Select
                          placeholder="选择目标连接桩"
                          value={referencePort || undefined}
                          options={(referenceEquipment?.ports || []).map((port) => option(port.id, `${port.id} ${port.name}`))}
                          onChange={(portId) => patchStream(stream.id, side === 'from' ? { fromReferencePort: portId } : { toReferencePort: portId })}
                        />
                        <Space.Compact>
                          <Input
                            type="number"
                            addonBefore="X"
                            value={side === 'from' ? stream.fromReferenceX : stream.toReferenceX}
                            onChange={(event) => patchStream(stream.id, side === 'from' ? { fromReferenceX: snapToGrid(Number(event.target.value)) } : { toReferenceX: snapToGrid(Number(event.target.value)) })}
                          />
                          <Input
                            type="number"
                            addonBefore="Y"
                            value={side === 'from' ? stream.fromReferenceY : stream.toReferenceY}
                            onChange={(event) => patchStream(stream.id, side === 'from' ? { fromReferenceY: snapToGrid(Number(event.target.value)) } : { toReferenceY: snapToGrid(Number(event.target.value)) })}
                          />
                        </Space.Compact>
                      </div>
                    );
                  }
                  if (isReferenceEndpoint(kind)) {
                    return (
                      <div className="pid-reference-fields">
                        <Input
                          placeholder="目标端口/连接点"
                          value={side === 'from' ? stream.fromReferencePort : stream.toReferencePort}
                          onChange={(event) => patchStream(stream.id, side === 'from' ? { fromReferencePort: event.target.value } : { toReferencePort: event.target.value })}
                        />
                        <Space.Compact>
                          <Input
                            type="number"
                            addonBefore="X"
                            value={side === 'from' ? stream.fromReferenceX : stream.toReferenceX}
                            onChange={(event) => patchStream(stream.id, side === 'from' ? { fromReferenceX: snapToGrid(Number(event.target.value)) } : { toReferenceX: snapToGrid(Number(event.target.value)) })}
                          />
                          <Input
                            type="number"
                            addonBefore="Y"
                            value={side === 'from' ? stream.fromReferenceY : stream.toReferenceY}
                            onChange={(event) => patchStream(stream.id, side === 'from' ? { fromReferenceY: snapToGrid(Number(event.target.value)) } : { toReferenceY: snapToGrid(Number(event.target.value)) })}
                          />
                        </Space.Compact>
                      </div>
                    );
                  }
                  if (kind === '设备端口') {
                    const equipment = side === 'from' ? fromEquipment : toEquipment;
                    const portId = side === 'from' ? stream.fromPortId : stream.toPortId;
                    return (
                      <Select
                        value={portId}
                        options={(equipment?.ports || []).map((port) => option(port.id, `${port.id} ${port.name}`))}
                        onChange={(portId) => patchStream(stream.id, side === 'from' ? { fromPortId: portId } : { toPortId: portId })}
                      />
                    );
                  }
                  return (
                    <Select
                      placeholder="选择当前接点在该管段上的顺序位置"
                      value={endpointTopologyAnchor(stream, side)}
                      options={topologyAnchorOptions(side === 'from' ? stream.fromSegmentId : stream.toSegmentId, endpointPipeNodeKey(stream, side))}
                      onChange={(afterKey) => moveStreamEndpointAfter(stream.id, side, afterKey)}
                    />
                  );
                };
                return (
                  <tr key={stream.id}>
                    <td><Input value={stream.tag} onChange={(event) => patchStream(stream.id, { tag: event.target.value })} /></td>
                    <td><Input value={stream.name} onChange={(event) => patchStream(stream.id, { name: event.target.value })} /></td>
                    <td><Select value={stream.branchType} options={PIPE_BRANCH_TYPES.map((item) => option(item))} onChange={(branchType) => patchStream(stream.id, { branchType })} /></td>
                    <td><Select value={stream.directionMode} options={FLOW_DIRECTION_MODES.map((item) => option(item))} onChange={(directionMode) => patchStream(stream.id, { directionMode })} /></td>
                    <td><Select value={stream.fromKind} options={PIPE_FROM_ENDPOINT_KINDS.map((item) => option(item))} onChange={(fromKind) => patchStreamEndpointKind(stream, 'from', fromKind)} /></td>
                    <td>{renderEndpointObject('from')}</td>
                    <td>{renderEndpointDetail('from')}</td>
                    <td><Select value={stream.toKind} options={PIPE_TO_ENDPOINT_KINDS.map((item) => option(item))} onChange={(toKind) => patchStreamEndpointKind(stream, 'to', toKind)} /></td>
                    <td>{renderEndpointObject('to')}</td>
                    <td>{renderEndpointDetail('to')}</td>
                    <td><Input value={stream.medium} placeholder={selectedLineGroup.medium} onChange={(event) => patchStream(stream.id, { medium: event.target.value })} /></td>
                    <td><Input value={stream.dn} onChange={(event) => patchStream(stream.id, { dn: event.target.value })} /></td>
                    <td><Input value={stream.pn} onChange={(event) => patchStream(stream.id, { pn: event.target.value })} /></td>
                    <td><Input value={stream.material} onChange={(event) => patchStream(stream.id, { material: event.target.value })} /></td>
                    <td><Input value={stream.intent} onChange={(event) => patchStream(stream.id, { intent: event.target.value })} /></td>
                    <td><Button danger size="small" onClick={() => setProject((prev) => ({
                      ...prev,
                      streams: prev.streams.filter((item) => item.id !== stream.id),
                      pipeNodes: prev.pipeNodes.filter((node) => node.segmentId !== stream.id),
                      inlineComponents: prev.inlineComponents.filter((component) => component.segmentId !== stream.id),
                    }))}>删除</Button></td>
                  </tr>
                );
              })}
            </TableShell>
            <div className="pid-section-heading">
              管段在线元件 / 阀门 / 测点
              <Button icon={<PlusOutlined />} size="small" onClick={addInlineComponent}>插入阀门/元件</Button>
            </div>
            <TableShell columns={['位号', '类型', '名称', '所在管段', '位置关系', '常态', '执行机构/驱动', '控制信号', '说明', '']}>
              {project.inlineComponents
                .filter((component) => project.streams.some((stream) => stream.id === component.segmentId && stream.groupId === selectedLineGroup.id))
                .map((component) => {
                  const groupSegments = project.streams.filter((stream) => stream.groupId === selectedLineGroup.id);
                  return (
                    <tr key={component.id}>
                      <td><Input value={component.tag} onChange={(event) => patchInlineComponent(component.id, { tag: event.target.value })} /></td>
                      <td><Select value={normalizeInlineComponentType(component.type)} options={INLINE_COMPONENT_TYPES.map((item) => option(item))} onChange={(type) => patchInlineComponent(component.id, inlineComponentTypePatch(component, type))} /></td>
                      <td><Input value={component.name} onChange={(event) => patchInlineComponent(component.id, { name: event.target.value })} /></td>
                      <td><Select value={component.segmentId} options={groupSegments.map((stream) => option(stream.id, streamOptionLabel(stream)))} onChange={(segmentId) => patchInlineComponent(component.id, { segmentId, order: nextTopologyOrder(project, segmentId, '__start__', `inline:${component.id}`), x: undefined, y: undefined })} /></td>
                      <td><Select value={currentTopologyAnchor(component.segmentId, `inline:${component.id}`)} options={topologyAnchorOptions(component.segmentId, `inline:${component.id}`)} onChange={(afterKey) => moveInlineComponentAfter(component.id, afterKey)} /></td>
                      <td><Select disabled={isMeasurementInlineType(component.type)} value={inlineNormalState(component)} options={INLINE_COMPONENT_STATES.map((item) => option(item))} onChange={(normalState) => patchInlineComponent(component.id, { normalState })} /></td>
                      <td><Input disabled={isMeasurementInlineType(component.type)} value={inlineActuator(component)} onChange={(event) => patchInlineComponent(component.id, { actuator: event.target.value })} /></td>
                      <td><Input value={component.controlSignal} onChange={(event) => patchInlineComponent(component.id, { controlSignal: event.target.value })} /></td>
                      <td><Input value={component.description} onChange={(event) => patchInlineComponent(component.id, { description: event.target.value })} /></td>
                      <td><Button danger size="small" onClick={() => deleteInlineComponentById(component.id)}>删除</Button></td>
                    </tr>
                  );
                })}
            </TableShell>
            <div className="pid-section-heading">
              管线拓扑节点
              <Button icon={<PlusOutlined />} size="small" onClick={addPipeNode}>新增支管/汇入/变径点</Button>
            </div>
            <TableShell columns={['节点号', '节点类型', '名称', '所在管段', '位置关系', '说明', '']}>
              {project.pipeNodes
                .filter((node) => node.groupId === selectedLineGroup.id)
                .map((node) => {
                  const groupSegments = project.streams.filter((stream) => stream.groupId === selectedLineGroup.id);
                  return (
                    <tr key={node.id}>
                      <td><Input value={node.tag} onChange={(event) => patchPipeNode(node.id, { tag: event.target.value })} /></td>
                      <td><Select value={node.kind} options={PIPE_NODE_KINDS.map((item) => option(item))} onChange={(kind) => patchPipeNode(node.id, { kind })} /></td>
                      <td><Input value={node.name} onChange={(event) => patchPipeNode(node.id, { name: event.target.value })} /></td>
                      <td><Select value={node.segmentId} options={groupSegments.map((stream) => option(stream.id, streamOptionLabel(stream)))} onChange={(segmentId) => patchPipeNode(node.id, { segmentId, order: nextTopologyOrder(project, segmentId, '__start__', `pipe:${node.id}`), x: undefined, y: undefined })} /></td>
                      <td><Select value={currentTopologyAnchor(node.segmentId, `pipe:${node.id}`)} options={topologyAnchorOptions(node.segmentId, `pipe:${node.id}`)} onChange={(afterKey) => movePipeNodeAfter(node.id, afterKey)} /></td>
                      <td><Input value={node.description} onChange={(event) => patchPipeNode(node.id, { description: event.target.value })} /></td>
                      <td><Button danger size="small" onClick={() => setProject((prev) => ({ ...prev, pipeNodes: prev.pipeNodes.filter((item) => item.id !== node.id) }))}>删除</Button></td>
                    </tr>
                  );
                })}
            </TableShell>
          </>
        ) : <div className="pid-empty">请选择或新增管线组。</div>}
      </section>
    </div>
  );

  const renderControlsTab = () => (
    <div className="pid-panel-grid">
      <section className="pid-editor-card">
        <div className="pid-section-heading">控制与联锁</div>
        <Button icon={<PlusOutlined />} onClick={addControl}>新增控制/联锁</Button>
        <div className="pid-list">
          {project.controls.map((control) => (
            <button key={control.id} className={`pid-list-item ${selectedControlId === control.id ? 'active' : ''}`} onClick={() => setSelectedControlId(control.id)}>
              <strong>{control.tag}</strong>
              <span>{control.kind} / {control.scope || '-'}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="pid-editor-card">
        <div className="pid-section-heading">跨设备动作</div>
        {selectedControl ? (
          <>
            <div className="pid-two-cols">
              <LabeledSelect label="类型" value={selectedControl.kind} options={CONTROL_KINDS} onChange={(kind) => patchControl(selectedControl.id, { kind })} />
              <LabeledInput label="位号" value={selectedControl.tag} onChange={(tag) => patchControl(selectedControl.id, { tag })} />
              <LabeledInput label="作用范围" value={selectedControl.scope} onChange={(scope) => patchControl(selectedControl.id, { scope })} />
              <LabeledInput label="保护目的" value={selectedControl.purpose} onChange={(purpose) => patchControl(selectedControl.id, { purpose })} />
            </div>
            <div className="pid-two-cols">
              <LabeledSelect label="触发设备" value={selectedControl.triggerEquipmentId} options={equipmentOptions.map((item) => item.value)} labels={Object.fromEntries(equipmentOptions.map((item) => [item.value, item.label]))} onChange={(triggerEquipmentId) => patchControl(selectedControl.id, { triggerEquipmentId, triggerPartId: project.equipments.find((equipment) => equipment.id === triggerEquipmentId)?.parts[0]?.id || '' })} />
              <LabeledSelect label="触发对象" value={selectedControl.triggerPartId} options={(triggerEquipment?.parts || []).map((part) => part.id)} labels={Object.fromEntries((triggerEquipment?.parts || []).map((part) => [part.id, `${part.name}（${part.type}）`]))} onChange={(triggerPartId) => patchControl(selectedControl.id, { triggerPartId })} />
              <LabeledSelect label="动作设备" value={selectedControl.actionEquipmentId} options={equipmentOptions.map((item) => item.value)} labels={Object.fromEntries(equipmentOptions.map((item) => [item.value, item.label]))} onChange={(actionEquipmentId) => patchControl(selectedControl.id, { actionEquipmentId, actionTargetId: project.equipments.find((equipment) => equipment.id === actionEquipmentId)?.parts[0]?.id || '' })} />
              <LabeledSelect label="动作对象" value={selectedControl.actionTargetId} options={(actionEquipment?.parts || []).map((part) => part.id)} labels={Object.fromEntries((actionEquipment?.parts || []).map((part) => [part.id, `${part.name}（${part.type}）`]))} onChange={(actionTargetId) => patchControl(selectedControl.id, { actionTargetId })} />
            </div>
            <LabeledInput label="触发条件" value={selectedControl.condition} onChange={(condition) => patchControl(selectedControl.id, { condition })} />
            <LabeledText label="联锁动作" value={selectedControl.action} onChange={(action) => patchControl(selectedControl.id, { action })} />
            <LabeledText label="复位条件" value={selectedControl.reset} onChange={(reset) => patchControl(selectedControl.id, { reset })} />
            <Button danger icon={<DeleteOutlined />} onClick={() => setProject((prev) => ({ ...prev, controls: prev.controls.filter((control) => control.id !== selectedControl.id) }))}>删除控制/联锁</Button>
          </>
        ) : <div className="pid-empty">请选择或新增控制联锁。</div>}
      </section>
    </div>
  );

  const renderNarrativeTab = () => (
    <section className="pid-editor-card pid-full-card">
      <div className="pid-section-heading">
        工艺叙事
        <Button icon={<PlusOutlined />} onClick={addNarrative}>新增叙事条目</Button>
      </div>
      <p className="pid-help">先由结构化连接和工段边界生成草稿，再由工程师修正措辞。最终 LLM Markdown 优先使用修正后的叙事。</p>
      {project.narratives.map((item) => (
        <div className="pid-narrative-row" key={item.id}>
          <Select value={item.level} options={['工段', '物流', '控制联锁', '开停车'].map((value) => option(value))} onChange={(level) => setProject((prev) => ({ ...prev, narratives: prev.narratives.map((nar) => (nar.id === item.id ? { ...nar, level } : nar)) }))} />
          <Input value={item.subject} onChange={(event) => setProject((prev) => ({ ...prev, narratives: prev.narratives.map((nar) => (nar.id === item.id ? { ...nar, subject: event.target.value } : nar)) }))} />
          <Input.TextArea rows={2} placeholder={item.generated || '根据设备、物流和联锁写出工艺意图。'} value={item.reviewed} onChange={(event) => setProject((prev) => ({ ...prev, narratives: prev.narratives.map((nar) => (nar.id === item.id ? { ...nar, reviewed: event.target.value } : nar)) }))} />
          <Button danger onClick={() => setProject((prev) => ({ ...prev, narratives: prev.narratives.filter((nar) => nar.id !== item.id) }))}>删除</Button>
        </div>
      ))}
    </section>
  );

  const renderActivePanel = () => {
    if (activeTab === 'canvas') return renderCanvas();
    if (activeTab === 'project') return renderProjectTab();
    if (activeTab === 'equipment') return renderEquipmentGuide();
    if (activeTab === 'streams') return renderStreamsTab();
    if (activeTab === 'controls') return renderControlsTab();
    if (activeTab === 'narrative') return renderNarrativeTab();
    if (activeTab === 'llm') return <pre className="pid-output">{buildMarkdown(project)}</pre>;
    if (activeTab === 'projectJson') return <pre className="pid-output">{JSON.stringify(project, null, 2)}</pre>;
    if (activeTab === 'semanticIr') return <pre className="pid-output">{buildAgentPublishPackage(project).files['semantic-ir.json']}</pre>;
    if (activeTab === 'agentPackage') return <pre className="pid-output">{renderAgentPackageSummaryMarkdown(buildAgentPublishPackage(project))}</pre>;
    if (activeTab === 'equipmentContext') {
      const equipmentAgentContext = selectedEquipment ? buildEquipmentAgentContext(project, selectedEquipment.id) : undefined;
      return equipmentAgentContext
        ? <pre className="pid-output">{renderEquipmentAgentContextMarkdown(equipmentAgentContext)}</pre>
        : <div className="pid-empty">请选择一个设备以生成设备上下文。</div>;
    }
    if (activeTab === 'streamContext') {
      const streamAgentContext = selectedStream ? buildStreamAgentContext(project, selectedStream.id) : undefined;
      return streamAgentContext
        ? <pre className="pid-output">{renderStreamAgentContextMarkdown(streamAgentContext)}</pre>
        : <div className="pid-empty">请选择一条管线以生成管线上下文。</div>;
    }
    if (activeTab === 'completeness') return <pre className="pid-output">{renderCompletenessMarkdown(buildAgentPublishPackage(project).completeness)}</pre>;
    if (activeTab === 'flowPaths') return <pre className="pid-output">{renderFlowPathsMarkdown(buildAgentPublishPackage(project).flowPaths)}</pre>;
    return <pre className="pid-output">{JSON.stringify(project, null, 2)}</pre>;
  };

  const fileMenuItems: MenuProps['items'] = [
    { key: 'saveLocal', icon: <SaveOutlined />, label: '保存本地' },
    { key: 'open', label: '打开工程' },
    { type: 'divider' },
    { key: 'reset', danger: true, label: '重置示例' },
  ];
  const exportMenuItems: MenuProps['items'] = [
    { key: 'exportProject', icon: <ExportOutlined />, label: '导出工程' },
    { key: 'exportIr', icon: <ExportOutlined />, label: '导出 IR' },
    { key: 'publishDirectory', icon: <ExportOutlined />, label: '发布到目录' },
    { key: 'downloadPackage', icon: <ExportOutlined />, label: '下载发布包' },
    { type: 'divider' },
    { key: 'exportEquipmentContext', icon: <ExportOutlined />, disabled: !selectedEquipment, label: '导出设备上下文' },
    { key: 'exportStreamContext', icon: <ExportOutlined />, disabled: !selectedStream, label: '导出管线上下文' },
  ];
  const networkMenuItems: MenuProps['items'] = [
    { key: 'refreshNetwork', label: '刷新列表' },
    { key: 'importAsNetwork', icon: <ExportOutlined />, label: '本地导入为新工程' },
    { key: 'appendToNetwork', icon: <ExportOutlined />, label: '导入到当前工程' },
  ];
  const handleFileMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'saveLocal') saveLocal();
    if (key === 'open') importProject();
    if (key === 'reset') resetProject();
  };
  const handleExportMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'exportProject') void exportProject();
    if (key === 'exportIr') void exportAgentSemanticIR();
    if (key === 'publishDirectory') void publishAgentPackageToDirectory();
    if (key === 'downloadPackage') void exportAgentPackage();
    if (key === 'exportEquipmentContext') void exportEquipmentAgentContext();
    if (key === 'exportStreamContext') void exportStreamAgentContext();
  };
  const handleNetworkMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'refreshNetwork') void refreshNetworkProjects();
    if (key === 'importAsNetwork') void importLocalAsNetworkProject();
    if (key === 'appendToNetwork') void appendLocalProjectToCurrent();
  };

  return (
    <div className="pid-layered-workspace">
      <div className="pid-topbar">
        <div className="pid-toolbar-groups">
          <div className="pid-toolbar-group pid-toolbar-context">
            <Select value={project.currentAreaId} options={project.areas.map((area) => option(area.id, area.name))} onChange={(currentAreaId) => setProject((prev) => ({ ...prev, currentAreaId, currentSheetId: prev.areas.find((area) => area.id === currentAreaId)?.sheets[0]?.id || prev.currentSheetId }))} />
            <Select value={project.currentSheetId} options={currentArea?.sheets.map((sheet) => option(sheet.id, sheet.name))} onChange={(currentSheetId) => setProject((prev) => ({ ...prev, currentSheetId }))} />
          </div>
          <div className="pid-toolbar-group">
            <Select value={newEquipmentType} options={EQUIPMENT_OPTIONS} onChange={setNewEquipmentType} />
            <Button type="primary" icon={<PlusOutlined />} onClick={addEquipment}>新建设备</Button>
            <Button icon={<CopyOutlined />} disabled={!selectedEquipment} onClick={duplicateEquipment}>复制同位号</Button>
            <Button danger icon={<DeleteOutlined />} disabled={!selectedEquipment} onClick={deleteEquipment}>删除设备</Button>
          </div>
          <div className="pid-toolbar-group pid-toolbar-network">
            <Select
              allowClear
              placeholder="选择网络工程"
              value={networkProjectId || undefined}
              loading={networkLoading}
              options={networkProjects.map((item) => option(item.id, `${item.name}${item.drawingNo ? ` (${item.drawingNo})` : ''} / v${item.version}`))}
              onChange={(id?: string) => {
                if (id) void loadNetworkProject(id);
                else {
                  setNetworkProjectId('');
                  setNetworkVersion(null);
                }
              }}
            />
            <Button type="primary" icon={<SaveOutlined />} loading={networkLoading} onClick={() => void saveNetworkProject()}>保存网络</Button>
            <Dropdown menu={{ items: networkMenuItems, onClick: handleNetworkMenuClick }} trigger={['click']}>
              <Button loading={networkLoading}>网络导入 <DownOutlined /></Button>
            </Dropdown>
            <span className="pid-network-status">{networkProjectId ? `v${networkVersion ?? '-'}` : '未绑定'}</span>
          </div>
          <div className="pid-toolbar-group pid-toolbar-actions">
            <Dropdown menu={{ items: fileMenuItems, onClick: handleFileMenuClick }} trigger={['click']}>
              <Button icon={<SaveOutlined />}>工程文件 <DownOutlined /></Button>
            </Dropdown>
            <Dropdown menu={{ items: exportMenuItems, onClick: handleExportMenuClick }} trigger={['click']}>
              <Button icon={<ExportOutlined />}>导出发布 <DownOutlined /></Button>
            </Dropdown>
          </div>
        </div>
      </div>
      <div className="pid-page-tabs">
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as WorkspaceTab)}
          items={[
            { key: 'canvas', label: '画布' },
            { key: 'project', label: '图纸信息' },
            { key: 'equipment', label: '设备语义' },
            { key: 'streams', label: '物流管线' },
            { key: 'controls', label: '控制联锁' },
            { key: 'narrative', label: '工艺叙事' },
            { key: 'llm', label: 'LLM 预览' },
            { key: 'projectJson', label: '工程 JSON' },
            { key: 'semanticIr', label: '语义 IR' },
            { key: 'agentPackage', label: '发布包' },
            { key: 'equipmentContext', label: '设备上下文' },
            { key: 'streamContext', label: '管线上下文' },
            { key: 'completeness', label: '完整性检查' },
            { key: 'flowPaths', label: '路径追踪' },
          ]}
        />
      </div>
      <div className="pid-work-grid">
        <main className={activeTab === 'canvas' ? 'pid-main-canvas' : 'pid-main-page'}>
          {activeTab === 'canvas' ? renderCanvas() : <div className="pid-page-content">{renderActivePanel()}</div>}
        </main>
      </div>
    </div>
  );
}

function LabeledInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="pid-field">
      <span>{label}</span>
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function LabeledText({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="pid-field">
      <span>{label}</span>
      <Input.TextArea rows={3} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function LabeledSelect<T extends string>({
  label,
  value,
  options,
  labels,
  disabled = false,
  onChange,
}: {
  label: string;
  value: T;
  options: T[];
  labels?: Record<string, string>;
  disabled?: boolean;
  onChange: (value: T) => void;
}) {
  return (
    <label className="pid-field">
      <span>{label}</span>
      <Select disabled={disabled} value={value} options={options.map((item) => option(item, labels?.[item] || item))} onChange={onChange} />
    </label>
  );
}

function TableShell({ columns, children }: { columns: string[]; children: React.ReactNode }) {
  return (
    <div className="pid-table-wrap">
      <table className="pid-table">
        <thead>
          <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export default PidX6Workspace;
