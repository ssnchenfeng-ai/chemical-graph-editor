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

interface ProcessSystem {
  id: string;
  name: string;
  areaId: string;
  purpose: string;
  boundaryIn: string;
  boundaryOut: string;
  operationModes: string;
  utilityDependency: string;
  notes: string;
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
  systemId: string;
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
  dn: string;
  pn: string;
  material: string;
  intent: string;
}

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
  description: string;
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
  level: '工段' | '系统' | '物流' | '控制联锁' | '开停车';
  subject: string;
  generated: string;
  reviewed: string;
}

export interface PidSemanticProjectForAgent {
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
  systems: ProcessSystem[];
  equipments: Equipment[];
  lineGroups: PipeGroup[];
  streams: Stream[];
  pipeNodes: PipeNode[];
  inlineComponents: InlinePipeComponent[];
  controls: ControlInterlock[];
  narratives: ProcessNarrativeItem[];
}

type AgentEntityKind =
  | 'project'
  | 'area'
  | 'sheet'
  | 'system'
  | 'equipment'
  | 'part'
  | 'port'
  | 'stream'
  | 'pipeNode'
  | 'inlineComponent'
  | 'control'
  | 'externalBoundary';

export interface AgentEntityRef {
  kind: AgentEntityKind;
  id: string;
  tag?: string;
}

export interface AgentRelation {
  id: string;
  type:
    | 'AREA_HAS_SHEET'
    | 'AREA_HAS_SYSTEM'
    | 'SYSTEM_CONTAINS_EQUIPMENT'
    | 'SHEET_CONTAINS_EQUIPMENT'
    | 'SHEET_CONTAINS_STREAM'
    | 'EQUIPMENT_HAS_PART'
    | 'EQUIPMENT_HAS_PORT'
    | 'PORT_ATTACHED_TO_PART'
    | 'PART_RELATES_TO_PART'
    | 'STREAM_CONNECTS_PORT'
    | 'STREAM_CONNECTS_PIPE_NODE'
    | 'STREAM_BRANCHES_FROM'
    | 'STREAM_MERGES_TO'
    | 'STREAM_CONTINUES_TO_SHEET'
    | 'STREAM_HAS_INLINE_COMPONENT'
    | 'INLINE_COMPONENT_ON_STREAM'
    | 'CONTROL_MEASURES'
    | 'CONTROL_ACTS_ON'
    | 'INTERLOCK_PROTECTS';
  source: AgentEntityRef;
  target: AgentEntityRef;
  label?: string;
  properties?: Record<string, unknown>;
}

interface AgentEndpoint {
  kind: PipeEndpointKind;
  equipmentId?: string;
  equipmentTag?: string;
  equipmentName?: string;
  portId?: string;
  portName?: string;
  pipeNodeId?: string;
  pipeNodeTag?: string;
  segmentId?: string;
  segmentTag?: string;
  segmentName?: string;
  segmentRatio?: number;
  referenceLabel?: string;
  referenceArea?: string;
  referenceSheet?: string;
  referenceEquipment?: string;
  referencePort?: string;
}

export interface AgentTopologySequenceItem {
  kind: '流向起点' | '在线元件' | '管线节点' | '流向终点';
  label: string;
  entityId?: string;
  tag?: string;
  type?: string;
  order: number;
  positionRatio?: number;
  note?: string;
}

export interface AgentSemanticIR {
  version: 'pid-agent-semantic-ir/v1';
  generatedAt: string;
  source: {
    projectVersion: PidSemanticProjectForAgent['version'];
    pipeModelVersion?: PidSemanticProjectForAgent['pipeModelVersion'];
  };
  project: PidSemanticProjectForAgent['project'];
  areas: ProcessArea[];
  systems: ProcessSystem[];
  sheets: Array<DrawingSheet & { areaId: string; areaName: string }>;
  equipments: Array<Omit<Equipment, 'x' | 'y' | 'width' | 'height'> & {
    areaId: string;
    areaName: string;
    sheetName: string;
    systemName: string;
    completeness: {
      coreFunction: 'provided' | 'pending';
      workingPrinciple: 'provided' | 'pending';
    };
  }>;
  streams: Array<Omit<Stream, 'fromReferenceX' | 'fromReferenceY' | 'toReferenceX' | 'toReferenceY' | 'fromContinuationX' | 'fromContinuationY' | 'toContinuationX' | 'toContinuationY'> & {
    groupTag: string;
    groupName: string;
    from: AgentEndpoint;
    to: AgentEndpoint;
    fromLabel: string;
    toLabel: string;
    flowDirectionText: string;
    topologySequence: AgentTopologySequenceItem[];
    completeness: {
      intent: 'provided' | 'pending';
      dn: 'provided' | 'pending';
      pn: 'provided' | 'pending';
    };
  }>;
  pipeNodes: PipeNode[];
  inlineComponents: InlinePipeComponent[];
  controls: ControlInterlock[];
  narratives: ProcessNarrativeItem[];
  relations: AgentRelation[];
  indexes: {
    equipments: Array<{ id: string; tag: string; name: string; type: EquipmentType; systemId: string; systemName: string; sheetId: string; coreFunction: string }>;
    streams: Array<{ id: string; tag: string; name: string; groupId: string; medium: string; from: string; to: string; topology: string; intent: string }>;
    systems: Array<{ id: string; name: string; equipmentIds: string[]; streamIds: string[] }>;
  };
}

export interface AgentEquipmentContext {
  version: 'pid-agent-equipment-context/v1';
  generatedAt: string;
  focus: { equipmentId: string; tag: string; name: string };
  system?: ProcessSystem;
  area?: ProcessArea;
  sheet?: DrawingSheet;
  equipment: AgentSemanticIR['equipments'][number];
  connectedStreams: AgentSemanticIR['streams'];
  inlineComponents: InlinePipeComponent[];
  controls: ControlInterlock[];
  neighborEquipments: AgentSemanticIR['equipments'];
  relations: AgentRelation[];
}

export interface AgentStreamContext {
  version: 'pid-agent-stream-context/v1';
  generatedAt: string;
  focus: { streamId: string; tag: string; medium: string };
  lineGroup?: PipeGroup;
  sheet?: DrawingSheet;
  stream: AgentSemanticIR['streams'][number];
  endpoints: {
    from?: AgentSemanticIR['equipments'][number];
    to?: AgentSemanticIR['equipments'][number];
  };
  siblingStreams: AgentSemanticIR['streams'];
  inlineComponents: InlinePipeComponent[];
  pipeNodes: PipeNode[];
  topologySequence: AgentTopologySequenceItem[];
  controls: ControlInterlock[];
  relations: AgentRelation[];
}

export interface AgentSystemContext {
  version: 'pid-agent-system-context/v1';
  generatedAt: string;
  focus: { systemId: string; name: string };
  area?: ProcessArea;
  system: ProcessSystem;
  equipments: AgentSemanticIR['equipments'];
  streams: AgentSemanticIR['streams'];
  lineGroups: PipeGroup[];
  controls: ControlInterlock[];
  narratives: ProcessNarrativeItem[];
  relations: AgentRelation[];
}

export interface AgentCompletenessIssue {
  id: string;
  level: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  entity: AgentEntityRef;
  field?: string;
}

export interface AgentFlowPath {
  id: string;
  fromEquipmentId: string;
  fromEquipmentTag: string;
  fromEquipmentLabel: string;
  toEquipmentId: string;
  toEquipmentTag: string;
  toEquipmentLabel: string;
  medium: string;
  streamIds: string[];
  streamTags: string[];
  nodeLabels: string[];
}

export interface AgentPublishPackage {
  version: 'pid-agent-package/v1';
  generatedAt: string;
  manifest: {
    projectName: string;
    drawingNo: string;
    counts: {
      equipments: number;
      streams: number;
      systems: number;
      relations: number;
      equipmentContexts: number;
      streamContexts: number;
      systemContexts: number;
      completenessIssues: number;
      flowPaths: number;
    };
    entrypoints: {
      semanticIr: string;
      relations: string;
      equipmentIndex: string;
      streamIndex: string;
      systemIndex: string;
      mediumIndex: string;
      completeness: string;
      flowPaths: string;
    };
  };
  semanticIR: AgentSemanticIR;
  indexes: {
    equipments: AgentSemanticIR['indexes']['equipments'];
    streams: AgentSemanticIR['indexes']['streams'];
    systems: AgentSemanticIR['indexes']['systems'];
    mediums: Array<{ medium: string; equipmentIds: string[]; streamIds: string[]; inlineComponentIds: string[] }>;
    controls: Array<{ id: string; tag: string; kind: ControlKind; triggerEquipmentId: string; actionEquipmentId: string; purpose: string }>;
    lookup: Record<string, AgentEntityRef[]>;
  };
  contexts: {
    equipment: Record<string, { json: AgentEquipmentContext; markdown: string }>;
    stream: Record<string, { json: AgentStreamContext; markdown: string }>;
    system: Record<string, { json: AgentSystemContext; markdown: string }>;
  };
  completeness: {
    summary: Record<AgentCompletenessIssue['level'], number>;
    issues: AgentCompletenessIssue[];
  };
  flowPaths: AgentFlowPath[];
  files: Record<string, string>;
}

const present = (value: unknown) => value !== undefined && value !== null && String(value).trim() !== '';
const isDefined = <T,>(value: T | undefined | null): value is T => value !== undefined && value !== null;
const completionState = (value: unknown): 'provided' | 'pending' => (present(value) ? 'provided' : 'pending');

const ref = (kind: AgentEntityKind, id: string, tag?: string): AgentEntityRef => ({ kind, id, ...(tag ? { tag } : {}) });

const relationId = (type: string, sourceId: string, targetId: string, suffix = '') => (
  ['rel', type.toLowerCase(), sourceId, targetId, suffix].filter(Boolean).join('__').replace(/[^a-zA-Z0-9_-]+/g, '_')
);

const findSheet = (project: PidSemanticProjectForAgent, sheetId: string) => {
  for (const area of project.areas) {
    const sheet = area.sheets.find((candidate) => candidate.id === sheetId);
    if (sheet) return { area, sheet };
  }
  return undefined;
};

const equipmentLabel = (equipment?: Pick<Equipment, 'tag' | 'name' | 'id'>) => (
  equipment ? [equipment.tag, equipment.name].filter(Boolean).join(' ') || equipment.id : '-'
);

const readableTaggedName = (tag?: string, name?: string, fallback = '-') => {
  if (name && tag) return `${name}（${tag}）`;
  return name || tag || fallback;
};

const partLabel = (equipment: Pick<Equipment, 'parts'> | undefined, partId: string) => (
  equipment?.parts.find((part) => part.id === partId)?.name || partId || '-'
);

const portReadableLabel = (
  equipment: Pick<Equipment, 'tag' | 'name' | 'ports'> | undefined,
  portId: string,
) => {
  const port = equipment?.ports.find((candidate) => candidate.id === portId);
  return [
    readableTaggedName(equipment?.tag, equipment?.name, '未知设备'),
    port?.name ? `连接桩：${port.name}` : '连接桩待命名',
  ].join(' / ');
};

const streamReadableLabel = (
  stream?: Pick<Stream, 'tag' | 'name' | 'intent' | 'medium' | 'groupId'>,
  group?: Pick<PipeGroup, 'name' | 'medium'>,
) => {
  if (!stream) return '-';
  const descriptor = stream.name || stream.intent || stream.medium || group?.name || group?.medium || '';
  return [stream.tag, descriptor].filter(Boolean).join(' ');
};

const referenceTypeLabels = new Set(['界外来源', '界外去向', '跨图引用', '来自界外', '去往界外']);
const referenceDisplayName = (label = '') => (referenceTypeLabels.has(label.trim()) ? '' : label);

const endpointLabel = (endpoint: AgentEndpoint) => {
  if (endpoint.kind === '设备端口') {
    return [
      readableTaggedName(endpoint.equipmentTag, endpoint.equipmentName, '未知设备'),
      endpoint.portName ? `连接桩：${endpoint.portName}` : '连接桩待命名',
    ].join(' / ');
  }
  if (endpoint.kind === '管段接点') {
    const position = endpoint.pipeNodeTag || (present(endpoint.segmentRatio) ? `约 ${endpoint.segmentRatio}% 位置` : '管段接点');
    return [endpoint.segmentName || endpoint.segmentTag || '关联管段', position].filter(Boolean).join(' / ');
  }
  const referenceTarget = [endpoint.referenceEquipment, endpoint.referencePort].filter(Boolean).join(' / ');
  return [referenceDisplayName(endpoint.referenceLabel) || endpoint.kind, endpoint.referenceSheet, referenceTarget].filter(Boolean).join(' / ');
};

const safeFileName = (input: string) => (input || 'untagged').replace(/[\\/:*?"<>|\s]+/g, '_');

const resolveEndpoint = (
  project: PidSemanticProjectForAgent,
  stream: Stream,
  side: 'from' | 'to',
): AgentEndpoint => {
  const equipmentById = new Map(project.equipments.map((equipment) => [equipment.id, equipment]));
  const streamById = new Map(project.streams.map((item) => [item.id, item]));
  const groupById = new Map(project.lineGroups.map((group) => [group.id, group]));
  const pipeNodeById = new Map(project.pipeNodes.map((node) => [node.id, node]));
  const kind = side === 'from' ? stream.fromKind : stream.toKind;
  if (kind === '设备端口') {
    const equipmentId = side === 'from' ? stream.fromEquipmentId : stream.toEquipmentId;
    const portId = side === 'from' ? stream.fromPortId : stream.toPortId;
    const equipment = equipmentById.get(equipmentId);
    const port = equipment?.ports.find((candidate) => candidate.id === portId);
    return {
      kind,
      equipmentId,
      equipmentTag: equipment?.tag,
      equipmentName: equipment?.name,
      portId,
      portName: port?.name,
    };
  }
  if (kind === '管段接点') {
    const segmentId = side === 'from' ? stream.fromSegmentId : stream.toSegmentId;
    const pipeNodeId = side === 'from' ? stream.fromPipeNodeId : stream.toPipeNodeId;
    const segment = streamById.get(segmentId);
    const segmentGroup = segment ? groupById.get(segment.groupId) : undefined;
    const pipeNode = pipeNodeById.get(pipeNodeId || '');
    return {
      kind,
      segmentId,
      segmentTag: segment?.tag,
      segmentName: streamReadableLabel(segment, segmentGroup),
      segmentRatio: side === 'from' ? stream.fromSegmentRatio : stream.toSegmentRatio,
      pipeNodeId,
      pipeNodeTag: pipeNode?.tag,
    };
  }
  return {
    kind,
    referenceLabel: referenceDisplayName(side === 'from' ? stream.fromReferenceLabel : stream.toReferenceLabel),
    referenceArea: side === 'from' ? stream.fromReferenceArea : stream.toReferenceArea,
    referenceSheet: side === 'from' ? stream.fromReferenceSheet : stream.toReferenceSheet,
    referenceEquipment: side === 'from' ? stream.fromReferenceEquipment : stream.toReferenceEquipment,
    referencePort: side === 'from' ? stream.fromReferencePort : stream.toReferencePort,
  };
};

const topologyOrder = (item: { order?: number; positionRatio?: number }, fallback = 50) => (
  Number.isFinite(item.order) ? Number(item.order) : Number.isFinite(item.positionRatio) ? Number(item.positionRatio) : fallback
);

const isMeasurementInlineType = (type: InlinePipeComponentType) => (
  type === '压力测点'
  || type === '温度测点'
  || type === '就地压力测点'
  || type === '远传压力测点'
  || type === '就地温度测点'
  || type === '远传温度测点'
  || type === '分析测点'
  || type === '流量计'
);

const inlineComponentLabel = (component: InlinePipeComponent) => (
  [component.tag, component.name || component.type].filter(Boolean).join(' ')
);

const inlineNormalStateForAgent = (component: InlinePipeComponent) => (
  isMeasurementInlineType(component.type) ? '' : component.normalState
);

const inlineActuatorForAgent = (component: InlinePipeComponent) => (
  isMeasurementInlineType(component.type) ? '' : component.actuator
);

const inlineComponentNote = (component: InlinePipeComponent) => (
  [
    inlineNormalStateForAgent(component),
    component.controlSignal,
    component.description,
  ].filter(Boolean).join('；')
);

const pipeNodeLabel = (node: PipeNode) => (
  [node.tag, node.name || node.kind].filter(Boolean).join(' ')
);

const buildStreamTopologySequence = (
  project: PidSemanticProjectForAgent,
  stream: Stream,
  from: AgentEndpoint,
  to: AgentEndpoint,
): AgentTopologySequenceItem[] => {
  const middle = [
    ...project.inlineComponents
      .filter((component) => component.segmentId === stream.id)
      .map((component) => ({
        kind: '在线元件' as const,
        label: inlineComponentLabel(component),
        entityId: component.id,
        tag: component.tag,
        type: component.type,
        order: topologyOrder(component),
        positionRatio: component.positionRatio,
        note: inlineComponentNote(component),
      })),
    ...project.pipeNodes
      .filter((node) => node.segmentId === stream.id)
      .map((node) => ({
        kind: '管线节点' as const,
        label: pipeNodeLabel(node),
        entityId: node.id,
        tag: node.tag,
        type: node.kind,
        order: topologyOrder(node),
        positionRatio: node.positionRatio,
        note: node.description,
      })),
  ].sort((a, b) => a.order - b.order || (a.positionRatio ?? 0) - (b.positionRatio ?? 0) || a.label.localeCompare(b.label));

  return [
    { kind: '流向起点', label: endpointLabel(from), order: 0 },
    ...middle,
    { kind: '流向终点', label: endpointLabel(to), order: 100 },
  ];
};

const streamTouchesEquipment = (stream: AgentSemanticIR['streams'][number] | Stream, equipmentId: string) => (
  stream.fromKind === '设备端口' && stream.fromEquipmentId === equipmentId
) || (
  stream.toKind === '设备端口' && stream.toEquipmentId === equipmentId
);

const relationTouchesIds = (relation: AgentRelation, ids: Set<string>) => ids.has(relation.source.id) || ids.has(relation.target.id);

export const projectToAgentSemanticIR = (project: PidSemanticProjectForAgent): AgentSemanticIR => {
  const systemById = new Map(project.systems.map((system) => [system.id, system]));
  const equipmentById = new Map(project.equipments.map((equipment) => [equipment.id, equipment]));
  const groupById = new Map(project.lineGroups.map((group) => [group.id, group]));
  const streamById = new Map(project.streams.map((stream) => [stream.id, stream]));
  const pipeNodeById = new Map(project.pipeNodes.map((node) => [node.id, node]));
  const relations: AgentRelation[] = [];

  const addRelation = (relation: AgentRelation) => {
    relations.push(relation);
  };

  project.areas.forEach((area) => {
    area.sheets.forEach((sheet) => {
      addRelation({
        id: relationId('AREA_HAS_SHEET', area.id, sheet.id),
        type: 'AREA_HAS_SHEET',
        source: ref('area', area.id, area.name),
        target: ref('sheet', sheet.id, sheet.name),
      });
    });
  });

  project.systems.forEach((system) => {
    const area = project.areas.find((item) => item.id === system.areaId);
    addRelation({
      id: relationId('AREA_HAS_SYSTEM', system.areaId, system.id),
      type: 'AREA_HAS_SYSTEM',
      source: ref('area', system.areaId, area?.name),
      target: ref('system', system.id, system.name),
    });
  });

  project.equipments.forEach((equipment) => {
    const system = systemById.get(equipment.systemId);
    const sheetInfo = findSheet(project, equipment.sheetId);
    addRelation({
      id: relationId('SYSTEM_CONTAINS_EQUIPMENT', equipment.systemId, equipment.id),
      type: 'SYSTEM_CONTAINS_EQUIPMENT',
      source: ref('system', equipment.systemId, system?.name),
      target: ref('equipment', equipment.id, equipment.tag),
    });
    addRelation({
      id: relationId('SHEET_CONTAINS_EQUIPMENT', equipment.sheetId, equipment.id),
      type: 'SHEET_CONTAINS_EQUIPMENT',
      source: ref('sheet', equipment.sheetId, sheetInfo?.sheet.name),
      target: ref('equipment', equipment.id, equipment.tag),
    });
    equipment.parts.forEach((part) => {
      addRelation({
        id: relationId('EQUIPMENT_HAS_PART', equipment.id, part.id),
        type: 'EQUIPMENT_HAS_PART',
        source: ref('equipment', equipment.id, equipment.tag),
        target: ref('part', `${equipment.id}.${part.id}`, part.name),
      });
    });
    equipment.ports.forEach((port) => {
      const readablePort = portReadableLabel(equipment, port.id);
      addRelation({
        id: relationId('EQUIPMENT_HAS_PORT', equipment.id, port.id),
        type: 'EQUIPMENT_HAS_PORT',
        source: ref('equipment', equipment.id, equipment.tag),
        target: ref('port', `${equipment.id}.${port.id}`, readablePort),
        properties: { direction: port.direction, medium: port.medium, role: port.role },
      });
      if (port.ownerPartId) {
        addRelation({
          id: relationId('PORT_ATTACHED_TO_PART', `${equipment.id}.${port.id}`, `${equipment.id}.${port.ownerPartId}`),
          type: 'PORT_ATTACHED_TO_PART',
          source: ref('port', `${equipment.id}.${port.id}`, readablePort),
          target: ref('part', `${equipment.id}.${port.ownerPartId}`, partLabel(equipment, port.ownerPartId)),
        });
      }
    });
    equipment.relations.forEach((internalRelation) => {
      addRelation({
        id: relationId('PART_RELATES_TO_PART', `${equipment.id}.${internalRelation.sourcePartId}`, `${equipment.id}.${internalRelation.targetPartId}`, internalRelation.id),
        type: 'PART_RELATES_TO_PART',
        source: ref('part', `${equipment.id}.${internalRelation.sourcePartId}`, partLabel(equipment, internalRelation.sourcePartId)),
        target: ref('part', `${equipment.id}.${internalRelation.targetPartId}`, partLabel(equipment, internalRelation.targetPartId)),
        label: internalRelation.relation,
        properties: { description: internalRelation.description },
      });
    });
  });

  project.streams.forEach((stream) => {
    const group = groupById.get(stream.groupId);
    const sheetInfo = findSheet(project, stream.sheetId);
    addRelation({
      id: relationId('SHEET_CONTAINS_STREAM', stream.sheetId, stream.id),
      type: 'SHEET_CONTAINS_STREAM',
      source: ref('sheet', stream.sheetId, sheetInfo?.sheet.name),
      target: ref('stream', stream.id, stream.tag),
    });

    (['from', 'to'] as const).forEach((side) => {
      const endpoint = resolveEndpoint(project, stream, side);
      if (endpoint.kind === '设备端口' && endpoint.equipmentId && endpoint.portId) {
        addRelation({
          id: relationId('STREAM_CONNECTS_PORT', stream.id, `${endpoint.equipmentId}.${endpoint.portId}`, side),
          type: 'STREAM_CONNECTS_PORT',
          source: ref('stream', stream.id, stream.tag),
          target: ref('port', `${endpoint.equipmentId}.${endpoint.portId}`, endpointLabel(endpoint)),
          label: side,
          properties: { side, medium: stream.medium || group?.medium || '', directionMode: stream.directionMode },
        });
      } else if (endpoint.kind === '管段接点' && endpoint.segmentId) {
        const pipeNodeId = endpoint.pipeNodeId || `${stream.id}.${side}.pipeNode`;
        const relationType = side === 'from' ? 'STREAM_BRANCHES_FROM' : 'STREAM_MERGES_TO';
        addRelation({
          id: relationId(relationType, stream.id, endpoint.segmentId, side),
          type: relationType,
          source: ref('stream', stream.id, stream.tag),
          target: ref('stream', endpoint.segmentId, endpoint.segmentName || endpoint.segmentTag),
          label: side,
          properties: { ratio: endpoint.segmentRatio, pipeNodeId },
        });
        addRelation({
          id: relationId('STREAM_CONNECTS_PIPE_NODE', stream.id, pipeNodeId, side),
          type: 'STREAM_CONNECTS_PIPE_NODE',
          source: ref('stream', stream.id, stream.tag),
          target: ref('pipeNode', pipeNodeId, endpoint.pipeNodeTag),
          label: side,
        });
      } else if (endpoint.kind === '跨图引用' && endpoint.referenceSheet) {
        addRelation({
          id: relationId('STREAM_CONTINUES_TO_SHEET', stream.id, endpoint.referenceSheet, side),
          type: 'STREAM_CONTINUES_TO_SHEET',
          source: ref('stream', stream.id, stream.tag),
          target: ref('sheet', endpoint.referenceSheet, endpoint.referenceSheet),
          label: side,
          properties: { ...endpoint },
        });
      } else if (endpoint.kind === '界外来源' || endpoint.kind === '界外去向') {
        addRelation({
          id: relationId('STREAM_CONTINUES_TO_SHEET', stream.id, endpoint.kind, side),
          type: 'STREAM_CONTINUES_TO_SHEET',
          source: ref('stream', stream.id, stream.tag),
          target: ref('externalBoundary', `${stream.id}.${side}.${endpoint.kind}`, endpoint.referenceLabel || endpoint.kind),
          label: side,
          properties: { ...endpoint },
        });
      }
    });
  });

  project.inlineComponents.forEach((component) => {
    const stream = streamById.get(component.segmentId);
    addRelation({
      id: relationId('STREAM_HAS_INLINE_COMPONENT', component.segmentId, component.id),
      type: 'STREAM_HAS_INLINE_COMPONENT',
      source: ref('stream', component.segmentId, stream?.tag),
      target: ref('inlineComponent', component.id, component.tag),
      properties: { positionRatio: component.positionRatio, normalState: inlineNormalStateForAgent(component), actuator: inlineActuatorForAgent(component), type: component.type },
    });
    addRelation({
      id: relationId('INLINE_COMPONENT_ON_STREAM', component.id, component.segmentId),
      type: 'INLINE_COMPONENT_ON_STREAM',
      source: ref('inlineComponent', component.id, component.tag),
      target: ref('stream', component.segmentId, stream?.tag),
      properties: { positionRatio: component.positionRatio },
    });
  });

  project.controls.forEach((control) => {
    const triggerEquipment = equipmentById.get(control.triggerEquipmentId);
    const actionEquipment = equipmentById.get(control.actionEquipmentId);
    if (control.triggerEquipmentId) {
      addRelation({
        id: relationId('CONTROL_MEASURES', control.id, `${control.triggerEquipmentId}.${control.triggerPartId}`),
        type: 'CONTROL_MEASURES',
        source: ref('control', control.id, control.tag),
        target: ref('part', `${control.triggerEquipmentId}.${control.triggerPartId}`, partLabel(triggerEquipment, control.triggerPartId)),
        properties: { condition: control.condition },
      });
    }
    if (control.actionEquipmentId) {
      addRelation({
        id: relationId('CONTROL_ACTS_ON', control.id, `${control.actionEquipmentId}.${control.actionTargetId}`),
        type: 'CONTROL_ACTS_ON',
        source: ref('control', control.id, control.tag),
        target: ref('part', `${control.actionEquipmentId}.${control.actionTargetId}`, partLabel(actionEquipment, control.actionTargetId)),
        properties: { action: control.action },
      });
      addRelation({
        id: relationId('INTERLOCK_PROTECTS', control.id, control.actionEquipmentId),
        type: 'INTERLOCK_PROTECTS',
        source: ref('control', control.id, control.tag),
        target: ref('equipment', control.actionEquipmentId, actionEquipment?.tag),
        properties: { purpose: control.purpose, reset: control.reset },
      });
    }
  });

  const sheets = project.areas.flatMap((area) => area.sheets.map((sheet) => ({ ...sheet, areaId: area.id, areaName: area.name })));
  const equipments = project.equipments.map((equipment) => {
    const sheetInfo = findSheet(project, equipment.sheetId);
    const system = systemById.get(equipment.systemId);
    const { x: _x, y: _y, width: _width, height: _height, ...semanticEquipment } = equipment;
    return {
      ...semanticEquipment,
      areaId: sheetInfo?.area.id || '',
      areaName: sheetInfo?.area.name || '',
      sheetName: sheetInfo?.sheet.name || '',
      systemName: system?.name || '',
      completeness: {
        coreFunction: completionState(equipment.profile.coreFunction),
        workingPrinciple: completionState(equipment.profile.workingPrinciple),
      },
    };
  });
  const semanticEquipmentById = new Map(equipments.map((equipment) => [equipment.id, equipment]));
  const streams = project.streams.map((stream) => {
    const group = groupById.get(stream.groupId);
    const from = resolveEndpoint(project, stream, 'from');
    const to = resolveEndpoint(project, stream, 'to');
    const topologySequence = buildStreamTopologySequence(project, stream, from, to);
    const {
      fromReferenceX: _fromReferenceX,
      fromReferenceY: _fromReferenceY,
      toReferenceX: _toReferenceX,
      toReferenceY: _toReferenceY,
      fromContinuationX: _fromContinuationX,
      fromContinuationY: _fromContinuationY,
      toContinuationX: _toContinuationX,
      toContinuationY: _toContinuationY,
      ...semanticStream
    } = stream;
    return {
      ...semanticStream,
      groupTag: group?.tag || '',
      groupName: group?.name || '',
      from,
      to,
      fromLabel: endpointLabel(from),
      toLabel: endpointLabel(to),
      flowDirectionText: topologySequence.map((item) => item.label).join(' -> '),
      topologySequence,
      completeness: {
        intent: completionState(stream.intent),
        dn: completionState(stream.dn),
        pn: completionState(stream.pn),
      },
    };
  });

  return {
    version: 'pid-agent-semantic-ir/v1',
    generatedAt: new Date().toISOString(),
    source: {
      projectVersion: project.version,
      pipeModelVersion: project.pipeModelVersion,
    },
    project: project.project,
    areas: project.areas,
    systems: project.systems,
    sheets,
    equipments,
    streams,
    pipeNodes: project.pipeNodes.map((node) => ({ ...node, tag: node.tag || pipeNodeById.get(node.id)?.tag || node.id })),
    inlineComponents: project.inlineComponents,
    controls: project.controls,
    narratives: project.narratives,
    relations,
    indexes: {
      equipments: equipments.map((equipment) => ({
        id: equipment.id,
        tag: equipment.tag,
        name: equipment.name,
        type: equipment.type,
        systemId: equipment.systemId,
        systemName: equipment.systemName,
        sheetId: equipment.sheetId,
        coreFunction: equipment.profile.coreFunction,
      })),
      streams: streams.map((stream) => ({
        id: stream.id,
        tag: stream.tag,
        name: stream.name,
        groupId: stream.groupId,
        medium: stream.medium || groupById.get(stream.groupId)?.medium || '',
        from: stream.fromLabel,
        to: stream.toLabel,
        topology: stream.flowDirectionText,
        intent: stream.intent,
      })),
      systems: project.systems.map((system) => ({
        id: system.id,
        name: system.name,
        equipmentIds: project.equipments.filter((equipment) => equipment.systemId === system.id).map((equipment) => equipment.id),
        streamIds: project.streams.filter((stream) => {
          const fromEquipment = stream.fromKind === '设备端口' ? semanticEquipmentById.get(stream.fromEquipmentId) : undefined;
          const toEquipment = stream.toKind === '设备端口' ? semanticEquipmentById.get(stream.toEquipmentId) : undefined;
          return fromEquipment?.systemId === system.id || toEquipment?.systemId === system.id;
        }).map((stream) => stream.id),
      })),
    },
  };
};

export const buildEquipmentAgentContext = (
  project: PidSemanticProjectForAgent,
  equipmentIdOrTag: string,
): AgentEquipmentContext | undefined => {
  const ir = projectToAgentSemanticIR(project);
  const equipment = ir.equipments.find((item) => item.id === equipmentIdOrTag || item.tag === equipmentIdOrTag);
  if (!equipment) return undefined;
  const sheetInfo = findSheet(project, equipment.sheetId);
  const system = project.systems.find((item) => item.id === equipment.systemId);
  const connectedStreams = ir.streams.filter((stream) => streamTouchesEquipment(stream, equipment.id));
  const connectedStreamIds = new Set(connectedStreams.map((stream) => stream.id));
  const inlineComponents = project.inlineComponents.filter((component) => connectedStreamIds.has(component.segmentId));
  const neighborIds = new Set<string>();
  connectedStreams.forEach((stream) => {
    if (stream.fromKind === '设备端口' && stream.fromEquipmentId !== equipment.id) neighborIds.add(stream.fromEquipmentId);
    if (stream.toKind === '设备端口' && stream.toEquipmentId !== equipment.id) neighborIds.add(stream.toEquipmentId);
  });
  const controls = project.controls.filter((control) => (
    control.triggerEquipmentId === equipment.id || control.actionEquipmentId === equipment.id
  ));
  const touchedIds = new Set<string>([
    equipment.id,
    ...equipment.parts.map((part) => `${equipment.id}.${part.id}`),
    ...equipment.ports.map((port) => `${equipment.id}.${port.id}`),
    ...connectedStreams.map((stream) => stream.id),
    ...inlineComponents.map((component) => component.id),
    ...controls.map((control) => control.id),
  ]);
  return {
    version: 'pid-agent-equipment-context/v1',
    generatedAt: ir.generatedAt,
    focus: { equipmentId: equipment.id, tag: equipment.tag, name: equipment.name },
    system,
    area: sheetInfo?.area,
    sheet: sheetInfo?.sheet,
    equipment,
    connectedStreams,
    inlineComponents,
    controls,
    neighborEquipments: ir.equipments.filter((candidate) => neighborIds.has(candidate.id)),
    relations: ir.relations.filter((relation) => relationTouchesIds(relation, touchedIds)),
  };
};

export const buildStreamAgentContext = (
  project: PidSemanticProjectForAgent,
  streamIdOrTag: string,
): AgentStreamContext | undefined => {
  const ir = projectToAgentSemanticIR(project);
  const stream = ir.streams.find((item) => item.id === streamIdOrTag || item.tag === streamIdOrTag);
  if (!stream) return undefined;
  const sheetInfo = findSheet(project, stream.sheetId);
  const lineGroup = project.lineGroups.find((group) => group.id === stream.groupId);
  const endpointEquipmentIds = [stream.from.equipmentId, stream.to.equipmentId].filter(Boolean) as string[];
  const siblingStreams = ir.streams.filter((item) => item.groupId === stream.groupId && item.id !== stream.id);
  const siblingStreamIds = new Set(siblingStreams.map((item) => item.id));
  const inlineComponents = project.inlineComponents.filter((component) => component.segmentId === stream.id);
  const pipeNodes = project.pipeNodes.filter((node) => (
    node.segmentId === stream.id || node.id === stream.from.pipeNodeId || node.id === stream.to.pipeNodeId
  ));
  const controls = project.controls.filter((control) => endpointEquipmentIds.includes(control.triggerEquipmentId) || endpointEquipmentIds.includes(control.actionEquipmentId));
  const touchedIds = new Set<string>([
    stream.id,
    ...endpointEquipmentIds,
    ...endpointEquipmentIds.flatMap((equipmentId) => {
      const equipment = ir.equipments.find((item) => item.id === equipmentId);
      return [
        ...(equipment?.ports || []).map((port) => `${equipmentId}.${port.id}`),
        ...(equipment?.parts || []).map((part) => `${equipmentId}.${part.id}`),
      ];
    }),
    ...inlineComponents.map((component) => component.id),
    ...pipeNodes.map((node) => node.id),
    ...controls.map((control) => control.id),
    ...siblingStreamIds,
  ]);
  return {
    version: 'pid-agent-stream-context/v1',
    generatedAt: ir.generatedAt,
    focus: { streamId: stream.id, tag: stream.tag, medium: stream.medium || lineGroup?.medium || '' },
    lineGroup,
    sheet: sheetInfo?.sheet,
    stream,
    endpoints: {
      from: stream.from.equipmentId ? ir.equipments.find((equipment) => equipment.id === stream.from.equipmentId) : undefined,
      to: stream.to.equipmentId ? ir.equipments.find((equipment) => equipment.id === stream.to.equipmentId) : undefined,
    },
    siblingStreams,
    inlineComponents,
    pipeNodes,
    topologySequence: stream.topologySequence,
    controls,
    relations: ir.relations.filter((relation) => relationTouchesIds(relation, touchedIds)),
  };
};

export const buildSystemAgentContext = (
  project: PidSemanticProjectForAgent,
  systemIdOrName: string,
): AgentSystemContext | undefined => {
  const ir = projectToAgentSemanticIR(project);
  const system = project.systems.find((item) => item.id === systemIdOrName || item.name === systemIdOrName);
  if (!system) return undefined;
  const area = project.areas.find((item) => item.id === system.areaId);
  const equipments = ir.equipments.filter((equipment) => equipment.systemId === system.id);
  const equipmentIds = new Set(equipments.map((equipment) => equipment.id));
  const streams = ir.streams.filter((stream) => (
    (stream.from.equipmentId && equipmentIds.has(stream.from.equipmentId))
    || (stream.to.equipmentId && equipmentIds.has(stream.to.equipmentId))
  ));
  const streamIds = new Set(streams.map((stream) => stream.id));
  const lineGroups = project.lineGroups.filter((group) => streams.some((stream) => stream.groupId === group.id));
  const controls = project.controls.filter((control) => equipmentIds.has(control.triggerEquipmentId) || equipmentIds.has(control.actionEquipmentId));
  const narratives = project.narratives.filter((item) => item.subject === system.name || item.level === '系统');
  const touchedIds = new Set<string>([
    system.id,
    ...equipmentIds,
    ...equipments.flatMap((equipment) => [
      ...equipment.parts.map((part) => `${equipment.id}.${part.id}`),
      ...equipment.ports.map((port) => `${equipment.id}.${port.id}`),
    ]),
    ...streamIds,
    ...controls.map((control) => control.id),
  ]);
  return {
    version: 'pid-agent-system-context/v1',
    generatedAt: ir.generatedAt,
    focus: { systemId: system.id, name: system.name },
    area,
    system,
    equipments,
    streams,
    lineGroups,
    controls,
    narratives,
    relations: ir.relations.filter((relation) => relationTouchesIds(relation, touchedIds)),
  };
};

const tableRow = (items: unknown[]) => `| ${items.map((item) => (present(item) ? String(item).replace(/\|/g, '/') : '-')).join(' | ')} |`;

export const renderEquipmentAgentContextMarkdown = (context: AgentEquipmentContext) => {
  const lines: string[] = [];
  const equipment = context.equipment;
  const streamLabelById = new Map(context.connectedStreams.map((stream) => [stream.id, streamReadableLabel(stream, { name: stream.groupName, medium: stream.medium })]));
  lines.push(`# 设备上下文 ${equipment.tag} ${equipment.name}`);
  lines.push('');
  lines.push(`- 系统：${context.system?.name || '-'}`);
  lines.push(`- 区域/分段：${context.area?.name || '-'} / ${context.sheet?.name || '-'}`);
  lines.push(`- 类型：${equipment.type}`);
  lines.push(`- 核心功能：${equipment.profile.coreFunction || '待补全'}`);
  lines.push(`- 工作原理：${equipment.profile.workingPrinciple || '待补全'}`);
  lines.push(`- 描述：${equipment.description || '-'}`);
  lines.push('');
  lines.push('## 内部组成');
  lines.push(tableRow(['ID', '类别', '类型', '名称', '相态', '作用']));
  lines.push(tableRow(['---', '---', '---', '---', '---', '---']));
  equipment.parts.forEach((part) => lines.push(tableRow([part.id, part.category, part.type, part.name, part.phase, part.role])));
  lines.push('');
  lines.push('## 连接桩');
  lines.push(tableRow(['连接桩', '挂接组成', '方向', '角色', '介质']));
  lines.push(tableRow(['---', '---', '---', '---', '---']));
  equipment.ports.forEach((port) => lines.push(tableRow([port.name || '未命名连接桩', partLabel(equipment, port.ownerPartId), port.direction, port.role, port.medium])));
  lines.push('');
  lines.push('## 相邻管线');
  lines.push(tableRow(['管线', '名称', '介质', '起点', '终点', 'DN', 'PN', '工艺意图']));
  lines.push(tableRow(['---', '---', '---', '---', '---', '---', '---', '---']));
  context.connectedStreams.forEach((stream) => lines.push(tableRow([
    stream.tag,
    stream.name,
    stream.medium || stream.groupName,
    stream.fromLabel,
    stream.toLabel,
    stream.dn,
    stream.pn,
    stream.intent || '待补全',
  ])));
  lines.push('');
  lines.push('## 在线元件');
  if (context.inlineComponents.length === 0) {
    lines.push('- 无直接相邻在线元件');
  } else {
    lines.push(tableRow(['位号', '类型', '所在管线', '沿流向位置', '常态', '执行机构', '控制信号']));
    lines.push(tableRow(['---', '---', '---', '---', '---', '---', '---']));
    context.inlineComponents.forEach((component) => lines.push(tableRow([
      component.tag,
      component.type,
      streamLabelById.get(component.segmentId) || '关联管线',
      `${component.positionRatio}% / 顺序 ${component.order ?? component.positionRatio}`,
      inlineNormalStateForAgent(component),
      inlineActuatorForAgent(component),
      component.controlSignal,
    ])));
  }
  lines.push('');
  lines.push('## 控制联锁');
  if (context.controls.length === 0) {
    lines.push('- 暂无直接关联控制联锁');
  } else {
    context.controls.forEach((control) => lines.push(`- ${control.tag}：${control.condition || '触发条件待补全'} -> ${control.action || '动作待补全'}，目的：${control.purpose || '待补全'}`));
  }
  lines.push('');
  lines.push('## 关系摘要');
  lines.push(`- 显式关系数：${context.relations.length}`);
  return lines.join('\n');
};

export const renderStreamAgentContextMarkdown = (context: AgentStreamContext) => {
  const lines: string[] = [];
  const stream = context.stream;
  lines.push(`# 管线上下文 ${stream.tag}${stream.name ? ` ${stream.name}` : ''}`);
  lines.push('');
  lines.push(`- 管线组：${context.lineGroup?.tag || '-'} ${context.lineGroup?.name || ''}`);
  lines.push(`- 管段名称：${stream.name || '-'}`);
  lines.push(`- 分段：${context.sheet?.name || '-'}`);
  lines.push(`- 介质：${stream.medium || context.lineGroup?.medium || '-'}`);
  lines.push(`- 流向：${stream.fromLabel} -> ${stream.toLabel}`);
  lines.push(`- 沿流向顺序：${stream.flowDirectionText || '待补全'}`);
  lines.push(`- DN/PN：${stream.dn || '待补全'} / ${stream.pn || '待补全'}`);
  lines.push(`- 材质：${stream.material || '-'}`);
  lines.push(`- 工艺意图：${stream.intent || '待补全'}`);
  lines.push('');
  lines.push('## 端点设备');
  [context.endpoints.from, context.endpoints.to].filter(Boolean).forEach((equipment) => {
    if (!equipment) return;
    lines.push(`- ${equipmentLabel(equipment)}：${equipment.profile.coreFunction || '核心功能待补全'}`);
  });
  lines.push('');
  lines.push('## 沿流向拓扑顺序');
  lines.push(tableRow(['顺序', '类型', '对象', '位置', '说明']));
  lines.push(tableRow(['---', '---', '---', '---', '---']));
  context.topologySequence.forEach((item, index) => lines.push(tableRow([
    index + 1,
    item.kind,
    item.label,
    item.positionRatio !== undefined ? `${item.positionRatio}%` : item.order,
    item.note,
  ])));
  lines.push('');
  lines.push('## 在线元件');
  if (context.inlineComponents.length === 0) {
    lines.push('- 无在线元件');
  } else {
    lines.push(tableRow(['位号', '类型', '名称', '沿流向位置', '常态', '控制信号', '说明']));
    lines.push(tableRow(['---', '---', '---', '---', '---', '---', '---']));
    context.inlineComponents.forEach((component) => lines.push(tableRow([component.tag, component.type, component.name, `${component.positionRatio}% / 顺序 ${component.order ?? component.positionRatio}`, inlineNormalStateForAgent(component), component.controlSignal, component.description])));
  }
  lines.push('');
  lines.push('## 同组管段');
  if (context.siblingStreams.length === 0) {
    lines.push('- 无同组管段');
  } else {
    context.siblingStreams.forEach((sibling) => lines.push(`- ${sibling.tag}：${sibling.fromLabel} -> ${sibling.toLabel}，意图：${sibling.intent || '待补全'}`));
  }
  lines.push('');
  lines.push('## 控制联锁');
  if (context.controls.length === 0) {
    lines.push('- 暂无端点设备关联控制联锁');
  } else {
    context.controls.forEach((control) => lines.push(`- ${control.tag}：${control.condition || '触发条件待补全'} -> ${control.action || '动作待补全'}`));
  }
  lines.push('');
  lines.push('## 关系摘要');
  lines.push(`- 显式关系数：${context.relations.length}`);
  return lines.join('\n');
};

export const renderSystemAgentContextMarkdown = (context: AgentSystemContext) => {
  const lines: string[] = [];
  lines.push(`# 系统上下文 ${context.system.name}`);
  lines.push('');
  lines.push(`- 所属区域：${context.area?.name || '-'}`);
  lines.push(`- 系统目的：${context.system.purpose || '待补全'}`);
  lines.push(`- 边界入口：${context.system.boundaryIn || '待补全'}`);
  lines.push(`- 边界出口：${context.system.boundaryOut || '待补全'}`);
  lines.push(`- 操作模式：${context.system.operationModes || '待补全'}`);
  lines.push(`- 公用工程依赖：${context.system.utilityDependency || '待补全'}`);
  lines.push('');
  lines.push('## 设备');
  lines.push(tableRow(['位号', '类型', '名称', '核心功能']));
  lines.push(tableRow(['---', '---', '---', '---']));
  context.equipments.forEach((equipment) => lines.push(tableRow([equipment.tag, equipment.type, equipment.name, equipment.profile.coreFunction || '待补全'])));
  lines.push('');
  lines.push('## 相关管线');
  lines.push(tableRow(['管线', '名称', '管线组', '介质', '起点', '终点', '工艺意图']));
  lines.push(tableRow(['---', '---', '---', '---', '---', '---', '---']));
  context.streams.forEach((stream) => lines.push(tableRow([
    stream.tag,
    stream.name,
    stream.groupTag,
    stream.medium || stream.groupName,
    stream.fromLabel,
    stream.toLabel,
    stream.intent || '待补全',
  ])));
  lines.push('');
  lines.push('## 控制联锁');
  if (context.controls.length === 0) {
    lines.push('- 暂无直接关联控制联锁');
  } else {
    context.controls.forEach((control) => lines.push(`- ${control.tag}：${control.condition || '触发条件待补全'} -> ${control.action || '动作待补全'}，目的：${control.purpose || '待补全'}`));
  }
  lines.push('');
  lines.push('## 关系摘要');
  lines.push(`- 显式关系数：${context.relations.length}`);
  return lines.join('\n');
};

const issueSummary = (issues: AgentCompletenessIssue[]) => ({
  error: issues.filter((issue) => issue.level === 'error').length,
  warning: issues.filter((issue) => issue.level === 'warning').length,
  info: issues.filter((issue) => issue.level === 'info').length,
});

const addLookup = (lookup: Record<string, AgentEntityRef[]>, key: string, entity: AgentEntityRef) => {
  const normalized = key.trim().toLowerCase();
  if (!normalized) return;
  lookup[normalized] = [...(lookup[normalized] || []), entity];
};

const mediumKey = (value: string) => value.trim() || '未填写介质';

const compareMedium = (left: string, right: string) => {
  const a = left.trim();
  const b = right.trim();
  if (!a || !b) return true;
  if (a === b) return true;
  return ['物料', '水', '任意'].includes(a) || ['物料', '水', '任意'].includes(b);
};

export const buildCompletenessIssues = (project: PidSemanticProjectForAgent, ir = projectToAgentSemanticIR(project)) => {
  const issues: AgentCompletenessIssue[] = [];
  const pushIssue = (issue: Omit<AgentCompletenessIssue, 'id'>) => {
    issues.push({ ...issue, id: `issue_${String(issues.length + 1).padStart(4, '0')}` });
  };
  const equipmentById = new Map(project.equipments.map((equipment) => [equipment.id, equipment]));
  const streamById = new Map(project.streams.map((stream) => [stream.id, stream]));
  project.systems.forEach((system) => {
    if (!present(system.purpose)) {
      pushIssue({ level: 'warning', code: 'SYSTEM_PURPOSE_PENDING', message: `${system.name} 缺少系统目的。`, entity: ref('system', system.id, system.name), field: 'purpose' });
    }
    if (!present(system.boundaryIn) || !present(system.boundaryOut)) {
      pushIssue({ level: 'warning', code: 'SYSTEM_BOUNDARY_PENDING', message: `${system.name} 缺少入口或出口边界。`, entity: ref('system', system.id, system.name), field: 'boundaryIn/boundaryOut' });
    }
  });
  project.equipments.forEach((equipment) => {
    if (!present(equipment.profile.coreFunction)) {
      pushIssue({ level: 'warning', code: 'EQUIPMENT_CORE_FUNCTION_PENDING', message: `${equipment.tag} 缺少核心功能。`, entity: ref('equipment', equipment.id, equipment.tag), field: 'profile.coreFunction' });
    }
    if (!present(equipment.profile.workingPrinciple)) {
      pushIssue({ level: 'info', code: 'EQUIPMENT_WORKING_PRINCIPLE_PENDING', message: `${equipment.tag} 缺少工作原理。`, entity: ref('equipment', equipment.id, equipment.tag), field: 'profile.workingPrinciple' });
    }
    if (equipment.parts.length === 0) {
      pushIssue({ level: 'error', code: 'EQUIPMENT_PARTS_EMPTY', message: `${equipment.tag} 没有内部组成。`, entity: ref('equipment', equipment.id, equipment.tag), field: 'parts' });
    }
    if (equipment.ports.length === 0) {
      pushIssue({ level: 'warning', code: 'EQUIPMENT_PORTS_EMPTY', message: `${equipment.tag} 没有对外连接桩。`, entity: ref('equipment', equipment.id, equipment.tag), field: 'ports' });
    }
    equipment.ports.forEach((port) => {
      if (!equipment.parts.some((part) => part.id === port.ownerPartId)) {
        const readablePort = portReadableLabel(equipment, port.id);
        pushIssue({ level: 'error', code: 'PORT_OWNER_PART_MISSING', message: `${readablePort} 挂接的内部组成不存在。`, entity: ref('port', `${equipment.id}.${port.id}`, readablePort), field: 'ownerPartId' });
      }
      if (!present(port.medium)) {
        const readablePort = portReadableLabel(equipment, port.id);
        pushIssue({ level: 'info', code: 'PORT_MEDIUM_PENDING', message: `${readablePort} 缺少端口介质。`, entity: ref('port', `${equipment.id}.${port.id}`, readablePort), field: 'medium' });
      }
    });
  });
  project.streams.forEach((stream) => {
    const group = project.lineGroups.find((item) => item.id === stream.groupId);
    const medium = stream.medium || group?.medium || '';
    if (!present(stream.intent)) {
      pushIssue({ level: 'warning', code: 'STREAM_INTENT_PENDING', message: `${stream.tag} 缺少管段工艺意图。`, entity: ref('stream', stream.id, stream.tag), field: 'intent' });
    }
    if (!present(stream.dn)) {
      pushIssue({ level: 'info', code: 'STREAM_DN_PENDING', message: `${stream.tag} 缺少 DN。`, entity: ref('stream', stream.id, stream.tag), field: 'dn' });
    }
    if (!present(stream.pn)) {
      pushIssue({ level: 'info', code: 'STREAM_PN_PENDING', message: `${stream.tag} 缺少 PN。`, entity: ref('stream', stream.id, stream.tag), field: 'pn' });
    }
    (['from', 'to'] as const).forEach((side) => {
      const endpoint = resolveEndpoint(project, stream, side);
      if (endpoint.kind === '设备端口') {
        const equipment = endpoint.equipmentId ? equipmentById.get(endpoint.equipmentId) : undefined;
        const port = equipment?.ports.find((item) => item.id === endpoint.portId);
        if (!equipment || !port) {
          pushIssue({ level: 'error', code: 'STREAM_ENDPOINT_PORT_MISSING', message: `${stream.tag} 的${side === 'from' ? '起点' : '终点'}设备端口不存在。`, entity: ref('stream', stream.id, stream.tag), field: `${side}PortId` });
          return;
        }
        if (!compareMedium(medium, port.medium)) {
          pushIssue({ level: 'warning', code: 'STREAM_PORT_MEDIUM_MISMATCH', message: `${stream.tag} 介质“${medium}”与 ${endpointLabel(endpoint)} 介质“${port.medium}”不一致。`, entity: ref('stream', stream.id, stream.tag), field: 'medium' });
        }
      }
      if (endpoint.kind === '管段接点' && (!endpoint.segmentId || !streamById.has(endpoint.segmentId))) {
        pushIssue({ level: 'error', code: 'STREAM_PIPE_NODE_SEGMENT_MISSING', message: `${stream.tag} 的管段接点缺少有效挂接管段。`, entity: ref('stream', stream.id, stream.tag), field: `${side}SegmentId` });
      }
      if (endpoint.kind === '跨图引用' && !present(endpoint.referenceSheet)) {
        pushIssue({ level: 'warning', code: 'CROSS_SHEET_REFERENCE_PENDING', message: `${stream.tag} 的跨图引用缺少目标分段。`, entity: ref('stream', stream.id, stream.tag), field: `${side}ReferenceSheet` });
      }
    });
  });
  project.inlineComponents.forEach((component) => {
    if (!streamById.has(component.segmentId)) {
      pushIssue({ level: 'error', code: 'INLINE_COMPONENT_STREAM_MISSING', message: `${component.tag} 所在管段不存在。`, entity: ref('inlineComponent', component.id, component.tag), field: 'segmentId' });
    }
    if ((component.type === '控制阀' || component.type === '调节阀' || component.type === '切断阀') && !present(component.controlSignal)) {
      pushIssue({ level: 'warning', code: 'INLINE_COMPONENT_SIGNAL_PENDING', message: `${component.tag} 是${component.type}，但缺少控制信号。`, entity: ref('inlineComponent', component.id, component.tag), field: 'controlSignal' });
    }
  });
  project.controls.forEach((control) => {
    if (!present(control.condition)) {
      pushIssue({ level: 'warning', code: 'CONTROL_CONDITION_PENDING', message: `${control.tag} 缺少触发条件。`, entity: ref('control', control.id, control.tag), field: 'condition' });
    }
    if (!present(control.action)) {
      pushIssue({ level: 'warning', code: 'CONTROL_ACTION_PENDING', message: `${control.tag} 缺少联锁动作。`, entity: ref('control', control.id, control.tag), field: 'action' });
    }
    if (!present(control.purpose)) {
      pushIssue({ level: 'info', code: 'CONTROL_PURPOSE_PENDING', message: `${control.tag} 缺少保护目的。`, entity: ref('control', control.id, control.tag), field: 'purpose' });
    }
  });
  ir.streams.forEach((stream) => {
    if (stream.from.kind === '界外来源' && !present(stream.from.referenceLabel)) {
      pushIssue({ level: 'info', code: 'EXTERNAL_SOURCE_LABEL_PENDING', message: `${stream.tag} 的界外来源描述待补全。`, entity: ref('stream', stream.id, stream.tag), field: 'fromReferenceLabel' });
    }
    if (stream.to.kind === '界外去向' && !present(stream.to.referenceLabel)) {
      pushIssue({ level: 'info', code: 'EXTERNAL_TARGET_LABEL_PENDING', message: `${stream.tag} 的界外去向描述待补全。`, entity: ref('stream', stream.id, stream.tag), field: 'toReferenceLabel' });
    }
  });
  return issues;
};

type PathEdge = {
  to: string;
  streamId: string;
  streamTag: string;
  medium: string;
};

const endpointNodeKey = (endpoint: AgentEndpoint) => {
  if (endpoint.kind === '设备端口' && endpoint.equipmentId) return `equipment:${endpoint.equipmentId}`;
  if (endpoint.kind === '管段接点') return `pipeNode:${endpoint.pipeNodeId || `${endpoint.segmentId || 'unknown'}:${endpoint.segmentRatio ?? 0}`}`;
  if (endpoint.kind === '跨图引用') return `sheet:${endpoint.referenceSheet || endpoint.referenceLabel || 'unknown'}`;
  return `external:${endpoint.referenceLabel || endpoint.kind}`;
};

export const traceAgentFlowPaths = (project: PidSemanticProjectForAgent, ir = projectToAgentSemanticIR(project)) => {
  const pipeNodesBySegment = new Map<string, PipeNode[]>();
  project.pipeNodes.forEach((node) => {
    pipeNodesBySegment.set(node.segmentId, [...(pipeNodesBySegment.get(node.segmentId) || []), node]);
  });
  pipeNodesBySegment.forEach((nodes) => nodes.sort((a, b) => (a.order ?? a.positionRatio) - (b.order ?? b.positionRatio)));

  const adjacency = new Map<string, PathEdge[]>();
  const nodeLabels = new Map<string, string>();
  const addEdge = (from: string, edge: PathEdge, bidirectional: boolean) => {
    adjacency.set(from, [...(adjacency.get(from) || []), edge]);
    if (bidirectional) adjacency.set(edge.to, [...(adjacency.get(edge.to) || []), { ...edge, to: from }]);
  };
  ir.equipments.forEach((equipment) => nodeLabels.set(`equipment:${equipment.id}`, equipmentLabel(equipment)));
  ir.streams.forEach((stream) => {
    const fromKey = endpointNodeKey(stream.from);
    const toKey = endpointNodeKey(stream.to);
    nodeLabels.set(fromKey, endpointLabel(stream.from));
    nodeLabels.set(toKey, endpointLabel(stream.to));
    const routeNodes = [
      fromKey,
      ...(pipeNodesBySegment.get(stream.id) || []).map((node) => {
        const key = `pipeNode:${node.id}`;
        nodeLabels.set(key, node.tag || node.name || node.id);
        return key;
      }),
      toKey,
    ];
    for (let index = 0; index < routeNodes.length - 1; index += 1) {
      addEdge(routeNodes[index], {
        to: routeNodes[index + 1],
        streamId: stream.id,
        streamTag: stream.tag,
        medium: stream.medium || stream.groupName || '',
      }, stream.directionMode !== '单向');
    }
  });

  const equipmentNodeKeys = ir.equipments.map((equipment) => `equipment:${equipment.id}`);
  const paths: AgentFlowPath[] = [];
  const maxDepth = 8;
  const maxPaths = 300;
  equipmentNodeKeys.forEach((startKey) => {
    const stack: Array<{ node: string; streamIds: string[]; streamTags: string[]; mediums: string[]; visitedNodes: Set<string> }> = [{
      node: startKey,
      streamIds: [],
      streamTags: [],
      mediums: [],
      visitedNodes: new Set([startKey]),
    }];
    while (stack.length && paths.length < maxPaths) {
      const current = stack.pop();
      if (!current || current.streamIds.length >= maxDepth) continue;
      (adjacency.get(current.node) || []).forEach((edge) => {
        if (current.visitedNodes.has(edge.to)) return;
        const nextStreamIds = current.streamIds.includes(edge.streamId)
          ? current.streamIds
          : [...current.streamIds, edge.streamId];
        const nextStreamTags = current.streamTags.includes(edge.streamTag)
          ? current.streamTags
          : [...current.streamTags, edge.streamTag];
        const nextMediums = edge.medium ? [...current.mediums, edge.medium] : current.mediums;
        if (edge.to.startsWith('equipment:') && edge.to !== startKey && nextStreamIds.length > 0) {
          const fromEquipmentId = startKey.replace('equipment:', '');
          const toEquipmentId = edge.to.replace('equipment:', '');
          const fromEquipment = ir.equipments.find((equipment) => equipment.id === fromEquipmentId);
          const toEquipment = ir.equipments.find((equipment) => equipment.id === toEquipmentId);
          paths.push({
            id: `path_${String(paths.length + 1).padStart(4, '0')}`,
            fromEquipmentId,
            fromEquipmentTag: fromEquipment?.tag || fromEquipmentId,
            fromEquipmentLabel: equipmentLabel(fromEquipment),
            toEquipmentId,
            toEquipmentTag: toEquipment?.tag || toEquipmentId,
            toEquipmentLabel: equipmentLabel(toEquipment),
            medium: Array.from(new Set(nextMediums)).join(', '),
            streamIds: nextStreamIds,
            streamTags: nextStreamTags,
            nodeLabels: [startKey, edge.to].map((node) => nodeLabels.get(node) || node),
          });
        }
        stack.push({
          node: edge.to,
          streamIds: nextStreamIds,
          streamTags: nextStreamTags,
          mediums: nextMediums,
          visitedNodes: new Set([...current.visitedNodes, edge.to]),
        });
      });
    }
  });
  const unique = new Map<string, AgentFlowPath>();
  paths.forEach((path) => {
    const key = `${path.fromEquipmentId}->${path.toEquipmentId}:${path.streamIds.join('>')}`;
    if (!unique.has(key)) unique.set(key, path);
  });
  return Array.from(unique.values());
};

export const buildAgentIndexes = (project: PidSemanticProjectForAgent, ir = projectToAgentSemanticIR(project)) => {
  const mediumMap = new Map<string, { equipmentIds: Set<string>; streamIds: Set<string>; inlineComponentIds: Set<string> }>();
  const ensureMedium = (medium: string) => {
    const key = mediumKey(medium);
    if (!mediumMap.has(key)) mediumMap.set(key, { equipmentIds: new Set(), streamIds: new Set(), inlineComponentIds: new Set() });
    return mediumMap.get(key);
  };
  ir.equipments.forEach((equipment) => {
    equipment.ports.forEach((port) => ensureMedium(port.medium)?.equipmentIds.add(equipment.id));
  });
  ir.streams.forEach((stream) => ensureMedium(stream.medium || stream.groupName)?.streamIds.add(stream.id));
  project.inlineComponents.forEach((component) => {
    const stream = ir.streams.find((item) => item.id === component.segmentId);
    ensureMedium(stream?.medium || stream?.groupName || '')?.inlineComponentIds.add(component.id);
  });
  const lookup: Record<string, AgentEntityRef[]> = {};
  ir.equipments.forEach((equipment) => {
    const entity = ref('equipment', equipment.id, equipment.tag);
    [equipment.id, equipment.tag, equipment.name, equipment.profile.coreFunction, equipment.systemName].forEach((key) => addLookup(lookup, key || '', entity));
  });
  ir.streams.forEach((stream) => {
    const entity = ref('stream', stream.id, stream.tag);
    [stream.id, stream.tag, stream.name, stream.medium, stream.groupTag, stream.groupName, stream.intent, stream.fromLabel, stream.toLabel, stream.flowDirectionText].forEach((key) => addLookup(lookup, key || '', entity));
  });
  project.systems.forEach((system) => {
    const entity = ref('system', system.id, system.name);
    [system.id, system.name, system.purpose, system.boundaryIn, system.boundaryOut].forEach((key) => addLookup(lookup, key || '', entity));
  });
  project.inlineComponents.forEach((component) => {
    const entity = ref('inlineComponent', component.id, component.tag);
    [component.id, component.tag, component.name, component.type, component.controlSignal].forEach((key) => addLookup(lookup, key || '', entity));
  });
  return {
    equipments: ir.indexes.equipments,
    streams: ir.indexes.streams,
    systems: ir.indexes.systems,
    mediums: Array.from(mediumMap.entries()).map(([medium, value]) => ({
      medium,
      equipmentIds: Array.from(value.equipmentIds),
      streamIds: Array.from(value.streamIds),
      inlineComponentIds: Array.from(value.inlineComponentIds),
    })),
    controls: project.controls.map((control) => ({
      id: control.id,
      tag: control.tag,
      kind: control.kind,
      triggerEquipmentId: control.triggerEquipmentId,
      actionEquipmentId: control.actionEquipmentId,
      purpose: control.purpose,
    })),
    lookup,
  };
};

const readablePartName = (equipment: Pick<Equipment, 'parts'> | undefined, partId: string) => (
  partLabel(equipment, partId) || '未命名组成'
);

const readableEquipmentView = (equipment: AgentSemanticIR['equipments'][number]) => ({
  tag: equipment.tag,
  name: equipment.name,
  type: equipment.type,
  system: equipment.systemName,
  area: equipment.areaName,
  sheet: equipment.sheetName,
  material: equipment.material,
  description: equipment.description,
  coreFunction: equipment.profile.coreFunction || '待补全',
  workingPrinciple: equipment.profile.workingPrinciple || '待补全',
  parts: equipment.parts.map((part) => ({
    category: part.category,
    type: part.type,
    name: part.name,
    phase: part.phase,
    role: part.role,
  })),
  ports: equipment.ports.map((port) => ({
    name: port.name || '未命名连接桩',
    ownerPart: readablePartName(equipment, port.ownerPartId),
    direction: port.direction,
    role: port.role,
    medium: port.medium,
  })),
  internalRelations: equipment.relations.map((relation) => ({
    sourcePart: readablePartName(equipment, relation.sourcePartId),
    relation: relation.relation,
    targetPart: readablePartName(equipment, relation.targetPartId),
    description: relation.description,
  })),
  operatingModes: equipment.profile.operatingModes.map((mode) => ({
    name: mode.name,
    condition: mode.condition,
    description: mode.description,
  })),
  operatingParameters: equipment.profile.operatingParameters.map((parameter) => ({
    name: parameter.name,
    measuredPart: readablePartName(equipment, parameter.measuredPartId),
    normalRange: parameter.normalRange,
    alarmValue: parameter.alarmValue,
    description: parameter.description,
  })),
});

const readableTopologySequence = (sequence: AgentTopologySequenceItem[]) => sequence.map((item, index) => ({
  sequence: index + 1,
  kind: item.kind,
  label: item.label,
  tag: item.tag,
  type: item.type,
  positionRatio: item.positionRatio,
  order: item.order,
  note: item.note,
}));

const readableStreamView = (stream: AgentSemanticIR['streams'][number]) => ({
  tag: stream.tag,
  name: stream.name,
  group: [stream.groupTag, stream.groupName].filter(Boolean).join(' '),
  role: stream.role,
  branchType: stream.branchType,
  directionMode: stream.directionMode,
  medium: stream.medium || stream.groupName,
  from: stream.fromLabel,
  to: stream.toLabel,
  flowDirectionText: stream.flowDirectionText,
  topologySequence: readableTopologySequence(stream.topologySequence),
  dn: stream.dn || '待补全',
  pn: stream.pn || '待补全',
  material: stream.material,
  intent: stream.intent || '待补全',
});

const readableInlineComponentView = (
  component: InlinePipeComponent,
  streamById: Map<string, AgentSemanticIR['streams'][number]>,
) => {
  const stream = streamById.get(component.segmentId);
  return {
    tag: component.tag,
    type: component.type,
    name: component.name,
    stream: stream ? streamReadableLabel(stream, { name: stream.groupName, medium: stream.medium }) : '关联管线',
    positionRatio: component.positionRatio,
    order: component.order ?? component.positionRatio,
    normalState: inlineNormalStateForAgent(component),
    actuator: inlineActuatorForAgent(component),
    controlSignal: component.controlSignal,
    description: component.description,
  };
};

const readablePipeNodeView = (
  node: PipeNode,
  streamById: Map<string, AgentSemanticIR['streams'][number]>,
) => {
  const stream = streamById.get(node.segmentId);
  return {
    tag: node.tag,
    kind: node.kind,
    name: node.name,
    stream: stream ? streamReadableLabel(stream, { name: stream.groupName, medium: stream.medium }) : '关联管线',
    positionRatio: node.positionRatio,
    order: node.order ?? node.positionRatio,
    description: node.description,
  };
};

const readableControlView = (
  control: ControlInterlock,
  equipmentById: Map<string, AgentSemanticIR['equipments'][number]>,
) => {
  const triggerEquipment = equipmentById.get(control.triggerEquipmentId);
  const actionEquipment = equipmentById.get(control.actionEquipmentId);
  return {
    tag: control.tag,
    kind: control.kind,
    scope: control.scope,
    trigger: triggerEquipment ? `${equipmentLabel(triggerEquipment)} / ${readablePartName(triggerEquipment, control.triggerPartId)}` : control.condition,
    condition: control.condition,
    actionTarget: actionEquipment ? `${equipmentLabel(actionEquipment)} / ${readablePartName(actionEquipment, control.actionTargetId)}` : '',
    action: control.action,
    purpose: control.purpose,
    reset: control.reset,
  };
};

const readableRelationView = (relation: AgentRelation) => ({
  type: relation.type,
  source: relation.source.tag || relation.source.id,
  target: relation.target.tag || relation.target.id,
  label: relation.label,
  properties: relation.properties,
});

export const buildAgentReadableSemanticIR = (
  project: PidSemanticProjectForAgent,
  ir = projectToAgentSemanticIR(project),
) => {
  const streamById = new Map(ir.streams.map((stream) => [stream.id, stream]));
  const equipmentById = new Map(ir.equipments.map((equipment) => [equipment.id, equipment]));
  return {
    version: 'pid-agent-readable-semantic/v1',
    generatedAt: ir.generatedAt,
    source: ir.source,
    project: ir.project,
    areas: ir.areas.map((area) => ({
      name: area.name,
      objective: area.objective,
      sheets: area.sheets.map((sheet) => ({ name: sheet.name, description: sheet.description })),
    })),
    systems: ir.systems.map((system) => ({
      name: system.name,
      purpose: system.purpose,
      boundaryIn: system.boundaryIn,
      boundaryOut: system.boundaryOut,
      operationModes: system.operationModes,
      utilityDependency: system.utilityDependency,
      notes: system.notes,
    })),
    sheets: ir.sheets.map((sheet) => ({
      name: sheet.name,
      area: sheet.areaName,
      description: sheet.description,
    })),
    equipments: ir.equipments.map(readableEquipmentView),
    streams: ir.streams.map(readableStreamView),
    pipeNodes: project.pipeNodes.map((node) => readablePipeNodeView(node, streamById)),
    inlineComponents: project.inlineComponents.map((component) => readableInlineComponentView(component, streamById)),
    controls: project.controls.map((control) => readableControlView(control, equipmentById)),
    narratives: ir.narratives.map((item) => ({
      level: item.level,
      subject: item.subject,
      generated: item.generated,
      reviewed: item.reviewed,
    })),
    relations: ir.relations.map(readableRelationView),
    indexes: {
      equipments: ir.indexes.equipments.map((equipment) => ({
        tag: equipment.tag,
        name: equipment.name,
        type: equipment.type,
        system: equipment.systemName,
        coreFunction: equipment.coreFunction || '待补全',
      })),
      streams: ir.indexes.streams.map((stream) => ({
        tag: stream.tag,
        name: stream.name,
        medium: stream.medium,
        from: stream.from,
        to: stream.to,
        topology: stream.topology,
        intent: stream.intent || '待补全',
      })),
      systems: ir.indexes.systems.map((system) => ({
        name: system.name,
        equipments: system.equipmentIds.map((id) => equipmentById.get(id)).filter(Boolean).map((equipment) => equipmentLabel(equipment)),
        streams: system.streamIds.map((id) => streamById.get(id)).filter(Boolean).map((stream) => stream?.tag || '').filter(Boolean),
      })),
    },
  };
};

const readableEquipmentContext = (context: AgentEquipmentContext) => {
  const streamById = new Map(context.connectedStreams.map((stream) => [stream.id, stream]));
  const equipmentById = new Map([
    [context.equipment.id, context.equipment],
    ...context.neighborEquipments.map((equipment) => [equipment.id, equipment] as const),
  ]);
  return {
    version: 'pid-agent-equipment-context-readable/v1',
    generatedAt: context.generatedAt,
    focus: { tag: context.focus.tag, name: context.focus.name },
    system: context.system ? { name: context.system.name, purpose: context.system.purpose } : undefined,
    area: context.area?.name,
    sheet: context.sheet?.name,
    equipment: readableEquipmentView(context.equipment),
    connectedStreams: context.connectedStreams.map(readableStreamView),
    inlineComponents: context.inlineComponents.map((component) => readableInlineComponentView(component, streamById)),
    neighborEquipments: context.neighborEquipments.map(equipmentLabel),
    controls: context.controls.map((control) => readableControlView(control, equipmentById)),
    relations: context.relations.map(readableRelationView),
  };
};

const readableStreamContext = (context: AgentStreamContext) => {
  const streamById = new Map([context.stream, ...context.siblingStreams].map((stream) => [stream.id, stream]));
  const endpointEquipments = [context.endpoints.from, context.endpoints.to].filter(isDefined);
  const equipmentById = new Map(endpointEquipments.map((equipment) => [equipment.id, equipment] as const));
  return {
    version: 'pid-agent-stream-context-readable/v1',
    generatedAt: context.generatedAt,
    focus: { tag: context.focus.tag, medium: context.focus.medium },
    lineGroup: context.lineGroup ? {
      tag: context.lineGroup.tag,
      name: context.lineGroup.name,
      role: context.lineGroup.role,
      medium: context.lineGroup.medium,
      purpose: context.lineGroup.purpose,
    } : undefined,
    sheet: context.sheet?.name,
    stream: readableStreamView(context.stream),
    endpointEquipments: endpointEquipments.map((equipment) => ({
      tag: equipment.tag,
      name: equipment.name,
      coreFunction: equipment.profile.coreFunction || '待补全',
    })),
    siblingStreams: context.siblingStreams.map(readableStreamView),
    inlineComponents: context.inlineComponents.map((component) => readableInlineComponentView(component, streamById)),
    pipeNodes: context.pipeNodes.map((node) => readablePipeNodeView(node, streamById)),
    topologySequence: readableTopologySequence(context.topologySequence),
    controls: context.controls.map((control) => readableControlView(control, equipmentById)),
    relations: context.relations.map(readableRelationView),
  };
};

const readableSystemContext = (context: AgentSystemContext) => {
  const equipmentById = new Map(context.equipments.map((equipment) => [equipment.id, equipment]));
  return {
    version: 'pid-agent-system-context-readable/v1',
    generatedAt: context.generatedAt,
    focus: { name: context.focus.name },
    area: context.area?.name,
    system: {
      name: context.system.name,
      purpose: context.system.purpose || '待补全',
      boundaryIn: context.system.boundaryIn || '待补全',
      boundaryOut: context.system.boundaryOut || '待补全',
      operationModes: context.system.operationModes || '待补全',
      utilityDependency: context.system.utilityDependency || '待补全',
    },
    equipments: context.equipments.map(readableEquipmentView),
    streams: context.streams.map(readableStreamView),
    lineGroups: context.lineGroups.map((group) => ({
      tag: group.tag,
      name: group.name,
      role: group.role,
      medium: group.medium,
      purpose: group.purpose,
    })),
    controls: context.controls.map((control) => readableControlView(control, equipmentById)),
    narratives: context.narratives.map((item) => ({ level: item.level, subject: item.subject, text: item.reviewed || item.generated })),
    relations: context.relations.map(readableRelationView),
  };
};

const internalLookupKeyPattern = /^(eq|line|inline|pipe_node|pipe_group|part|sheet|system|sys|area|ctrl|control)_|^(in|out)\d+$/;

const readableCompleteness = (issues: AgentCompletenessIssue[]) => ({
  summary: issueSummary(issues),
  issues: issues.map((issue) => ({
    level: issue.level,
    code: issue.code,
    object: issue.entity.tag || issue.entity.id,
    field: issue.field,
    message: issue.message,
  })),
});

const readableFlowPaths = (paths: AgentFlowPath[]) => paths.map((path) => ({
  from: path.fromEquipmentLabel || path.fromEquipmentTag,
  to: path.toEquipmentLabel || path.toEquipmentTag,
  medium: path.medium,
  streams: path.streamTags,
  nodes: path.nodeLabels,
}));

const readableIndexFiles = (
  project: PidSemanticProjectForAgent,
  ir: AgentSemanticIR,
  indexes: ReturnType<typeof buildAgentIndexes>,
) => {
  const equipmentById = new Map(ir.equipments.map((equipment) => [equipment.id, equipment]));
  const streamById = new Map(ir.streams.map((stream) => [stream.id, stream]));
  const inlineById = new Map(project.inlineComponents.map((component) => [component.id, component]));
  return {
    equipments: indexes.equipments.map((equipment) => ({
      tag: equipment.tag,
      name: equipment.name,
      type: equipment.type,
      system: equipment.systemName,
      coreFunction: equipment.coreFunction || '待补全',
    })),
    streams: indexes.streams.map((stream) => ({
      tag: stream.tag,
      name: stream.name,
      medium: stream.medium,
      from: stream.from,
      to: stream.to,
      topology: stream.topology,
      intent: stream.intent || '待补全',
    })),
    systems: indexes.systems.map((system) => ({
      name: system.name,
      equipments: system.equipmentIds.map((id) => equipmentById.get(id)).filter(isDefined).map(equipmentLabel),
      streams: system.streamIds.map((id) => streamById.get(id)).filter(isDefined).map((stream) => stream.tag),
    })),
    mediums: indexes.mediums.map((medium) => ({
      medium: medium.medium,
      equipments: medium.equipmentIds.map((id) => equipmentById.get(id)).filter(isDefined).map(equipmentLabel),
      streams: medium.streamIds.map((id) => streamById.get(id)).filter(isDefined).map((stream) => stream.tag),
      inlineComponents: medium.inlineComponentIds.map((id) => inlineById.get(id)).filter(isDefined).map(inlineComponentLabel),
    })),
    controls: project.controls.map((control) => readableControlView(control, equipmentById)),
    lookup: Object.fromEntries(
      Object.entries(indexes.lookup)
        .filter(([key]) => !internalLookupKeyPattern.test(key))
        .map(([key, refs]) => [key, refs.map((item) => ({ kind: item.kind, label: item.tag || item.id }))]),
    ),
  };
};

export const buildAgentPublishPackage = (project: PidSemanticProjectForAgent): AgentPublishPackage => {
  const semanticIR = projectToAgentSemanticIR(project);
  const readableSemanticIR = buildAgentReadableSemanticIR(project, semanticIR);
  const indexes = buildAgentIndexes(project, semanticIR);
  const readableIndexes = readableIndexFiles(project, semanticIR, indexes);
  const issues = buildCompletenessIssues(project, semanticIR);
  const flowPaths = traceAgentFlowPaths(project, semanticIR);
  const readableIssues = readableCompleteness(issues);
  const readablePaths = readableFlowPaths(flowPaths);
  const contexts: AgentPublishPackage['contexts'] = { equipment: {}, stream: {}, system: {} };
  const readableContextPaths = {
    equipment: {} as Record<string, { json: string; markdown: string }>,
    stream: {} as Record<string, { json: string; markdown: string }>,
    system: {} as Record<string, { json: string; markdown: string }>,
  };
  project.equipments.forEach((equipment) => {
    const context = buildEquipmentAgentContext(project, equipment.id);
    if (!context) return;
    const contextKey = equipment.tag || equipment.id;
    contexts.equipment[contextKey] = {
      json: context,
      markdown: renderEquipmentAgentContextMarkdown(context),
    };
    readableContextPaths.equipment[contextKey] = {
      json: `contexts/equipment/${safeFileName(contextKey)}.json`,
      markdown: `contexts/equipment/${safeFileName(contextKey)}.md`,
    };
  });
  project.streams.forEach((stream) => {
    const context = buildStreamAgentContext(project, stream.id);
    if (!context) return;
    const contextKey = stream.tag || stream.id;
    contexts.stream[contextKey] = {
      json: context,
      markdown: renderStreamAgentContextMarkdown(context),
    };
    readableContextPaths.stream[contextKey] = {
      json: `contexts/stream/${safeFileName(contextKey)}.json`,
      markdown: `contexts/stream/${safeFileName(contextKey)}.md`,
    };
  });
  project.systems.forEach((system) => {
    const context = buildSystemAgentContext(project, system.id);
    if (!context) return;
    const contextKey = system.name || system.id;
    contexts.system[contextKey] = {
      json: context,
      markdown: renderSystemAgentContextMarkdown(context),
    };
    readableContextPaths.system[contextKey] = {
      json: `contexts/system/${safeFileName(contextKey)}.json`,
      markdown: `contexts/system/${safeFileName(contextKey)}.md`,
    };
  });

  const files: Record<string, string> = {
    'manifest.json': '',
    'semantic-ir.json': JSON.stringify(readableSemanticIR, null, 2),
    'semantic-ir.full.json': JSON.stringify(semanticIR, null, 2),
    'relations.json': JSON.stringify(readableSemanticIR.relations, null, 2),
    'relations.full.json': JSON.stringify(semanticIR.relations, null, 2),
    'indexes/equipment-index.json': JSON.stringify(readableIndexes.equipments, null, 2),
    'indexes/equipment-index.full.json': JSON.stringify(indexes.equipments, null, 2),
    'indexes/stream-index.json': JSON.stringify(readableIndexes.streams, null, 2),
    'indexes/stream-index.full.json': JSON.stringify(indexes.streams, null, 2),
    'indexes/system-index.json': JSON.stringify(readableIndexes.systems, null, 2),
    'indexes/system-index.full.json': JSON.stringify(indexes.systems, null, 2),
    'indexes/medium-index.json': JSON.stringify(readableIndexes.mediums, null, 2),
    'indexes/medium-index.full.json': JSON.stringify(indexes.mediums, null, 2),
    'indexes/control-index.json': JSON.stringify(readableIndexes.controls, null, 2),
    'indexes/control-index.full.json': JSON.stringify(indexes.controls, null, 2),
    'indexes/lookup.json': JSON.stringify(readableIndexes.lookup, null, 2),
    'indexes/lookup.full.json': JSON.stringify(indexes.lookup, null, 2),
    'completeness.json': JSON.stringify(readableIssues, null, 2),
    'completeness.full.json': JSON.stringify({ summary: issueSummary(issues), issues }, null, 2),
    'completeness.md': '',
    'flow-paths.json': JSON.stringify(readablePaths, null, 2),
    'flow-paths.full.json': JSON.stringify(flowPaths, null, 2),
    'flow-paths.md': '',
  };
  Object.entries(contexts.equipment).forEach(([key, value]) => {
    files[`contexts/equipment/${safeFileName(key)}.json`] = JSON.stringify(readableEquipmentContext(value.json), null, 2);
    files[`contexts/equipment/${safeFileName(key)}.full.json`] = JSON.stringify(value.json, null, 2);
    files[`contexts/equipment/${safeFileName(key)}.md`] = value.markdown;
  });
  Object.entries(contexts.stream).forEach(([key, value]) => {
    files[`contexts/stream/${safeFileName(key)}.json`] = JSON.stringify(readableStreamContext(value.json), null, 2);
    files[`contexts/stream/${safeFileName(key)}.full.json`] = JSON.stringify(value.json, null, 2);
    files[`contexts/stream/${safeFileName(key)}.md`] = value.markdown;
  });
  Object.entries(contexts.system).forEach(([key, value]) => {
    files[`contexts/system/${safeFileName(key)}.json`] = JSON.stringify(readableSystemContext(value.json), null, 2);
    files[`contexts/system/${safeFileName(key)}.full.json`] = JSON.stringify(value.json, null, 2);
    files[`contexts/system/${safeFileName(key)}.md`] = value.markdown;
  });

  const manifest = {
    projectName: project.project.name,
    drawingNo: project.project.drawingNo,
    counts: {
      equipments: semanticIR.equipments.length,
      streams: semanticIR.streams.length,
      systems: semanticIR.systems.length,
      relations: semanticIR.relations.length,
      equipmentContexts: Object.keys(contexts.equipment).length,
      streamContexts: Object.keys(contexts.stream).length,
      systemContexts: Object.keys(contexts.system).length,
      completenessIssues: issues.length,
      flowPaths: flowPaths.length,
    },
    entrypoints: {
      semanticIr: 'semantic-ir.json',
      relations: 'relations.json',
      equipmentIndex: 'indexes/equipment-index.json',
      streamIndex: 'indexes/stream-index.json',
      systemIndex: 'indexes/system-index.json',
      mediumIndex: 'indexes/medium-index.json',
      completeness: 'completeness.json',
      flowPaths: 'flow-paths.json',
    },
  };
  files['manifest.json'] = JSON.stringify(manifest, null, 2);
  files['completeness.md'] = renderCompletenessMarkdown({ summary: issueSummary(issues), issues });
  files['flow-paths.md'] = renderFlowPathsMarkdown(flowPaths);
  files['agent-package.json'] = JSON.stringify({
    version: 'pid-agent-package-readable/v1',
    generatedAt: semanticIR.generatedAt,
    manifest,
    indexes: readableIndexes,
    completeness: readableIssues,
    flowPaths: readablePaths,
    contexts: readableContextPaths,
    fullPrecisionFiles: {
      semanticIr: 'semantic-ir.full.json',
      relations: 'relations.full.json',
      indexes: 'indexes/*.full.json',
      completeness: 'completeness.full.json',
      flowPaths: 'flow-paths.full.json',
      equipmentContexts: 'contexts/equipment/*.full.json',
      streamContexts: 'contexts/stream/*.full.json',
      systemContexts: 'contexts/system/*.full.json',
    },
  }, null, 2);

  return {
    version: 'pid-agent-package/v1',
    generatedAt: semanticIR.generatedAt,
    manifest,
    semanticIR,
    indexes,
    contexts,
    completeness: { summary: issueSummary(issues), issues },
    flowPaths,
    files,
  };
};

export const renderCompletenessMarkdown = (completeness: AgentPublishPackage['completeness']) => {
  const lines: string[] = [];
  lines.push('# 完整性检查');
  lines.push('');
  lines.push(`- 错误：${completeness.summary.error}`);
  lines.push(`- 警告：${completeness.summary.warning}`);
  lines.push(`- 提示：${completeness.summary.info}`);
  lines.push('');
  if (completeness.issues.length === 0) {
    lines.push('- 未发现完整性问题');
    return lines.join('\n');
  }
  lines.push('| 等级 | 代码 | 对象 | 字段 | 说明 |');
  lines.push('| --- | --- | --- | --- | --- |');
  completeness.issues.forEach((issue) => {
    lines.push(tableRow([issue.level, issue.code, issue.entity.tag || issue.entity.id, issue.field, issue.message]));
  });
  return lines.join('\n');
};

export const renderFlowPathsMarkdown = (paths: AgentFlowPath[]) => {
  const lines: string[] = [];
  lines.push('# 路径追踪索引');
  lines.push('');
  if (paths.length === 0) {
    lines.push('- 暂无可追踪的设备到设备路径');
    return lines.join('\n');
  }
  lines.push('| 起点 | 终点 | 介质 | 管线序列 |');
  lines.push('| --- | --- | --- | --- |');
  paths.forEach((path) => {
    lines.push(tableRow([path.fromEquipmentLabel || path.fromEquipmentTag, path.toEquipmentLabel || path.toEquipmentTag, path.medium, path.streamTags.join(' -> ')]));
  });
  return lines.join('\n');
};

export const renderAgentPackageSummaryMarkdown = (agentPackage: AgentPublishPackage) => {
  const lines: string[] = [];
  lines.push('# 智能体发布包');
  lines.push('');
  lines.push(`- 项目：${agentPackage.manifest.projectName}`);
  lines.push(`- 图纸号：${agentPackage.manifest.drawingNo || '-'}`);
  lines.push(`- 生成时间：${agentPackage.generatedAt}`);
  lines.push('');
  lines.push('## 内容计数');
  lines.push(`- 设备：${agentPackage.manifest.counts.equipments}`);
  lines.push(`- 管段：${agentPackage.manifest.counts.streams}`);
  lines.push(`- 系统：${agentPackage.manifest.counts.systems}`);
  lines.push(`- 显式关系：${agentPackage.manifest.counts.relations}`);
  lines.push(`- 设备上下文：${agentPackage.manifest.counts.equipmentContexts}`);
  lines.push(`- 管线上下文：${agentPackage.manifest.counts.streamContexts}`);
  lines.push(`- 系统上下文：${agentPackage.manifest.counts.systemContexts}`);
  lines.push(`- 路径索引：${agentPackage.manifest.counts.flowPaths}`);
  lines.push(`- 完整性问题：${agentPackage.manifest.counts.completenessIssues}`);
  lines.push('');
  lines.push('## 入口文件');
  Object.entries(agentPackage.manifest.entrypoints).forEach(([key, path]) => lines.push(`- ${key}: ${path}`));
  lines.push('');
  lines.push('## 虚拟文件');
  Object.keys(agentPackage.files).slice(0, 80).forEach((path) => lines.push(`- ${path}`));
  if (Object.keys(agentPackage.files).length > 80) lines.push(`- ... 另有 ${Object.keys(agentPackage.files).length - 80} 个文件`);
  return lines.join('\n');
};
