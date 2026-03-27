import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Layout, Button, message, Input, Form, Select, Divider, Typography, Spin, Modal, Tree, Tabs, Tag } from 'antd';
import { Graph, Cell } from '@antv/x6';
import { Stencil } from '@antv/x6-plugin-stencil';
import { Transform } from '@antv/x6-plugin-transform';
import { Selection } from '@antv/x6-plugin-selection';
import { Keyboard } from '@antv/x6-plugin-keyboard';
import { SaveOutlined, DeploymentUnitOutlined, PlusOutlined, SwapOutlined, ReloadOutlined } from '@ant-design/icons';
import driver, { saveDomainIR } from '../../services/neo4j';
import ContextMenu, { type MenuState } from '../Editor/ContextMenu';
import { RELATION_TYPES, type RelationType as DomainRelationType } from '../../domain/relations';
import { validateDomainModel } from '../../domain/validators';
import { decidePublishFromIssues } from '../../domain/publishGate';
import { bucketsFromIssues, type UnifiedIssue } from '../../domain/validation';
import type { DomainModel } from '../../domain/model';
import type { SemanticIR } from '../../domain/ir';

const { Content, Sider } = Layout;
const { Title } = Typography;

type RelationType = typeof RELATION_OPTIONS[number]['value'];

interface OntologyAnalysis {
  typeIds: string[];
  chamberIds: string[];
  portIds: string[];
  relations: string[];
  issues: UnifiedIssue[];
}

interface RelationPickerState {
  visible: boolean;
  edgeId: string;
  sourceType: string;
  targetType: string;
  candidates: RelationType[];
  selected: RelationType;
}

interface OntologyTemplateZone {
  id: string;
  label: string;
  x: number;
  y: number;
}

interface OntologyTemplatePort {
  id: string;
  label: string;
  zoneId: string;
  dir: 'in' | 'out' | 'bi';
  role: 'process' | 'signal' | 'utility' | 'relief';
  side: 'top' | 'right' | 'bottom' | 'left';
}

interface OntologyTemplateRelation {
  sourceId: string;
  targetId: string;
  relType: RelationType;
}

interface OntologyTemplateDef {
  typeId: string;
  label: string;
  zones: OntologyTemplateZone[];
  ports: OntologyTemplatePort[];
  relations: OntologyTemplateRelation[];
}

const RELATION_OPTIONS = [
  { value: RELATION_TYPES.HAS_PORT, label: '🧩 归属端口 (Has Port)' },
  { value: 'HEAT_EXCHANGE', label: '🔥 热交换 (Heat Exchange)' },
  { value: 'FLUID_CONNECT', label: '💧 流体连通 (Fluid Connect)' },
  { value: RELATION_TYPES.FEEDS, label: '➡️ 进料/进入腔室 (Feeds)' },
  { value: RELATION_TYPES.DRAINS, label: '⬅️ 出料/离开腔室 (Drains)' },
  { value: RELATION_TYPES.MEASURES, label: '📏 测量 (Measures)' },
  { value: RELATION_TYPES.CONTROLS, label: '🎛️ 控制 (Controls)' },
  { value: 'DRIVES', label: '⚙️ 驱动/执行 (Drives)' },
  { value: 'TRANSDUCES_TO', label: '⚡ 传感转换 (Transduces)' },
  { value: 'PHYSICAL_LINK', label: '🔗 物理连接 (Physical Link)' },
];

const PORT_DIR_OPTIONS = [
  { value: 'in', label: '入口 (in)' },
  { value: 'out', label: '出口 (out)' },
  { value: 'bi', label: '双向 (bi)' },
];

const PORT_ROLE_OPTIONS = [
  { value: 'process', label: '工艺口 (process)' },
  { value: 'signal', label: '信号口 (signal)' },
  { value: 'utility', label: '公用工程口 (utility)' },
  { value: 'relief', label: '泄放口 (relief)' },
];

const TYPE_ID_OPTIONS = [
  { value: 'Reactor', label: '反应器 (Reactor)' },
  { value: 'FixedBedReactor', label: '固定床反应器 (FixedBedReactor)' },
  { value: 'Exchanger', label: '换热器 (Exchanger)' },
  { value: 'Tank', label: '储罐 (Tank)' },
  { value: 'Separator', label: '分离器 (Separator)' },
  { value: 'Pump', label: '泵 (Pump)' },
  { value: 'Compressor', label: '压缩机 (Compressor)' },
  { value: 'Valve', label: '阀门 (Valve)' },
  { value: 'ControlValve', label: '调节阀 (ControlValve)' },
  { value: 'Instrument', label: '仪表 (Instrument)' },
];

const CHAMBER_ID_OPTIONS = [
  { value: 'ShellSide', label: '壳程 (ShellSide)' },
  { value: 'TubeSide', label: '管程 (TubeSide)' },
  { value: 'InnerVessel', label: '内胆/釜体 (InnerVessel)' },
  { value: 'Jacket', label: '夹套 (Jacket)' },
  { value: 'UpperSaltChannel', label: '上盐环 (UpperSaltChannel)' },
  { value: 'LowerSaltChannel', label: '下盐环 (LowerSaltChannel)' },
  { value: 'Body', label: '本体/阀体 (Body)' },
  { value: 'Actuator', label: '执行机构 (Actuator)' },
  { value: 'ProcessConnection', label: '过程接口 (ProcessConnection)' },
  { value: 'SignalTerminal', label: '信号端子 (SignalTerminal)' },
];

const PORT_ID_OPTIONS = [
  { value: 'inlet', label: '入口 (inlet)' },
  { value: 'outlet', label: '出口 (outlet)' },
  { value: 'vent', label: '放空 (vent)' },
  { value: 'drain', label: '排液 (drain)' },
  { value: 'signal', label: '信号 (signal)' },
];

const ONTOLOGY_TEMPLATE_OPTIONS = [
  { value: 'Reactor', label: '反应器模板 (Reactor)' },
  { value: 'FixedBedReactor', label: '固定床反应器模板 (FixedBedReactor)' },
  { value: 'Exchanger', label: '换热器模板 (Exchanger)' },
  { value: 'Tank', label: '储罐模板 (Tank)' },
  { value: 'Separator', label: '分离器模板 (Separator)' },
];

const ONTOLOGY_TEMPLATES: Record<string, OntologyTemplateDef> = {
  Reactor: {
    typeId: 'Reactor',
    label: '反应器本体',
    zones: [
      { id: 'ReactionZone', label: 'Reaction Zone', x: 360, y: 210 },
      { id: 'Jacket', label: 'Jacket', x: 230, y: 210 },
      { id: 'VaporSpace', label: 'Vapor Space', x: 360, y: 95 },
    ],
    ports: [
      { id: 'feed_in', label: 'Feed In', zoneId: 'ReactionZone', dir: 'in', role: 'process', side: 'left' },
      { id: 'product_out', label: 'Product Out', zoneId: 'ReactionZone', dir: 'out', role: 'process', side: 'right' },
      { id: 'utility_in', label: 'Utility In', zoneId: 'Jacket', dir: 'in', role: 'utility', side: 'left' },
      { id: 'utility_out', label: 'Utility Out', zoneId: 'Jacket', dir: 'out', role: 'utility', side: 'bottom' },
      { id: 'vent', label: 'Vent', zoneId: 'VaporSpace', dir: 'out', role: 'relief', side: 'top' },
    ],
    relations: [
      { sourceId: 'ReactionZone', targetId: 'Jacket', relType: 'HEAT_EXCHANGE' },
      { sourceId: 'feed_in', targetId: 'ReactionZone', relType: RELATION_TYPES.FEEDS },
      { sourceId: 'ReactionZone', targetId: 'product_out', relType: RELATION_TYPES.DRAINS },
      { sourceId: 'utility_in', targetId: 'Jacket', relType: RELATION_TYPES.FEEDS },
      { sourceId: 'Jacket', targetId: 'utility_out', relType: RELATION_TYPES.DRAINS },
      { sourceId: 'VaporSpace', targetId: 'vent', relType: RELATION_TYPES.DRAINS },
    ],
  },
  FixedBedReactor: {
    typeId: 'FixedBedReactor',
    label: '固定床反应器本体',
    zones: [
      { id: 'ReactionZone', label: 'Reaction Zone', x: 360, y: 205 },
      { id: 'SaltBathZone', label: 'Salt Bath Zone', x: 210, y: 205 },
      { id: 'UpperSaltRing', label: 'Upper Salt Ring', x: 210, y: 95 },
      { id: 'LowerSaltRing', label: 'Lower Salt Ring', x: 210, y: 315 },
    ],
    ports: [
      { id: 'gas_in', label: 'Gas In', zoneId: 'ReactionZone', dir: 'in', role: 'process', side: 'left' },
      { id: 'gas_out', label: 'Gas Out', zoneId: 'ReactionZone', dir: 'out', role: 'process', side: 'right' },
      { id: 'salt_in', label: 'Salt In', zoneId: 'UpperSaltRing', dir: 'in', role: 'utility', side: 'top' },
      { id: 'salt_out', label: 'Salt Out', zoneId: 'LowerSaltRing', dir: 'out', role: 'utility', side: 'bottom' },
    ],
    relations: [
      { sourceId: 'UpperSaltRing', targetId: 'SaltBathZone', relType: RELATION_TYPES.FEEDS },
      { sourceId: 'SaltBathZone', targetId: 'LowerSaltRing', relType: RELATION_TYPES.DRAINS },
      { sourceId: 'ReactionZone', targetId: 'SaltBathZone', relType: 'HEAT_EXCHANGE' },
      { sourceId: 'gas_in', targetId: 'ReactionZone', relType: RELATION_TYPES.FEEDS },
      { sourceId: 'ReactionZone', targetId: 'gas_out', relType: RELATION_TYPES.DRAINS },
      { sourceId: 'salt_in', targetId: 'UpperSaltRing', relType: RELATION_TYPES.FEEDS },
      { sourceId: 'LowerSaltRing', targetId: 'salt_out', relType: RELATION_TYPES.DRAINS },
    ],
  },
  Exchanger: {
    typeId: 'Exchanger',
    label: '换热器本体',
    zones: [
      { id: 'ShellSide', label: 'Shell Side', x: 240, y: 210 },
      { id: 'TubeSide', label: 'Tube Side', x: 390, y: 210 },
    ],
    ports: [
      { id: 'shell_in', label: 'Shell In', zoneId: 'ShellSide', dir: 'in', role: 'process', side: 'left' },
      { id: 'shell_out', label: 'Shell Out', zoneId: 'ShellSide', dir: 'out', role: 'process', side: 'bottom' },
      { id: 'tube_in', label: 'Tube In', zoneId: 'TubeSide', dir: 'in', role: 'process', side: 'top' },
      { id: 'tube_out', label: 'Tube Out', zoneId: 'TubeSide', dir: 'out', role: 'process', side: 'right' },
    ],
    relations: [
      { sourceId: 'ShellSide', targetId: 'TubeSide', relType: 'HEAT_EXCHANGE' },
      { sourceId: 'shell_in', targetId: 'ShellSide', relType: RELATION_TYPES.FEEDS },
      { sourceId: 'ShellSide', targetId: 'shell_out', relType: RELATION_TYPES.DRAINS },
      { sourceId: 'tube_in', targetId: 'TubeSide', relType: RELATION_TYPES.FEEDS },
      { sourceId: 'TubeSide', targetId: 'tube_out', relType: RELATION_TYPES.DRAINS },
    ],
  },
  Tank: {
    typeId: 'Tank',
    label: '储罐本体',
    zones: [
      { id: 'LiquidSpace', label: 'Liquid Space', x: 320, y: 240 },
      { id: 'VaporSpace', label: 'Vapor Space', x: 320, y: 110 },
    ],
    ports: [
      { id: 'inlet', label: 'Inlet', zoneId: 'LiquidSpace', dir: 'in', role: 'process', side: 'left' },
      { id: 'outlet', label: 'Outlet', zoneId: 'LiquidSpace', dir: 'out', role: 'process', side: 'bottom' },
      { id: 'vent', label: 'Vent', zoneId: 'VaporSpace', dir: 'out', role: 'relief', side: 'top' },
      { id: 'drain', label: 'Drain', zoneId: 'LiquidSpace', dir: 'out', role: 'process', side: 'right' },
    ],
    relations: [
      { sourceId: 'inlet', targetId: 'LiquidSpace', relType: RELATION_TYPES.FEEDS },
      { sourceId: 'LiquidSpace', targetId: 'outlet', relType: RELATION_TYPES.DRAINS },
      { sourceId: 'LiquidSpace', targetId: 'drain', relType: RELATION_TYPES.DRAINS },
      { sourceId: 'VaporSpace', targetId: 'vent', relType: RELATION_TYPES.DRAINS },
      { sourceId: 'LiquidSpace', targetId: 'VaporSpace', relType: 'FLUID_CONNECT' },
    ],
  },
  Separator: {
    typeId: 'Separator',
    label: '分离器本体',
    zones: [
      { id: 'FeedZone', label: 'Feed Zone', x: 240, y: 205 },
      { id: 'VaporZone', label: 'Vapor Zone', x: 380, y: 120 },
      { id: 'LiquidZone', label: 'Liquid Zone', x: 380, y: 290 },
    ],
    ports: [
      { id: 'feed_in', label: 'Feed In', zoneId: 'FeedZone', dir: 'in', role: 'process', side: 'left' },
      { id: 'gas_out', label: 'Gas Out', zoneId: 'VaporZone', dir: 'out', role: 'process', side: 'top' },
      { id: 'liquid_out', label: 'Liquid Out', zoneId: 'LiquidZone', dir: 'out', role: 'process', side: 'bottom' },
    ],
    relations: [
      { sourceId: 'feed_in', targetId: 'FeedZone', relType: RELATION_TYPES.FEEDS },
      { sourceId: 'FeedZone', targetId: 'VaporZone', relType: RELATION_TYPES.FEEDS },
      { sourceId: 'FeedZone', targetId: 'LiquidZone', relType: RELATION_TYPES.DRAINS },
      { sourceId: 'VaporZone', targetId: 'gas_out', relType: RELATION_TYPES.DRAINS },
      { sourceId: 'LiquidZone', targetId: 'liquid_out', relType: RELATION_TYPES.DRAINS },
    ],
  },
};

const CHAMBER_TO_CHAMBER_RELATIONS: RelationType[] = ['HEAT_EXCHANGE', 'FLUID_CONNECT', 'DRIVES', 'TRANSDUCES_TO', 'PHYSICAL_LINK'];
const PORT_TO_CHAMBER_RELATIONS: RelationType[] = [RELATION_TYPES.FEEDS, RELATION_TYPES.MEASURES, RELATION_TYPES.CONTROLS];
const CHAMBER_TO_PORT_RELATIONS: RelationType[] = [RELATION_TYPES.DRAINS, RELATION_TYPES.HAS_PORT];

const getRelationCandidates = (sourceType?: string, targetType?: string): RelationType[] => {
  if (sourceType === 'MetaChamber' && targetType === 'MetaChamber') return CHAMBER_TO_CHAMBER_RELATIONS;
  if (sourceType === 'MetaPort' && targetType === 'MetaChamber') return PORT_TO_CHAMBER_RELATIONS;
  if (sourceType === 'MetaChamber' && targetType === 'MetaPort') return CHAMBER_TO_PORT_RELATIONS;
  return [];
};

const getRelationLineAttrs = (relType: RelationType) => {
  if (relType === RELATION_TYPES.HAS_PORT) {
    return { stroke: '#94a3b8', strokeWidth: 1.5, strokeDasharray: '5 4', targetMarker: 'classic' };
  }
  if (relType === RELATION_TYPES.FEEDS || relType === RELATION_TYPES.DRAINS || relType === 'FLUID_CONNECT') {
    return { stroke: '#2563eb', strokeWidth: 2.2, targetMarker: 'classic' };
  }
  if (relType === RELATION_TYPES.MEASURES || relType === RELATION_TYPES.CONTROLS) {
    return { stroke: '#7c3aed', strokeWidth: 2, strokeDasharray: '6 4', targetMarker: 'classic' };
  }
  return { stroke: '#595959', strokeWidth: 2, targetMarker: 'classic' };
};

// 1. 注册图形：设备类型容器
Graph.registerNode('meta-type', {
  inherit: 'rect',
  width: 400,
  height: 300,
  attrs: {
    body: { 
      fill: '#f0f5ff', stroke: '#2f54eb', strokeWidth: 2, rx: 8, ry: 8, strokeDasharray: '5 5' 
    },
    label: { 
      text: '设备类型 (Type)', fill: '#2f54eb', fontSize: 14, fontWeight: 'bold', refY: -30 
    }
  },
  zIndex: 1,
  ports: { items: [] },
  data: { type: 'MetaType', name: 'NewType' }
});

// 2. 注册图形：腔室
Graph.registerNode('meta-chamber', {
  inherit: 'circle',
  width: 80, height: 80,
  attrs: {
    body: { fill: '#fff7e6', stroke: '#fa8c16', strokeWidth: 2, cursor: 'move' },
    label: { text: '腔室', fill: '#fa8c16', fontSize: 12 }
  },
  ports: {
    groups: {
      common: {
        position: 'absolute',
        attrs: { circle: { r: 4, magnet: true, stroke: '#fa8c16', strokeWidth: 1, fill: '#fff' } }
      }
    },
    items: [
      { id: 'top', group: 'common', args: { x: '50%', y: 0 } },
      { id: 'right', group: 'common', args: { x: '100%', y: '50%' } },
      { id: 'bottom', group: 'common', args: { x: '50%', y: '100%' } },
      { id: 'left', group: 'common', args: { x: 0, y: '50%' } },
    ]
  },
  zIndex: 10,
  data: { type: 'MetaChamber', name: 'ShellSide' }
});

Graph.registerNode('meta-port', {
  inherit: 'rect',
  width: 72,
  height: 28,
  attrs: {
    body: { fill: '#f6ffed', stroke: '#52c41a', strokeWidth: 1.5, rx: 6, ry: 6, cursor: 'move' },
    label: { text: 'Port', fill: '#389e0d', fontSize: 11, fontWeight: 'bold' }
  },
  zIndex: 20,
  ports: {
    groups: {
      common: {
        position: 'absolute',
        attrs: { circle: { r: 3.5, magnet: true, stroke: '#52c41a', strokeWidth: 1, fill: '#fff' } },
      },
    },
    items: [
      { id: 'top', group: 'common', args: { x: '50%', y: 0 } },
      { id: 'right', group: 'common', args: { x: '100%', y: '50%' } },
      { id: 'bottom', group: 'common', args: { x: '50%', y: '100%' } },
      { id: 'left', group: 'common', args: { x: 0, y: '50%' } },
    ],
  },
  data: { type: 'MetaPort', name: 'inlet', dir: 'in', role: 'process', positionMode: 'anchored' }
});

const OntologyDesigner: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stencilRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);
  
  const [selectedCell, setSelectedCell] = useState<Cell | null>(null);
  const [form] = Form.useForm();
  const [menu, setMenu] = useState<MenuState>({ visible: false, x: 0, y: 0, type: null });
  
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [existingTypes, setExistingTypes] = useState<string[]>([]);
  const [currentType, setCurrentType] = useState<string | null>(null);
  const [structureTreeData, setStructureTreeData] = useState<Array<{ key: string; title: React.ReactNode; children?: Array<{ key: string; title: React.ReactNode; children?: Array<{ key: string; title: React.ReactNode }> }> }>>([]);
  const [leftTab, setLeftTab] = useState<'structure' | 'stencil'>('structure');
  const [relationPicker, setRelationPicker] = useState<RelationPickerState | null>(null);
  const [selectedTemplateType, setSelectedTemplateType] = useState<string>('Reactor');
  const lastPublishedSnapshotRef = useRef<Record<string, unknown> | null>(null);
  const lastPublishedAnalysisRef = useRef<OntologyAnalysis | null>(null);

  const refreshStructureTree = useCallback((graph: Graph) => {
    const typeNodes = graph.getNodes().filter((n) => n.getData()?.type === 'MetaType');
    const tree = typeNodes.map((typeNode) => {
      const typeName = String(typeNode.getData()?.name || typeNode.id);
      const chamberChildren = (typeNode.getChildren() || [])
        .filter((child) => child.isNode() && child.getData()?.type === 'MetaChamber')
        .map((chamberNode) => {
          const chamberName = String(chamberNode.getData()?.name || chamberNode.id);
          const portChildren = (chamberNode.getChildren() || [])
            .filter((child) => child.isNode() && child.getData()?.type === 'MetaPort')
            .map((portNode) => ({
              key: String(portNode.id),
              title: `Port · ${String(portNode.getData()?.name || portNode.id)}`,
            }));
          return {
            key: String(chamberNode.id),
            title: `Zone · ${chamberName}`,
            children: portChildren,
          };
        });
      return {
        key: String(typeNode.id),
        title: (
          <span>
            <Tag color="blue" style={{ marginRight: 8 }}>Type</Tag>
            {typeName}
          </span>
        ),
        children: chamberChildren,
      };
    });
    setStructureTreeData(tree);
  }, []);

  const snapPortToChamberBoundary = useCallback((portNode: Cell) => {
    if (!portNode.isNode()) return;
    const parent = portNode.getParent();
    if (!parent || !parent.isNode() || parent.getData()?.type !== 'MetaChamber') return;
    const mode = String(portNode.getData()?.positionMode || 'anchored');
    if (mode !== 'anchored') return;

    const chamberBBox = parent.getBBox();
    const portSize = portNode.getSize();
    const center = portNode.getBBox().getCenter();
    const leftDist = Math.abs(center.x - chamberBBox.x);
    const rightDist = Math.abs(center.x - (chamberBBox.x + chamberBBox.width));
    const topDist = Math.abs(center.y - chamberBBox.y);
    const bottomDist = Math.abs(center.y - (chamberBBox.y + chamberBBox.height));
    const min = Math.min(leftDist, rightDist, topDist, bottomDist);

    const clamp = (v: number, minV: number, maxV: number) => Math.max(minV, Math.min(maxV, v));
    let x = center.x - portSize.width / 2;
    let y = center.y - portSize.height / 2;

    if (min === leftDist) {
      x = chamberBBox.x - portSize.width / 2;
      y = clamp(y, chamberBBox.y - portSize.height / 2, chamberBBox.y + chamberBBox.height - portSize.height / 2);
    } else if (min === rightDist) {
      x = chamberBBox.x + chamberBBox.width - portSize.width / 2;
      y = clamp(y, chamberBBox.y - portSize.height / 2, chamberBBox.y + chamberBBox.height - portSize.height / 2);
    } else if (min === topDist) {
      y = chamberBBox.y - portSize.height / 2;
      x = clamp(x, chamberBBox.x - portSize.width / 2, chamberBBox.x + chamberBBox.width - portSize.width / 2);
    } else {
      y = chamberBBox.y + chamberBBox.height - portSize.height / 2;
      x = clamp(x, chamberBBox.x - portSize.width / 2, chamberBBox.x + chamberBBox.width - portSize.width / 2);
    }
    portNode.position(x, y, { deep: false });
  }, []);

  const positionPortBySide = useCallback((portNode: Cell, side: OntologyTemplatePort['side']) => {
    if (!portNode.isNode()) return;
    const parent = portNode.getParent();
    if (!parent || !parent.isNode()) return;
    const chamberBBox = parent.getBBox();
    const portSize = portNode.getSize();
    let x = chamberBBox.x + chamberBBox.width / 2 - portSize.width / 2;
    let y = chamberBBox.y + chamberBBox.height / 2 - portSize.height / 2;
    if (side === 'top') y = chamberBBox.y - portSize.height / 2;
    if (side === 'bottom') y = chamberBBox.y + chamberBBox.height - portSize.height / 2;
    if (side === 'left') x = chamberBBox.x - portSize.width / 2;
    if (side === 'right') x = chamberBBox.x + chamberBBox.width - portSize.width / 2;
    portNode.position(x, y, { deep: false });
  }, []);

  const fetchExistingTypes = useCallback(async () => {
    const session = driver.session();
    try {
      const result = await session.run(`MATCH (t:Meta:Type) RETURN t.id as id ORDER BY t.id`);
      const types = result.records.map(r => r.get('id'));
      setExistingTypes(types);
    } catch (e) {
      console.error("Failed to fetch types", e);
    } finally {
      await session.close();
    }
  }, []);

  const mapLegacyRelationToDomain = (raw: string, sourceKind: 'equipment' | 'zone' | 'port' | 'pipe' | 'instrument', targetKind: 'equipment' | 'zone' | 'port' | 'pipe' | 'instrument'): DomainRelationType => {
    if (raw === RELATION_TYPES.HAS_PORT) return RELATION_TYPES.HAS_PORT;
    if (raw === RELATION_TYPES.FEEDS) return RELATION_TYPES.FEEDS;
    if (raw === RELATION_TYPES.DRAINS) return RELATION_TYPES.DRAINS;
    if (raw === RELATION_TYPES.MEASURES) {
      return sourceKind === 'instrument' ? RELATION_TYPES.MEASURES : RELATION_TYPES.CONNECTS_TO;
    }
    if (raw === RELATION_TYPES.CONTROLS) {
      return sourceKind === 'instrument' ? RELATION_TYPES.CONTROLS : RELATION_TYPES.CONNECTS_TO;
    }
    if (sourceKind === 'zone' && targetKind === 'zone') return RELATION_TYPES.CONNECTS_TO;
    return RELATION_TYPES.CONNECTS_TO;
  };

  const applyEdgeStyle = useCallback((edge: Cell, relType: RelationType) => {
    if (!edge.isEdge()) return;
    const lineAttrs = getRelationLineAttrs(relType);
    edge.attr('line/stroke', lineAttrs.stroke);
    edge.attr('line/strokeWidth', lineAttrs.strokeWidth);
    edge.attr('line/strokeDasharray', lineAttrs.strokeDasharray || null);
    edge.attr('line/targetMarker', lineAttrs.targetMarker);
    edge.setLabels([{ attrs: { label: { text: relType, fontSize: 10, fill: lineAttrs.stroke }, body: { fill: '#fff', stroke: '#eee', rx: 4, ry: 4 } } }]);
  }, []);

  const buildDomainModelFromGraph = useCallback((graph: Graph): DomainModel => {
    const nodes = graph.getNodes();
    const edges = graph.getEdges();
    const typeNodes = nodes.filter((node) => node.getData()?.type === 'MetaType');
    const chamberNodes = nodes.filter((node) => node.getData()?.type === 'MetaChamber');
    const portNodes = nodes.filter((node) => node.getData()?.type === 'MetaPort');

    const equipments = typeNodes.map((node) => ({
      id: String(node.getData()?.name || node.id),
      type: String(node.getData()?.name || 'UnknownType'),
      tag: String(node.attr('label/text') || ''),
      name: String(node.attr('label/text') || ''),
      zoneIds: [] as string[],
      portIds: [] as string[],
    }));

    const firstEquipmentId = equipments[0]?.id || 'UnknownType';
    const zones = chamberNodes.map((node) => {
      const parent = node.getParent();
      const equipmentId = parent && parent.getData()?.type === 'MetaType'
        ? String(parent.getData()?.name || parent.id)
        : firstEquipmentId;
      return {
        id: String(node.getData()?.name || node.id),
        equipmentId,
        role: String(node.getData()?.name || 'zone'),
        label: String(node.attr('label/text') || ''),
        phase: 'Any' as const,
        portIds: [] as string[],
      };
    });

    const ports = portNodes.map((node) => {
      const parent = node.getParent();
      const ownerId = parent && parent.getData()?.type === 'MetaChamber'
        ? String(parent.getData()?.name || parent.id)
        : firstEquipmentId;
      const dir = String(node.getData()?.dir || 'bi');
      return {
        id: String(node.getData()?.name || node.id),
        ownerKind: (parent && parent.getData()?.type === 'MetaChamber' ? 'zone' : 'equipment') as 'zone' | 'equipment' | 'instrument',
        ownerId,
        direction: (dir === 'in' || dir === 'out' || dir === 'bi' ? dir : 'bi') as 'in' | 'out' | 'bi',
        role: String(node.getData()?.role || 'process'),
        label: String(node.attr('label/text') || ''),
      };
    });

    zones.forEach((zone) => {
      const equipment = equipments.find((e) => e.id === zone.equipmentId);
      if (equipment) equipment.zoneIds.push(zone.id);
    });
    ports.forEach((port) => {
      if (port.ownerKind === 'zone') {
        const zone = zones.find((z) => z.id === port.ownerId);
        if (zone) zone.portIds.push(port.id);
      }
    });

    const explicitHasPortTargets = new Set(
      edges
        .filter((edge) => {
          const sourceType = edge.getSourceNode()?.getData()?.type;
          const targetType = edge.getTargetNode()?.getData()?.type;
          const relType = String(edge.getData()?.relType || '').trim();
          return sourceType === 'MetaChamber' && targetType === 'MetaPort' && relType === RELATION_TYPES.HAS_PORT;
        })
        .map((edge) => String(edge.getTargetNode()?.getData()?.name || edge.getTargetNode()?.id || '')),
    );

    const relations = [
      ...zones.map((zone) => ({
        id: `rel-has-zone-${zone.equipmentId}-${zone.id}`,
        type: RELATION_TYPES.HAS_ZONE,
        source: { kind: 'equipment' as const, id: zone.equipmentId },
        target: { kind: 'zone' as const, id: zone.id },
      })),
      ...ports
        .filter((port) => !explicitHasPortTargets.has(port.id))
        .map((port) => ({
        id: `rel-has-port-${port.ownerId}-${port.id}`,
        type: RELATION_TYPES.HAS_PORT,
        source: { kind: (port.ownerKind === 'zone' ? 'zone' : port.ownerKind) as 'zone' | 'equipment' | 'instrument', id: port.ownerId },
        target: { kind: 'port' as const, id: port.id },
      })),
      ...edges.map((edge) => {
        const sourceNode = edge.getSourceNode();
        const targetNode = edge.getTargetNode();
        const sourceType = sourceNode?.getData()?.type;
        const targetType = targetNode?.getData()?.type;
        const sourceKind = sourceType === 'MetaPort' ? 'port' : sourceType === 'MetaChamber' ? 'zone' : 'equipment';
        const targetKind = targetType === 'MetaPort' ? 'port' : targetType === 'MetaChamber' ? 'zone' : 'equipment';
        const rawType = String(edge.getData()?.relType || 'CONNECTS_TO');
        return {
          id: `rel-edge-${edge.id}`,
          type: mapLegacyRelationToDomain(rawType, sourceKind, targetKind),
          source: { kind: sourceKind as 'equipment' | 'zone' | 'port' | 'pipe' | 'instrument', id: String(sourceNode?.getData()?.name || sourceNode?.id || '') },
          target: { kind: targetKind as 'equipment' | 'zone' | 'port' | 'pipe' | 'instrument', id: String(targetNode?.getData()?.name || targetNode?.id || '') },
        };
      }),
    ];

    return {
      drawing: {
        id: currentType || 'ontology-draft',
        name: currentType || 'ontology-draft',
        revision: 'v1',
        equipmentIds: equipments.map((e) => e.id),
        instrumentIds: [],
        pipeIds: [],
        relationIds: relations.map((r) => r.id),
      },
      equipments,
      zones,
      ports,
      pipes: [],
      instruments: [],
      relations,
    };
  }, [currentType]);

  const analyzeOntologyGraph = useCallback((graph: Graph): OntologyAnalysis => {
    const allowedRelations = new Set(RELATION_OPTIONS.map((item) => item.value));
    const typeIds: string[] = [];
    const chamberIds: string[] = [];
    const portIds: string[] = [];
    const relations: string[] = [];
    const issues: UnifiedIssue[] = [];
    const pushError = (message: string, entityId?: string) => issues.push({ level: 'error', code: 'ONTOLOGY_VALIDATE', message, entityId, source: 'ontology' });
    const pushWarning = (message: string, entityId?: string) => issues.push({ level: 'warning', code: 'ONTOLOGY_VALIDATE', message, entityId, source: 'ontology' });

    const typeIdSet = new Set<string>();
    const chamberIdSet = new Set<string>();
    const portIdSet = new Set<string>();
    const legalPortDir = new Set(['in', 'out', 'bi']);

    const nodes = graph.getNodes();
    const edges = graph.getEdges();
    const typeNodes = nodes.filter((node) => node.getData()?.type === 'MetaType');
    const chamberNodes = nodes.filter((node) => node.getData()?.type === 'MetaChamber');
    const portNodes = nodes.filter((node) => node.getData()?.type === 'MetaPort');
    const inPorts = new Set<string>();
    const outPorts = new Set<string>();

    if (typeNodes.length === 0) {
      pushError('至少需要一个设备类型节点 (MetaType)。');
    }
    if (chamberNodes.length === 0) {
      pushWarning('当前没有腔室节点，建议补充后再发布。');
    }

    typeNodes.forEach((typeNode) => {
      const typeId = String(typeNode.getData()?.name || '').trim();
      if (!typeId) {
        pushError('存在未填写 name 的设备类型节点。');
        return;
      }
      if (typeIdSet.has(typeId)) {
        pushError(`设备类型 ID 重复: ${typeId}`, typeId);
      } else {
        typeIdSet.add(typeId);
        typeIds.push(typeId);
      }
    });

    chamberNodes.forEach((chamberNode) => {
      const chamberId = String(chamberNode.getData()?.name || '').trim();
      if (!chamberId) {
        pushError('存在未填写 name 的腔室节点。');
        return;
      }
      if (chamberIdSet.has(chamberId)) {
        pushError(`腔室 ID 重复: ${chamberId}`, chamberId);
      } else {
        chamberIdSet.add(chamberId);
        chamberIds.push(chamberId);
      }
      if (!chamberNode.getParent()) {
        pushWarning(`腔室 ${chamberId} 未归属任何设备类型容器。`, chamberId);
      }
    });

    chamberNodes.forEach((chamberNode) => {
      const chamberId = String(chamberNode.getData()?.name || '').trim() || chamberNode.id;
      const chamberPorts = (chamberNode.getChildren() || []).filter((child) => child.isNode() && child.getData()?.type === 'MetaPort');
      if (chamberPorts.length === 0) {
        pushWarning(`腔室 ${chamberId} 没有关联端口。`, chamberId);
      }
    });

    portNodes.forEach((portNode) => {
      const portId = String(portNode.getData()?.name || '').trim();
      if (!portId) {
        pushError('存在未填写 name 的端口节点。');
        return;
      }
      if (portIdSet.has(portId)) {
        pushError(`端口 ID 重复: ${portId}`, portId);
      } else {
        portIdSet.add(portId);
        portIds.push(portId);
      }
      const dir = String(portNode.getData()?.dir || '').trim();
      if (!legalPortDir.has(dir)) {
        pushError(`端口 ${portId} 的方向非法: ${dir || '空'}，仅允许 in/out/bi。`, portId);
      }
      if (dir === 'in' || dir === 'bi') inPorts.add(portId);
      if (dir === 'out' || dir === 'bi') outPorts.add(portId);
      const parent = portNode.getParent();
      if (!parent || parent.getData()?.type !== 'MetaChamber') {
        pushError(`端口 ${portId} 必须归属一个腔室节点。`, portId);
      }
    });

    edges.forEach((edge) => {
      const source = edge.getSourceNode();
      const target = edge.getTargetNode();
      const sourceType = source?.getData()?.type;
      const targetType = target?.getData()?.type;
      const relType = String(edge.getData()?.relType || '').trim();

      if (!source || !target) {
        pushError('存在关系边未连接完整的起点/终点。');
        return;
      }
      if (!relType) {
        pushError('存在关系边未设置关系类型 (relType)。');
        return;
      }
      if (!allowedRelations.has(relType as RelationType)) {
        pushError(`存在不支持的关系类型: ${relType}`);
        return;
      }

      const isChamberToChamber = sourceType === 'MetaChamber' && targetType === 'MetaChamber';
      const isPortToChamber = sourceType === 'MetaPort' && targetType === 'MetaChamber';
      const isChamberToPort = sourceType === 'MetaChamber' && targetType === 'MetaPort';
      const chamberRelation = new Set(['HEAT_EXCHANGE', 'FLUID_CONNECT', 'DRIVES', 'TRANSDUCES_TO', 'PHYSICAL_LINK']);
      const portInRelation = new Set(['FEEDS', 'MEASURES', 'CONTROLS']);

      if (chamberRelation.has(relType) && !isChamberToChamber) {
        pushError(`${relType} 只能连接腔室 -> 腔室。`);
        return;
      }
      if (portInRelation.has(relType) && !isPortToChamber) {
        pushError(`${relType} 只能连接端口 -> 腔室。`);
        return;
      }
      if (relType === RELATION_TYPES.HAS_PORT && !isChamberToPort) {
        pushError(`${relType} 只能连接腔室 -> 端口。`);
        return;
      }
      if (relType === 'DRAINS' && !isChamberToPort) {
        pushError('DRAINS 只能连接腔室 -> 端口。');
        return;
      }

      const srcId = String(source.getData()?.name || source.id);
      const tgtId = String(target.getData()?.name || target.id);
      if (srcId === tgtId) {
        pushWarning(`关系 ${relType} 存在自环: ${srcId} -> ${tgtId}`);
      }
      relations.push(`${srcId}->${tgtId}:${relType}`);
    });

    if (portNodes.length > 0) {
      if (inPorts.size === 0) pushError('至少需要一个入口端口（dir=in 或 bi）。');
      if (outPorts.size === 0) pushError('至少需要一个出口端口（dir=out 或 bi）。');
    }

    const domainModel = buildDomainModelFromGraph(graph);
    const domainResult = validateDomainModel(domainModel);
    domainResult.issues.forEach((issue) => {
      const fullMessage = `[Domain] ${issue.message}`;
      if (issue.level === 'error') {
        pushError(fullMessage, issue.entityId);
      } else {
        pushWarning(fullMessage, issue.entityId);
      }
    });

    return { typeIds, chamberIds, portIds, relations, issues };
  }, [buildDomainModelFromGraph]);

  const summarizeDiff = (prev: OntologyAnalysis | null, next: OntologyAnalysis) => {
    if (!prev) {
      return `首次发布：类型 ${next.typeIds.length}，腔室 ${next.chamberIds.length}，端口 ${next.portIds.length}，关系 ${next.relations.length}`;
    }
    const diffCount = (before: string[], after: string[]) => {
      const beforeSet = new Set(before);
      const afterSet = new Set(after);
      const added = after.filter((item) => !beforeSet.has(item)).length;
      const removed = before.filter((item) => !afterSet.has(item)).length;
      return { added, removed };
    };
    const typeDiff = diffCount(prev.typeIds, next.typeIds);
    const chamberDiff = diffCount(prev.chamberIds, next.chamberIds);
    const portDiff = diffCount(prev.portIds, next.portIds);
    const relationDiff = diffCount(prev.relations, next.relations);
    return [
      `类型: +${typeDiff.added} / -${typeDiff.removed}`,
      `腔室: +${chamberDiff.added} / -${chamberDiff.removed}`,
      `端口: +${portDiff.added} / -${portDiff.removed}`,
      `关系: +${relationDiff.added} / -${relationDiff.removed}`,
    ].join('，');
  };

  useEffect(() => {
    if (!containerRef.current || !stencilRef.current) return;
    stencilRef.current.innerHTML = '';

    const graph = new Graph({
      container: containerRef.current,
      grid: { size: 10, visible: true, type: 'mesh', args: { color: '#eee' } },
      autoResize: true,
      panning: true,
      mousewheel: true,
      connecting: {
        router: 'manhattan',
        connector: { name: 'rounded', args: { radius: 8 } },
        anchor: 'center',
        connectionPoint: 'anchor',
        allowBlank: false,
        snap: true,
        highlight: true,
        validateConnection({ sourceView, targetView, targetMagnet }) {
          if (!sourceView || !targetView) return false;
          if (sourceView === targetView) return false;
          if (!targetMagnet) return false;
          const sourceNode = sourceView.cell;
          const targetNode = targetView.cell;
          const sourceType = sourceNode.getData()?.type;
          const targetType = targetNode.getData()?.type;
          if (targetType === 'MetaType') return false;
          if (sourceType === 'MetaType') return false;
          if (!sourceType || !targetType) return false;
          const supported = new Set(['MetaChamber->MetaChamber', 'MetaPort->MetaChamber', 'MetaChamber->MetaPort']);
          return supported.has(`${sourceType}->${targetType}`);
        },
        createEdge() {
          const relType: RelationType = 'HEAT_EXCHANGE';
          const lineAttrs = getRelationLineAttrs(relType);
          return this.createEdge({
            shape: 'edge',
            attrs: { line: lineAttrs },
            labels: [{ attrs: { label: { text: relType, fontSize: 10, fill: lineAttrs.stroke }, body: { fill: '#fff', stroke: '#eee', rx: 4, ry: 4 } } }],
            data: { type: 'MetaRelation', relType }
          });
        }
      },
      embedding: {
        enabled: true,
        findParent({ node }) {
          const bbox = node.getBBox();
          return this.getNodes().filter((n) => {
            const data = n.getData();
            return data && (data.type === 'MetaType' || data.type === 'MetaChamber') && n.getBBox().containsRect(bbox);
          });
        },
      },
      highlighting: { embedding: { name: 'stroke', args: { padding: -1, attrs: { stroke: '#73d13d' } } } },
    });

    graphRef.current = graph;

    graph.use(new Transform({ resizing: true }));
    graph.use(new Selection({ enabled: true, showNodeSelectionBox: true }));
    graph.use(new Keyboard({ enabled: true }));

    graph.bindKey('backspace', () => { const cells = graph.getSelectedCells(); if (cells.length) graph.removeCells(cells); });
    graph.on('cell:click', ({ cell }) => {
      setSelectedCell(cell);
      const data = cell.getData() || {};
      const label = cell.isNode() ? cell.attr('label/text') : data.relType;
      form.setFieldsValue({ ...data, label });
    });
    graph.on('blank:click', () => { setSelectedCell(null); });
    graph.on('edge:connected', ({ edge }) => {
      const sourceType = edge.getSourceNode()?.getData()?.type;
      const targetType = edge.getTargetNode()?.getData()?.type;
      const candidates = getRelationCandidates(sourceType, targetType);
      const relType = (candidates[0] || 'HEAT_EXCHANGE') as RelationType;
      edge.setData({ ...(edge.getData() || {}), type: 'MetaRelation', relType });
      applyEdgeStyle(edge, relType);
      if (candidates.length > 1) {
        setRelationPicker({
          visible: true,
          edgeId: edge.id,
          sourceType: String(sourceType || ''),
          targetType: String(targetType || ''),
          candidates,
          selected: relType,
        });
      }
    });
    graph.on('node:change:position', ({ node }) => {
      if (node.getData()?.type === 'MetaPort') {
        snapPortToChamberBoundary(node);
      }
    });
    graph.on('node:added', () => refreshStructureTree(graph));
    graph.on('node:removed', () => refreshStructureTree(graph));
    graph.on('node:change:data', () => refreshStructureTree(graph));
    graph.on('cell:change:children', () => refreshStructureTree(graph));
    graph.on('edge:added', () => refreshStructureTree(graph));
    graph.on('edge:removed', () => refreshStructureTree(graph));
    graph.on('cell:contextmenu', ({ e, cell }) => { setMenu({ visible: true, x: e.clientX, y: e.clientY, type: cell.isNode() ? 'node' : 'edge', cellId: cell.id }); });
    graph.on('blank:contextmenu', ({ e }) => { setMenu({ visible: true, x: e.clientX, y: e.clientY, type: 'blank' }); });

    // Stencil
    const stencil = new Stencil({
      title: '组件库', target: graph, stencilGraphWidth: 200, stencilGraphHeight: 0, collapsable: false,
      groups: [{ title: '基础元素', name: 'basic' }],
      layoutOptions: { columns: 1, columnWidth: 180, rowHeight: 80, dx: 10, dy: 10 },
      getDropNode(node) {
        const clone = node.clone();
        const shape = clone.shape;
        if (shape === 'meta-chamber') {
          clone.setSize(80, 80);
          clone.attr('label/fontSize', 12);
        } else if (shape === 'meta-port') {
          clone.setSize(72, 28);
          clone.attr('label/fontSize', 10);
          clone.setData({ type: 'MetaPort', name: `port_${Date.now()}`, dir: 'in', role: 'process', positionMode: 'anchored' });
        } else if (shape === 'meta-type') {
          // [新增] 恢复容器尺寸
          clone.setSize(300, 200);
          clone.attr('label/fontSize', 14);
          // 确保新拖入的容器有唯一的 ID，避免冲突
          const newId = `NewType_${Date.now()}`;
          clone.setData({ type: 'MetaType', name: newId });
          clone.attr('label/text', newId);
        }
        return clone;
      }
    });
    stencilRef.current.appendChild(stencil.container);
    // [新增] 创建 Type 节点图标 (小尺寸)
    const typeNode = graph.createNode({
      shape: 'meta-type',
      label: '设备类型 (容器)',
      width: 160,
      height: 60,
      attrs: { label: { fontSize: 10 } }
    });
    const chamberNode = graph.createNode({ shape: 'meta-chamber', label: '腔室 (Chamber)', width: 50, height: 50, attrs: { label: { fontSize: 10 } } });
    const portNode = graph.createNode({ shape: 'meta-port', label: '端口 (Port)', width: 72, height: 28, attrs: { label: { fontSize: 10 } } });
    stencil.load([typeNode, chamberNode, portNode], 'basic');

    fetchExistingTypes();
    refreshStructureTree(graph);

    const stencilEl = stencilRef.current;
    return () => {
      graph.dispose();
      if (stencilEl) stencilEl.innerHTML = '';
    };
  }, [applyEdgeStyle, fetchExistingTypes, form, refreshStructureTree, snapPortToChamberBoundary]);

  const loadOntologyData = useCallback(async (typeId: string) => {
    if (!graphRef.current) return;
    setLoading(true);
    const graph = graphRef.current;
    graph.clearCells();

    const session = driver.session();
    try {
      // 1. 加载 Type 节点
      const typeRes = await session.run(
        `MATCH (t:Meta:Type {id: $typeId}) RETURN t`, 
        { typeId }
      );
      
      if (typeRes.records.length === 0) {
        const defaultNode = graph.createNode({
          shape: 'meta-type', x: 200, y: 100, 
          attrs: { label: { text: typeId } },
          data: { type: 'MetaType', name: typeId }
        });
        graph.addNode(defaultNode);
      } else {
        const tProps = typeRes.records[0].get('t').properties;
        const typeLabel = tProps.label || tProps.name || typeId;

        const typeNode = graph.createNode({
          shape: 'meta-type',
          x: tProps.x || 200, 
          y: tProps.y || 100,
          width: tProps.w || 400, 
          height: tProps.h || 300,
          attrs: { label: { text: typeLabel } },
          data: { type: 'MetaType', name: typeId }
        });
        graph.addNode(typeNode);

        // 2. 加载 Chamber 节点
        const chamberRes = await session.run(`
          MATCH (t:Meta:Type {id: $typeId})-[:HAS_CHAMBER]->(c:Meta:Chamber)
          RETURN c
        `, { typeId });

        const chambers = chamberRes.records.map(r => {
          const props = r.get('c').properties;
          const x = props.x || (typeNode.getPosition().x + 50);
          const y = props.y || (typeNode.getPosition().y + 50);
          const chamberLabel = props.label || props.name || props.id;
          
          const node = graph.createNode({
            shape: 'meta-chamber',
            x, y,
            width: props.w || 80,
            height: props.h || 80,
            attrs: { label: { text: chamberLabel } },
            data: { type: 'MetaChamber', name: props.id }
          });
          typeNode.addChild(node);
          return node;
        });
        graph.addNode(chambers);

        const portRes = await session.run(`
          MATCH (t:Meta:Type {id: $typeId})-[:HAS_CHAMBER]->(c:Meta:Chamber)-[:HAS_PORT]->(p:Meta:Port)
          RETURN c.id as chamberId, p
        `, { typeId });

        const chamberById = new Map<string, Cell>();
        chambers.forEach((chamber) => {
          chamberById.set(String(chamber.getData()?.name || ''), chamber);
        });

        const ports = portRes.records.map((r) => {
          const chamberId = String(r.get('chamberId'));
          const props = r.get('p').properties;
          const portNode = graph.createNode({
            shape: 'meta-port',
            x: props.x || 0,
            y: props.y || 0,
            width: props.w || 72,
            height: props.h || 28,
            attrs: { label: { text: props.label || props.id || 'Port' } },
            data: { type: 'MetaPort', name: props.id, dir: props.dir || 'bi', role: props.role || 'process', positionMode: props.positionMode || 'anchored' }
          });
          const parentChamber = chamberById.get(chamberId);
          if (parentChamber && parentChamber.isNode()) {
            parentChamber.addChild(portNode);
          }
          return portNode;
        });
        if (ports.length > 0) graph.addNode(ports);

        // 3. 加载关系
        const relRes = await session.run(`
          MATCH (t:Meta:Type {id: $typeId})
          OPTIONAL MATCH (t)-[:HAS_CHAMBER]->(s:Meta:Chamber)-[r]->(e:Meta:Chamber)
          WHERE type(r) IN ['HEAT_EXCHANGE', 'FLUID_CONNECT', 'DRIVES', 'TRANSDUCES_TO', 'PHYSICAL_LINK']
          RETURN s.id as source, e.id as target, type(r) as relType, r.sourcePort as sourcePort, r.targetPort as targetPort
          UNION
          MATCH (t:Meta:Type {id: $typeId})-[:HAS_CHAMBER]->(:Meta:Chamber)-[:HAS_PORT]->(s:Meta:Port)-[r]->(e:Meta:Chamber)
          WHERE type(r) IN ['FEEDS', 'MEASURES', 'CONTROLS']
          RETURN s.id as source, e.id as target, type(r) as relType, '' as sourcePort, '' as targetPort
          UNION
          MATCH (t:Meta:Type {id: $typeId})-[:HAS_CHAMBER]->(s:Meta:Chamber)-[r]->(e:Meta:Port)<-[:HAS_PORT]-(:Meta:Chamber)<-[:HAS_CHAMBER]-(t)
          WHERE type(r) IN ['DRAINS']
          RETURN s.id as source, e.id as target, type(r) as relType, '' as sourcePort, '' as targetPort
          UNION
          MATCH (t:Meta:Type {id: $typeId})-[:HAS_CHAMBER]->(s:Meta:Chamber)-[r:HAS_PORT]->(e:Meta:Port)<-[:HAS_PORT]-(:Meta:Chamber)<-[:HAS_CHAMBER]-(t)
          WHERE coalesce(r.explicit, false) = true
          RETURN s.id as source, e.id as target, type(r) as relType, '' as sourcePort, '' as targetPort
        `, { typeId });

        const nodeByName = new Map<string, Cell>();
        chambers.forEach((node) => nodeByName.set(String(node.getData()?.name || ''), node));
        ports.forEach((node) => nodeByName.set(String(node.getData()?.name || ''), node));

        relRes.records.forEach(r => {
          const sourceId = String(r.get('source') || '');
          const targetId = String(r.get('target') || '');
          const relType = String(r.get('relType') || '');
          const sourcePort = String(r.get('sourcePort') || '');
          const targetPort = String(r.get('targetPort') || '');
          if (!sourceId || !targetId || !relType) return;

          const sourceNode = nodeByName.get(sourceId);
          const targetNode = nodeByName.get(targetId);

          if (sourceNode && targetNode) {
            const lineAttrs = getRelationLineAttrs(relType as RelationType);
            const edge = graph.addEdge({
              shape: 'edge',
              source: { cell: sourceNode, port: sourcePort || undefined },
              target: { cell: targetNode, port: targetPort || undefined },
              attrs: { line: lineAttrs },
              labels: [{ attrs: { label: { text: relType, fill: lineAttrs.stroke }, body: { fill: '#fff', stroke: '#eee', rx: 4, ry: 4 } } }],
              data: { type: 'MetaRelation', relType: relType }
            });
            applyEdgeStyle(edge, relType as RelationType);
          }
        });
      }
      graph.centerContent();
      const snapshot = graph.toJSON() as unknown as Record<string, unknown>;
      const analysis = analyzeOntologyGraph(graph);
      lastPublishedSnapshotRef.current = snapshot;
      lastPublishedAnalysisRef.current = analysis;
      setCurrentType(typeId);
      if (ONTOLOGY_TEMPLATES[typeId]) {
        setSelectedTemplateType(typeId);
      }
      refreshStructureTree(graph);
    } catch (e) {
      console.error(e);
      message.error('加载失败');
    } finally {
      setLoading(false);
      await session.close();
    }
  }, [analyzeOntologyGraph, applyEdgeStyle, refreshStructureTree]);

  const handleFormChange = (_changedValues: Record<string, unknown>, allValues: Record<string, unknown>) => {
    if (!selectedCell) return;
    selectedCell.setData({ ...selectedCell.getData(), ...allValues });
    if (selectedCell.isNode()) {
      if (typeof allValues.label === 'string') {
        selectedCell.attr('label/text', allValues.label);
      }
      if (selectedCell.getData()?.type === 'MetaPort') {
        snapPortToChamberBoundary(selectedCell);
      }
      if (graphRef.current) refreshStructureTree(graphRef.current);
    } else if (selectedCell.isEdge()) {
      if (typeof allValues.relType === 'string') {
        applyEdgeStyle(selectedCell, allValues.relType as RelationType);
      }
    }
  };

  const handleMenuAction = (action: string) => {
    const graph = graphRef.current;
    if (!graph) return;
    switch (action) {
      case 'delete': {
        const cells = graph.getSelectedCells();
        if (cells.length > 0) graph.removeCells(cells);
        else if (menu.cellId) graph.removeCell(menu.cellId);
        setSelectedCell(null);
        break;
      }
      case 'clear': graph.clearCells(); break;
      case 'fit': graph.zoomToFit({ padding: 20 }); break;
    }
    setMenu({ ...menu, visible: false });
  };

  const handleApplyRelationPicker = () => {
    if (!relationPicker || !graphRef.current) return;
    const edge = graphRef.current.getCellById(relationPicker.edgeId);
    if (!edge || !edge.isEdge()) {
      setRelationPicker(null);
      return;
    }
    edge.setData({ ...(edge.getData() || {}), type: 'MetaRelation', relType: relationPicker.selected });
    applyEdgeStyle(edge, relationPicker.selected);
    setRelationPicker(null);
  };

  const handleStructureSelect = (keys: React.Key[]) => {
    if (!graphRef.current || keys.length === 0) return;
    const id = String(keys[0]);
    const cell = graphRef.current.getCellById(id);
    if (!cell) return;
    graphRef.current.cleanSelection();
    graphRef.current.select(cell);
    if (cell.isNode()) {
      graphRef.current.centerCell(cell);
    }
    setSelectedCell(cell);
    const data = cell.getData() || {};
    const label = cell.isNode() ? cell.attr('label/text') : data.relType;
    form.setFieldsValue({ ...data, label });
  };

  const addChamberToCanvas = () => {
    if (!graphRef.current) return;
    const graph = graphRef.current;
    const container = graph.getNodes().find(n => n.getData()?.type === 'MetaType');
    if (!container) { message.error('请先选择或创建一个设备类型'); return; }
    const containerPos = container.getPosition();
    const offset = (container.getChildren()?.length || 0) * 20 + 40;
    const node = graph.createNode({
      shape: 'meta-chamber', x: containerPos.x + offset, y: containerPos.y + offset + 40,
      label: '新腔室', data: { type: 'MetaChamber', name: 'NewChamber' }
    });
    container.addChild(node);
    if (!graph.hasCell(node)) { graph.addNode(node); }
    refreshStructureTree(graph);
    message.info('已添加 Zone。下一步建议为该 Zone 添加 Port。');
  };

  const addPortToCanvas = () => {
    if (!graphRef.current) return;
    const graph = graphRef.current;
    const selected = graph.getSelectedCells().find((c) => c.isNode() && c.getData()?.type === 'MetaChamber');
    const chamber = selected?.isNode()
      ? selected
      : graph.getNodes().find((n) => n.getData()?.type === 'MetaChamber');
    if (!chamber || !chamber.isNode()) {
      message.error('请先选中一个腔室，再添加端口');
      return;
    }
    const chamberPos = chamber.getPosition();
    const chamberSize = chamber.getSize();
    const count = chamber.getChildren()?.filter((child) => child.isNode() && child.getData()?.type === 'MetaPort').length || 0;
    const side = count % 4;
    const pad = 14 + Math.floor(count / 4) * 8;
    let x = chamberPos.x + chamberSize.width / 2 - 36;
    let y = chamberPos.y + chamberSize.height / 2 - 14;
    if (side === 0) {
      x = chamberPos.x + chamberSize.width / 2 - 36;
      y = chamberPos.y - 14;
    } else if (side === 1) {
      x = chamberPos.x + chamberSize.width - 36;
      y = chamberPos.y + chamberSize.height / 2 - 14;
    } else if (side === 2) {
      x = chamberPos.x + chamberSize.width / 2 - 36;
      y = chamberPos.y + chamberSize.height - 14;
    } else {
      x = chamberPos.x - 36;
      y = chamberPos.y + chamberSize.height / 2 - 14;
    }
    if (side === 0 || side === 2) x += pad;
    if (side === 1 || side === 3) y += pad;
    const node = graph.createNode({
      shape: 'meta-port',
      x,
      y,
      label: '入口',
      data: { type: 'MetaPort', name: `inlet_${Date.now()}`, dir: 'in', role: 'process', positionMode: 'anchored' }
    });
    chamber.addChild(node);
    if (!graph.hasCell(node)) {
      graph.addNode(node);
    }
    snapPortToChamberBoundary(node);
    refreshStructureTree(graph);
    message.info('已添加 Port。可在右侧设置方向 in/out/bi。');
  };

  const applyOntologyTemplate = useCallback((templateType: string) => {
    if (!graphRef.current) return;
    const graph = graphRef.current;
    const template = ONTOLOGY_TEMPLATES[templateType];
    if (!template) {
      message.error(`未找到模板: ${templateType}`);
      return;
    }

    const doApply = () => {
      graph.clearCells();
      const typeNode = graph.createNode({
        shape: 'meta-type',
        x: 120,
        y: 40,
        width: 540,
        height: 420,
        attrs: { label: { text: template.typeId } },
        data: { type: 'MetaType', name: template.typeId },
      });
      graph.addNode(typeNode);

      const zoneById = new Map<string, Cell>();
      template.zones.forEach((zone) => {
        const zoneNode = graph.createNode({
          shape: 'meta-chamber',
          x: zone.x,
          y: zone.y,
          width: 88,
          height: 88,
          attrs: { label: { text: zone.label } },
          data: { type: 'MetaChamber', name: zone.id },
        });
        typeNode.addChild(zoneNode);
        graph.addNode(zoneNode);
        zoneById.set(zone.id, zoneNode);
      });

      const portById = new Map<string, Cell>();
      template.ports.forEach((port) => {
        const zoneNode = zoneById.get(port.zoneId);
        if (!zoneNode || !zoneNode.isNode()) return;
        const portNode = graph.createNode({
          shape: 'meta-port',
          width: 72,
          height: 28,
          attrs: { label: { text: port.label } },
          data: { type: 'MetaPort', name: port.id, dir: port.dir, role: port.role, positionMode: 'anchored' },
        });
        zoneNode.addChild(portNode);
        graph.addNode(portNode);
        positionPortBySide(portNode, port.side);
        portById.set(port.id, portNode);
      });

      template.relations.forEach((rel) => {
        const source = zoneById.get(rel.sourceId) || portById.get(rel.sourceId);
        const target = zoneById.get(rel.targetId) || portById.get(rel.targetId);
        if (!source || !target) return;
        const edge = graph.addEdge({
          shape: 'edge',
          source: { cell: source.id },
          target: { cell: target.id },
          data: { type: 'MetaRelation', relType: rel.relType },
        });
        applyEdgeStyle(edge, rel.relType);
      });

      graph.centerContent();
      refreshStructureTree(graph);
      setCurrentType(template.typeId);
      setSelectedCell(null);
      lastPublishedSnapshotRef.current = null;
      lastPublishedAnalysisRef.current = null;
      message.success(`已应用模板：${template.label}`);
    };

    if (graph.getCells().length > 0) {
      Modal.confirm({
        title: '应用模板',
        content: `应用 ${template.label} 会覆盖当前画布内容，是否继续？`,
        okText: '应用',
        cancelText: '取消',
        onOk: doApply,
      });
      return;
    }
    doApply();
  }, [applyEdgeStyle, positionPortBySide, refreshStructureTree]);

  const persistOntology = async (graph: Graph) => {
    const nodes = graph.getNodes();
    const edges = graph.getEdges();
    const typeNodes = nodes.filter(n => n.getData()?.type === 'MetaType');
    if (typeNodes.length === 0) {
      throw new Error('画布为空');
    }
    const session = driver.session();
    const tx = session.beginTransaction();
    try {
      const explicitHasPortPairs: Array<{ chamberId: string; portId: string }> = [];
      const explicitHasPortTargetIds = new Set<string>();
      const fallbackHasPortByPort = new Map<string, string>();

      for (const edge of edges) {
        const source = edge.getSourceNode();
        const target = edge.getTargetNode();
        const sourceType = source?.getData()?.type;
        const targetType = target?.getData()?.type;
        const relType = String(edge.getData()?.relType || '').trim();
        if (sourceType === 'MetaChamber' && targetType === 'MetaPort' && relType === RELATION_TYPES.HAS_PORT) {
          const chamberId = String(source?.getData()?.name || '');
          const portId = String(target?.getData()?.name || '');
          if (chamberId && portId) {
            explicitHasPortPairs.push({ chamberId, portId });
            explicitHasPortTargetIds.add(portId);
          }
        }
      }

      for (const typeNode of typeNodes) {
        const typeData = typeNode.getData();
        const typeId = typeData.name || 'UnknownType';
        const typeLabel = typeNode.attr('label/text');
        const pos = typeNode.getPosition();
        const size = typeNode.getSize();

        await tx.run(`
          MERGE (t:Meta:Type {id: $id})
          SET t.name = $name, t.label = $label, t.x = $x, t.y = $y, t.w = $w, t.h = $h
          MERGE (c:Meta:Concept {id: 'Equipment'})
          MERGE (t)-[:IS_A]->(c)
        `, { id: typeId, name: typeId, label: typeLabel, x: pos.x, y: pos.y, w: size.width, h: size.height });

        const children = typeNode.getChildren();
        if (children) {
          for (const child of children) {
            if (child.isNode() && child.getData()?.type === 'MetaChamber') {
              const chamberId = child.getData().name;
              const chamberLabel = child.attr('label/text');
              const cPos = child.getPosition();
              const cSize = child.getSize();

              await tx.run(`
                MERGE (c:Meta:Chamber {id: $id})
                SET c.name = $name, c.label = $label, c.x = $x, c.y = $y, c.w = $w, c.h = $h
              `, { id: chamberId, name: chamberId, label: chamberLabel, x: cPos.x, y: cPos.y, w: cSize.width, h: cSize.height });

              await tx.run(`
                MATCH (t:Meta:Type {id: $typeId}), (c:Meta:Chamber {id: $chamberId})
                MERGE (t)-[:HAS_CHAMBER]->(c)
              `, { typeId, chamberId });

              const portChildren = child.getChildren();
              if (portChildren) {
                for (const portChild of portChildren) {
                  if (portChild.isNode() && portChild.getData()?.type === 'MetaPort') {
                    const portData = portChild.getData();
                    const portId = portData.name;
                    const portLabel = portChild.attr('label/text');
                    const pPos = portChild.getPosition();
                    const pSize = portChild.getSize();
                    await tx.run(`
                      MERGE (p:Meta:Port {id: $id})
                      SET p.name = $name, p.label = $label, p.dir = $dir, p.role = $role, p.positionMode = $positionMode, p.x = $x, p.y = $y, p.w = $w, p.h = $h
                    `, {
                      id: portId,
                      name: portId,
                      label: portLabel,
                      dir: String(portData.dir || 'bi'),
                      role: String(portData.role || 'process'),
                      positionMode: String(portData.positionMode || 'anchored'),
                      x: pPos.x,
                      y: pPos.y,
                      w: pSize.width,
                      h: pSize.height
                    });
                    fallbackHasPortByPort.set(String(portId), String(chamberId));
                  }
                }
              }
            }
          }
        }
      }
      
      for (const edge of edges) {
        const source = edge.getSourceNode();
        const target = edge.getTargetNode();
        const relType = edge.getData()?.relType || 'RELATED_TO';
        const sourcePortId = edge.getSourcePortId();
        const targetPortId = edge.getTargetPortId();

        const sourceType = source?.getData()?.type;
        const targetType = target?.getData()?.type;
        if (!source || !target) continue;
        if (sourceType === 'MetaChamber' && targetType === 'MetaChamber') {
          const srcId = source.getData().name;
          const tgtId = target.getData().name;
          await tx.run(`
            MATCH (s:Meta:Chamber {id: $srcId}), (t:Meta:Chamber {id: $tgtId})
            MERGE (s)-[r:${relType}]->(t)
            SET r.sourcePort = $sourcePort, r.targetPort = $targetPort
          `, { srcId, tgtId, sourcePort: sourcePortId || '', targetPort: targetPortId || '' });
        } else if (sourceType === 'MetaPort' && targetType === 'MetaChamber') {
          const srcId = source.getData().name;
          const tgtId = target.getData().name;
          await tx.run(`
            MATCH (s:Meta:Port {id: $srcId}), (t:Meta:Chamber {id: $tgtId})
            MERGE (s)-[r:${relType}]->(t)
          `, { srcId, tgtId });
        } else if (sourceType === 'MetaChamber' && targetType === 'MetaPort') {
          const srcId = source.getData().name;
          const tgtId = target.getData().name;
          if (String(relType) === RELATION_TYPES.HAS_PORT) {
            await tx.run(`
              MATCH (s:Meta:Chamber {id: $srcId}), (t:Meta:Port {id: $tgtId})
              MERGE (s)-[r:HAS_PORT]->(t)
              SET r.explicit = true
            `, { srcId, tgtId });
          } else {
            await tx.run(`
              MATCH (s:Meta:Chamber {id: $srcId}), (t:Meta:Port {id: $tgtId})
              MERGE (s)-[r:${relType}]->(t)
            `, { srcId, tgtId });
          }
        }
      }

      for (const { chamberId, portId } of explicitHasPortPairs) {
        await tx.run(`
          MATCH (s:Meta:Chamber {id: $chamberId}), (t:Meta:Port {id: $portId})
          MERGE (s)-[r:HAS_PORT]->(t)
          SET r.explicit = true
        `, { chamberId, portId });
      }

      for (const [portId, chamberId] of fallbackHasPortByPort.entries()) {
        if (explicitHasPortTargetIds.has(portId)) continue;
        await tx.run(`
          MATCH (s:Meta:Chamber {id: $chamberId}), (t:Meta:Port {id: $portId})
          MERGE (s)-[r:HAS_PORT]->(t)
          SET r.explicit = coalesce(r.explicit, false)
        `, { chamberId, portId });
      }
      await tx.commit();
      await fetchExistingTypes();
    } catch (e) {
      await tx.rollback();
      throw e;
    } finally {
      await session.close();
    }
  };

  const handlePublishWithValidation = async () => {
    if (!graphRef.current) return;
    const graph = graphRef.current;
    const analysis = analyzeOntologyGraph(graph);
    const decision = decidePublishFromIssues(analysis.issues);
    const issueBuckets = bucketsFromIssues(analysis.issues);

    if (decision.blocked) {
      Modal.error({
        title: '发布校验未通过',
        content: (
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            {issueBuckets.errors.map((error) => <li key={error}>{error}</li>)}
          </ul>
        ),
      });
      return;
    }

    const diffSummary = summarizeDiff(lastPublishedAnalysisRef.current, analysis);
    const warningList = issueBuckets.warnings;

    Modal.confirm({
      title: '变更预览',
      okText: '发布',
      cancelText: '取消',
      content: (
        <div>
          <div style={{ marginBottom: 8 }}>{diffSummary}</div>
          {warningList.length > 0 && (
            <div style={{ color: '#d48806' }}>
              <div style={{ marginBottom: 4 }}>警告：</div>
              <ul style={{ paddingLeft: 18, margin: 0 }}>
                {warningList.map((warning) => <li key={warning}>{warning}</li>)}
              </ul>
            </div>
          )}
        </div>
      ),
      onOk: async () => {
        setPublishing(true);
        try {
          await persistOntology(graph);
          const domainIr: SemanticIR = {
            meta: { version: 'ir/0.1', source: 'canvas', generatedAt: new Date().toISOString() },
            model: buildDomainModelFromGraph(graph),
          };
          try {
            await saveDomainIR(domainIr);
          } catch (domainError) {
            console.error(domainError);
            message.warning('本体已发布，但 Domain IR 保存失败');
          }
          lastPublishedSnapshotRef.current = graph.toJSON() as unknown as Record<string, unknown>;
          lastPublishedAnalysisRef.current = analysis;
          message.success('本体发布成功');
        } catch (error) {
          console.error(error);
          message.error('发布失败');
        } finally {
          setPublishing(false);
        }
      }
    });
  };

  const handleRollbackToLastPublish = () => {
    if (!graphRef.current) return;
    if (!lastPublishedSnapshotRef.current) {
      message.info('暂无可回滚的发布快照');
      return;
    }
    Modal.confirm({
      title: '回滚确认',
      content: '将回滚到上次发布快照，未发布修改会丢失。是否继续？',
      okText: '确认回滚',
      cancelText: '取消',
      onOk: () => {
        if (!graphRef.current || !lastPublishedSnapshotRef.current) return;
        graphRef.current.fromJSON(lastPublishedSnapshotRef.current as unknown as Record<string, unknown>);
        setSelectedCell(null);
        message.success('已回滚到上次发布快照');
      }
    });
  };

  const handleCreateNew = () => {
    if (!graphRef.current) return;
    graphRef.current.clearCells();
    const defaultNode = graphRef.current.createNode({
      shape: 'meta-type', x: 200, y: 100, 
      attrs: { label: { text: 'NewType' } },
      data: { type: 'MetaType', name: 'NewType' }
    });
    graphRef.current.addNode(defaultNode);
    graphRef.current.centerContent();
    refreshStructureTree(graphRef.current);
    setCurrentType(null);
    lastPublishedSnapshotRef.current = null;
    lastPublishedAnalysisRef.current = null;
  };

  return (
    <Layout style={{ height: '100%' }}>
      <Sider width={280} style={{ background: '#fff', borderRight: '1px solid #eee', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px', borderBottom: '1px solid #eee' }}>
          <Button type="dashed" block icon={<PlusOutlined />} onClick={addChamberToCanvas}>添加腔室</Button>
          <Button style={{ marginTop: 8 }} type="dashed" block icon={<PlusOutlined />} onClick={addPortToCanvas}>添加端口</Button>
        </div>
        <Tabs
          size="small"
          activeKey={leftTab}
          onChange={(key) => setLeftTab(key as 'structure' | 'stencil')}
          items={[
            {
              key: 'structure',
              label: '结构树',
              children: (
                <div style={{ padding: '8px 10px' }}>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>
                    归属关系默认由结构定义（Type &gt; Zone &gt; Port）
                  </div>
                  <Tree
                    treeData={structureTreeData}
                    onSelect={handleStructureSelect}
                    defaultExpandAll
                    showLine
                  />
                </div>
              ),
            },
            {
              key: 'stencil',
              label: '组件库',
              forceRender: true,
              children: <div ref={stencilRef} style={{ height: '100%', position: 'relative' }} />,
            },
          ]}
          style={{ flex: 1, overflow: 'auto' }}
        />
      </Sider>
      
      <Content style={{ background: '#f0f2f5', position: 'relative', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '8px 16px', background: '#fff', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontWeight: 'bold' }}>当前编辑:</span>
          <Select 
            style={{ width: 200 }} 
            placeholder="选择设备类型..." 
            value={currentType}
            onChange={loadOntologyData}
            dropdownRender={menu => (
              <>
                {menu}
                <Divider style={{ margin: '8px 0' }} />
                <Button type="text" block icon={<PlusOutlined />} onClick={handleCreateNew}>
                  新建类型
                </Button>
              </>
            )}
            options={existingTypes.map(t => ({ label: t, value: t }))}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchExistingTypes} />
          <Select
            style={{ width: 250 }}
            value={selectedTemplateType}
            onChange={setSelectedTemplateType}
            options={ONTOLOGY_TEMPLATE_OPTIONS}
          />
          <Button onClick={() => applyOntologyTemplate(selectedTemplateType)}>应用工艺本体模板</Button>
          <div style={{ flex: 1 }} />
          <Button onClick={handleRollbackToLastPublish}>回滚上次发布</Button>
          <Button type="primary" icon={<SaveOutlined />} onClick={handlePublishWithValidation} loading={publishing || loading}>发布与校验</Button>
        </div>

        <div ref={containerRef} style={{ flex: 1, width: '100%' }} />
        {loading && <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 99 }}><Spin tip="加载中..." /></div>}
        
        <ContextMenu visible={menu.visible} x={menu.x} y={menu.y} type={menu.type} onClose={() => setMenu({ ...menu, visible: false })} onAction={handleMenuAction} />
      </Content>
      
      <Sider width={300} style={{ background: '#fff', borderLeft: '1px solid #eee', padding: 16 }}>
        <Title level={4}>属性配置</Title>
        {selectedCell ? (
          <Form form={form} layout="vertical" onValuesChange={handleFormChange}>
            {selectedCell.isNode() && (
              <>
                <Form.Item label="显示名称 (Label)" name="label"><Input /></Form.Item>
                <Form.Item label="唯一标识 (ID)" name="name" help="对应图元 JSON 中的 type 或 chamber 字段">
                  {selectedCell.getData()?.type === 'MetaType' ? (
                    <Select showSearch options={TYPE_ID_OPTIONS} placeholder="选择设备类型 ID" optionFilterProp="label" />
                  ) : selectedCell.getData()?.type === 'MetaPort' ? (
                    <Select showSearch options={PORT_ID_OPTIONS} placeholder="选择端口 ID" optionFilterProp="label" />
                  ) : (
                    <Select showSearch options={CHAMBER_ID_OPTIONS} placeholder="选择腔室 ID" optionFilterProp="label" />
                  )}
                </Form.Item>
                {selectedCell.getData()?.type === 'MetaPort' && (
                  <>
                    <Form.Item label="方向 (dir)" name="dir">
                      <Select options={PORT_DIR_OPTIONS} />
                    </Form.Item>
                    <Form.Item label="角色 (role)" name="role">
                      <Select options={PORT_ROLE_OPTIONS} />
                    </Form.Item>
                    <Form.Item label="定位模式" name="positionMode" help="挂点模式会自动吸附在腔室边界">
                      <Select
                        options={[
                          { value: 'anchored', label: '挂点模式（推荐）' },
                          { value: 'free', label: '自由模式' },
                        ]}
                      />
                    </Form.Item>
                  </>
                )}
              </>
            )}
            {selectedCell.isEdge() && (
              <>
                <div style={{ marginBottom: 16, textAlign: 'center', color: '#1890ff' }}>
                  <SwapOutlined style={{ fontSize: 24 }} />
                  <div>物理交互关系</div>
                </div>
                <Form.Item label="关系类型 (Mechanism)" name="relType">
                  <Select options={RELATION_OPTIONS} />
                </Form.Item>
              </>
            )}
          </Form>
        ) : (
          <div style={{ color: '#999', textAlign: 'center', marginTop: 40 }}>
            <DeploymentUnitOutlined style={{ fontSize: 24, marginBottom: 8 }} />
            <p>请选择节点或连线</p>
          </div>
        )}
      </Sider>
      <Modal
        title="选择关系语义"
        open={Boolean(relationPicker?.visible)}
        onOk={handleApplyRelationPicker}
        onCancel={() => setRelationPicker(null)}
        okText="应用"
        cancelText="取消"
      >
        {relationPicker && (
          <div>
            <div style={{ marginBottom: 8, color: '#666' }}>
              端点类型: {relationPicker.sourceType} -&gt; {relationPicker.targetType}
            </div>
            <Select
              style={{ width: '100%' }}
              value={relationPicker.selected}
              onChange={(value) => setRelationPicker((prev) => prev ? { ...prev, selected: value as RelationType } : prev)}
              options={RELATION_OPTIONS.filter((item) => relationPicker.candidates.includes(item.value))}
            />
          </div>
        )}
      </Modal>
    </Layout>
  );
};

export default OntologyDesigner;
