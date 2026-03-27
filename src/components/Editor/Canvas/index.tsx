// src/components/Editor/Canvas/index.tsx
import { useCallback, useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { Graph, Cell, Edge, Node } from '@antv/x6';
import { Stencil } from '@antv/x6-plugin-stencil';
import { Keyboard } from '@antv/x6-plugin-keyboard';
import { Selection } from '@antv/x6-plugin-selection';
import { History } from '@antv/x6-plugin-history';
import { Transform } from '@antv/x6-plugin-transform';
import '@antv/x6-plugin-transform/dist/index.css';
import { Button, Tooltip, message, Modal } from 'antd';
import { 
  ZoomInOutlined, ZoomOutOutlined, OneToOneOutlined, CompressOutlined, 
  UndoOutlined, RedoOutlined, ClearOutlined 
} from '@ant-design/icons';

import Inspector from '../Inspector';
import ContextMenu, { type MenuState } from '../ContextMenu';
import './index.css';
import { saveGraphData, loadGraphData, saveDomainIR, saveDomainIRWithRoundTripCheck, loadDomainIR, type SaveDomainIROptions } from '../../../services/neo4j';
import { FLUID_COLORS, INLINE_TYPES } from '../../../config/rules';
import { SHAPE_LIBRARY } from '../../../graph/cells/registry';
import { createEmptyIR, type SemanticIR } from '../../../domain/ir';
import { RELATION_TYPES } from '../../../domain/relations';
import type { RoundTripReport } from '../../../domain/roundTrip';
import { useDrawingStore } from '../../../store/drawingStore'; // [新增] 引入 Store

export interface GraphCanvasRef {
  handleSave: (drawingId: string) => Promise<void>;
  handleSaveDomainIR: (drawingId: string, options?: { silent?: boolean; verifyRoundTrip?: boolean; saveOptions?: SaveDomainIROptions }) => Promise<RoundTripReport | null>;
  handleExportDomainIR: (drawingId: string) => SemanticIR | null;
  handleReplayDomainIR: (drawingId: string) => Promise<boolean>;
  handleFocusDomainEntity: (entityId: string) => boolean;
}

interface GraphCanvasProps {
  drawingId: string | null;
}

type ClipboardCell = {
  id: string;
  shape: string;
  position: { x: number; y: number };
  size?: { width: number; height: number };
  angle?: number;
  zIndex?: number;
  attrs?: Record<string, unknown>;
  data?: Record<string, unknown>;
  ports?: Node.Metadata['ports'];
};

const TYPE_TAG_PREFIX: Record<string, string> = {
  Reactor: 'R',
  FixedBedReactor: 'R',
  Tank: 'V',
  Exchanger: 'E',
  VerticalExchanger: 'E',
  Evaporator: 'EV',
  GasCooler: 'GC',
  Trap: 'TR',
  Pump: 'P',
  LiquidPump: 'P',
  CentrifugalPump: 'P',
  DiaphragmPump: 'P',
  PistonPump: 'P',
  GearPump: 'P',
  Compressor: 'C',
  Fan: 'F',
  JetPump: 'JP',
  Valve: 'VLV',
  ControlValve: 'CV',
  ManualValve: 'MV',
  Fitting: 'FT',
  OffPageConnector: 'OPC',
};

// 辅助函数：提取对象中的指定属性
const pick = (obj: Record<string, unknown>, keys: string[]) => {
  const ret: Record<string, unknown> = {};
  keys.forEach(key => {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') {
      ret[key] = obj[key];
    }
  });
  return ret;
};

const GraphCanvas = forwardRef<GraphCanvasRef, GraphCanvasProps>(({ drawingId }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stencilRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);
  const historyRef = useRef<History | null>(null);
  const clipboardRef = useRef<ClipboardCell[] | null>(null);
  const isLoadingRef = useRef(false);

  const [selectedCell, setSelectedCell] = useState<Cell | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  
  const [menu, setMenu] = useState<MenuState>({ visible: false, x: 0, y: 0, type: null });
  const [inspectorFocusHint, setInspectorFocusHint] = useState<{ entityId: string; portId?: string } | null>(null);

  // [新增] 获取 Store 方法
  const { setDirty, isDirty, setCurrentDrawing, drawings } = useDrawingStore();

  // --- 辅助函数：判断是否为在线元件 ---
  const isInlineComponent = useCallback((cellId: string) => {
    if (!graphRef.current) return false;
    const cell = graphRef.current.getCellById(cellId);
    if (!cell || !cell.isNode()) return false;
    return INLINE_TYPES.includes(cell.getData()?.type);
  }, []);

  // --- 辅助函数：刷新所有管线的路由策略 ---
  const refreshRouting = useCallback(() => {
    const graph = graphRef.current;
    if (!graph) return;
    
    graph.getEdges().forEach(edge => {
      if (edge.getData()?.type === 'Pipe') {
        const sourceId = edge.getSourceCellId();
        const targetId = edge.getTargetCellId();
        
        const excludeNodes = ['SHEET_FRAME_A2'];
        if (isInlineComponent(sourceId)) excludeNodes.push(sourceId);
        if (isInlineComponent(targetId)) excludeNodes.push(targetId);

        edge.setRouter('manhattan', {
          padding: 10,
          excludeNodes: excludeNodes
        });
      }
    });
  }, [isInlineComponent]);

  const ensureNodeTypeTag = useCallback((node: Node) => {
    const graph = graphRef.current;
    if (!graph) return;
    const data = node.getData() || {};
    const type = typeof data.type === 'string' ? data.type : '';
    if (!type || data.isBackground || type === 'Frame' || type === 'TappingPoint' || type === 'Instrument') return;

    const prefix = TYPE_TAG_PREFIX[type] || type.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 4) || 'EQ';
    const reg = new RegExp(`^${prefix}-(\\d{3,})$`);
    const siblingTags = new Set<string>();
    let maxIndex = 0;
    graph.getNodes().forEach((n) => {
      if (n.id === node.id || n.getData()?.isBackground) return;
      const nData = n.getData() || {};
      if (nData.type !== type) return;
      const tag = typeof nData.tag === 'string' ? nData.tag.trim().toUpperCase() : '';
      if (!tag) return;
      siblingTags.add(tag);
      const match = tag.match(reg);
      if (match) {
        const idx = Number.parseInt(match[1], 10);
        if (Number.isFinite(idx)) {
          maxIndex = Math.max(maxIndex, idx);
        }
      }
    });

    const currentTag = typeof data.tag === 'string' ? data.tag.trim().toUpperCase() : '';
    const currentMatch = currentTag.match(reg);
    const isCurrentAvailable = Boolean(currentTag) && !siblingTags.has(currentTag);
    if (isCurrentAvailable && (data.autoTag !== true || currentMatch)) return;

    let nextIndex = 1;
    while (siblingTags.has(`${prefix}-${String(nextIndex).padStart(3, '0')}`)) {
      nextIndex += 1;
    }
    if (nextIndex <= maxIndex) {
      for (let i = 1; i <= maxIndex + 1; i += 1) {
        const candidate = `${prefix}-${String(i).padStart(3, '0')}`;
        if (!siblingTags.has(candidate)) {
          nextIndex = i;
          break;
        }
      }
    }

    const nextTag = `${prefix}-${String(nextIndex).padStart(3, '0')}`;
    node.setData({ ...data, tag: nextTag, autoTag: true });
    node.setAttrs({ label: { text: nextTag } });
  }, []);

  const buildDomainIR = useCallback((targetDrawingId: string): SemanticIR | null => {
    const graph = graphRef.current;
    if (!graph) return null;

    const drawingName = drawings.find((d) => d.id === targetDrawingId)?.name || targetDrawingId;
    const ir = createEmptyIR(targetDrawingId, drawingName);
    const { model } = ir;
    const nodes = graph.getNodes().filter((node) => !node.getData()?.isBackground);
    const edges = graph.getEdges();
    const equipmentNodeIds = new Set<string>();
    const instrumentNodeIds = new Set<string>();

    const toDomainPortId = (nodeId: string, portId: string) => `${nodeId}::${portId}`;

    nodes.forEach((node) => {
      const data = node.getData() || {};
      const type = String(data.type || 'Unknown');
      const tag = String(data.tag || node.attr('label/text') || '');
      const nodePorts = node.getPorts();

      if (type === 'Instrument') {
        instrumentNodeIds.add(node.id);
        model.instruments.push({
          id: node.id,
          type,
          tag,
          loop: typeof data.loopNum === 'string' ? data.loopNum : undefined,
          attributes: { ...data },
        });
        nodePorts.forEach((port) => {
          if (!port.id) return;
          model.ports.push({
            id: toDomainPortId(node.id, port.id),
            ownerKind: 'instrument',
            ownerId: node.id,
            direction: (port.data?.dir === 'in' || port.data?.dir === 'out' || port.data?.dir === 'bi') ? port.data.dir : 'bi',
            role: typeof port.data?.role === 'string' ? port.data.role : 'signal',
            mediumClass: typeof port.data?.phase === 'string' ? port.data.phase : 'signal',
            label: typeof port.data?.desc === 'string' ? port.data.desc : port.id,
            attributes: { ...port.data },
          });
          model.relations.push({
            id: `rel-has-port-${node.id}-${port.id}`,
            type: RELATION_TYPES.HAS_PORT,
            source: { kind: 'instrument', id: node.id },
            target: { kind: 'port', id: toDomainPortId(node.id, port.id) },
          });
        });
        return;
      }

      if (type === 'TappingPoint' || type === 'Frame') return;

      equipmentNodeIds.add(node.id);
      model.equipments.push({
        id: node.id,
        type,
        tag,
        name: tag || type,
        description: typeof data.desc === 'string' ? data.desc : undefined,
        zoneIds: [],
        portIds: [],
        attributes: { ...data },
      });
      nodePorts.forEach((port) => {
        if (!port.id) return;
        model.ports.push({
          id: toDomainPortId(node.id, port.id),
          ownerKind: 'equipment',
          ownerId: node.id,
          direction: (port.data?.dir === 'in' || port.data?.dir === 'out' || port.data?.dir === 'bi') ? port.data.dir : 'bi',
          role: typeof port.data?.role === 'string' ? port.data.role : 'process',
          mediumClass: typeof port.data?.phase === 'string' ? port.data.phase : 'process',
          label: typeof port.data?.desc === 'string' ? port.data.desc : port.id,
          attributes: { ...port.data },
        });
        model.relations.push({
          id: `rel-has-port-${node.id}-${port.id}`,
          type: RELATION_TYPES.HAS_PORT,
          source: { kind: 'equipment', id: node.id },
          target: { kind: 'port', id: toDomainPortId(node.id, port.id) },
        });
      });
    });

    edges.forEach((edge) => {
      const data = edge.getData() || {};
      const sourceNode = edge.getSourceNode();
      const targetNode = edge.getTargetNode();
      const sourcePortId = edge.getSourcePortId();
      const targetPortId = edge.getTargetPortId();
      if (!sourceNode || !targetNode) return;

      if (data.type === 'Pipe') {
        if (!sourcePortId || !targetPortId) return;
        const fromPortId = toDomainPortId(sourceNode.id, sourcePortId);
        const toPortId = toDomainPortId(targetNode.id, targetPortId);
        model.pipes.push({
          id: edge.id,
          fromPortId,
          toPortId,
          fluid: typeof data.fluid === 'string' ? data.fluid : 'Water',
          material: typeof data.material === 'string' ? data.material : 'CS',
          dnSpec: (data.dnSpec && typeof data.dnSpec === 'object') ? data.dnSpec as { series: string; value: string; unit?: string } : undefined,
          pnSpec: (data.pnSpec && typeof data.pnSpec === 'object') ? data.pnSpec as { series: string; value: string; unit?: string; standard?: string } : undefined,
          insulation: typeof data.insulation === 'string' ? data.insulation : 'None',
          tag: typeof data.tag === 'string' ? data.tag : undefined,
          attributes: { ...data },
        });
        model.relations.push({
          id: `rel-connects-${edge.id}`,
          type: RELATION_TYPES.CONNECTS_TO,
          source: { kind: 'port', id: fromPortId },
          target: { kind: 'port', id: toPortId },
        });
        return;
      }

      const sourceIsInstrument = instrumentNodeIds.has(sourceNode.id);
      const targetIsInstrument = instrumentNodeIds.has(targetNode.id);
      if (!sourceIsInstrument && !targetIsInstrument) return;

      const relType = data.relationType === 'CONTROLS' ? RELATION_TYPES.CONTROLS : RELATION_TYPES.MEASURES;
      if (sourceIsInstrument && equipmentNodeIds.has(targetNode.id)) {
        model.relations.push({
          id: `rel-signal-${edge.id}`,
          type: relType,
          source: { kind: 'instrument', id: sourceNode.id },
          target: { kind: 'equipment', id: targetNode.id },
          attributes: { ...data },
        });
      } else if (targetIsInstrument && equipmentNodeIds.has(sourceNode.id)) {
        model.relations.push({
          id: `rel-signal-${edge.id}`,
          type: relType,
          source: { kind: 'instrument', id: targetNode.id },
          target: { kind: 'equipment', id: sourceNode.id },
          attributes: { ...data },
        });
      }
    });

    model.drawing.equipmentIds = model.equipments.map((e) => e.id);
    model.drawing.instrumentIds = model.instruments.map((i) => i.id);
    model.drawing.pipeIds = model.pipes.map((p) => p.id);
    model.drawing.relationIds = model.relations.map((r) => r.id);

    return ir;
  }, [drawings]);

  const getShapeIdByType = useCallback((type: string) => {
    const exact = Object.keys(SHAPE_LIBRARY).find((id) => SHAPE_LIBRARY[id]?.data?.type === type);
    if (exact) return exact;
    const fuzzy = Object.keys(SHAPE_LIBRARY).find((id) => String(SHAPE_LIBRARY[id]?.data?.type || '').includes(type));
    if (fuzzy) return fuzzy;
    if (type === 'Instrument') {
      return Object.keys(SHAPE_LIBRARY).find((id) => SHAPE_LIBRARY[id]?.data?.type === 'Instrument') || 'p-inst-local';
    }
    return Object.keys(SHAPE_LIBRARY).find((id) => SHAPE_LIBRARY[id]?.data?.type === 'Valve') || 'p-valve';
  }, []);

  const applyDomainIRToCanvas = useCallback((graph: Graph, ir: SemanticIR) => {
    isLoadingRef.current = true;
    try {
      graph.batchUpdate(() => {
      // Hard reset all cells to eliminate any residual duplicated edges.
      graph.clearCells({ silent: true });
      graph.addNode({
        shape: 'drawing-frame-a2',
        id: 'SHEET_FRAME_A2',
        x: 0,
        y: 0,
        zIndex: -1,
        movable: false,
        selectable: false,
        data: { type: 'Frame', isBackground: true },
      });

    const equipmentAndInst = [
      ...ir.model.equipments.map((e) => ({ id: e.id, type: e.type, tag: e.tag || e.name || e.id, data: e.attributes || {} })),
      ...ir.model.instruments.map((i) => ({ id: i.id, type: i.type || 'Instrument', tag: i.tag || i.id, data: i.attributes || {} })),
    ];
    const nodeById = new Map<string, Node>();

    const cols = 4;
    const baseX = 120;
    const baseY = 120;
    const gapX = 220;
    const gapY = 180;

      equipmentAndInst.forEach((item, index) => {
      const shapeId = getShapeIdByType(item.type);
      const shapeMeta = SHAPE_LIBRARY[shapeId];
      const x = baseX + (index % cols) * gapX;
      const y = baseY + Math.floor(index / cols) * gapY;
      const width = shapeMeta?.width || 90;
      const height = shapeMeta?.height || 70;

      const existing = graph.getCellById(item.id);
      if (existing) graph.removeCell(existing, { silent: true });

      const node = graph.addNode({
        id: item.id,
        shape: shapeId,
        x,
        y,
        width,
        height,
        data: { ...(shapeMeta?.data || {}), ...item.data, type: item.type, tag: item.tag, autoTag: false },
        attrs: {
          label: { text: item.tag },
        },
      }) as Node;
      nodeById.set(item.id, node);
      });

    const portRefById = new Map<string, { nodeId: string; portId?: string }>();
    const tryResolvePort = (nodeId: string, candidatePortId?: string) => {
      const node = nodeById.get(nodeId);
      if (!node || !candidatePortId) return undefined;
      return node.hasPort(candidatePortId) ? candidatePortId : undefined;
    };

    ir.model.ports.forEach((port) => {
      if (port.id.includes('::')) {
        const [nodeId, candidatePortId] = port.id.split('::');
        portRefById.set(port.id, { nodeId, portId: candidatePortId });
        return;
      }
      if (port.ownerKind === 'equipment' || port.ownerKind === 'instrument') {
        portRefById.set(port.id, { nodeId: port.ownerId, portId: port.id });
        return;
      }
      const zone = ir.model.zones.find((z) => z.id === port.ownerId);
      if (zone) portRefById.set(port.id, { nodeId: zone.equipmentId, portId: port.id });
    });

    const seenPipeKeys = new Set<string>();
      ir.model.pipes.forEach((pipe) => {
      const sourceRef = portRefById.get(pipe.fromPortId);
      const targetRef = portRefById.get(pipe.toPortId);
      if (!sourceRef || !targetRef) return;
      if (!nodeById.has(sourceRef.nodeId) || !nodeById.has(targetRef.nodeId)) return;

      const sourcePort = tryResolvePort(sourceRef.nodeId, sourceRef.portId);
      const targetPort = tryResolvePort(targetRef.nodeId, targetRef.portId);
      const forwardKey = `${sourceRef.nodeId}|${sourcePort || ''}|${targetRef.nodeId}|${targetPort || ''}`;
      const reverseKey = `${targetRef.nodeId}|${targetPort || ''}|${sourceRef.nodeId}|${sourcePort || ''}`;
      if (seenPipeKeys.has(forwardKey) || seenPipeKeys.has(reverseKey)) return;
      seenPipeKeys.add(forwardKey);

      const pipeData = {
        ...(pipe.attributes || {}),
        type: 'Pipe',
        fluid: pipe.fluid || (pipe.attributes?.fluid as string) || 'Water',
        material: pipe.material || (pipe.attributes?.material as string) || 'CS',
        dn: pipe.dnSpec ? `${pipe.dnSpec.series}${pipe.dnSpec.value}` : (pipe.attributes?.dn as string),
        pn: pipe.pnSpec ? `${pipe.pnSpec.series}${pipe.pnSpec.value}` : (pipe.attributes?.pn as string),
        dnSpec: pipe.dnSpec || (pipe.attributes?.dnSpec as Record<string, unknown> | undefined),
        pnSpec: pipe.pnSpec || (pipe.attributes?.pnSpec as Record<string, unknown> | undefined),
        insulation: pipe.insulation || (pipe.attributes?.insulation as string) || 'None',
        desc: pipe.attributes?.desc,
        tag: pipe.tag || (pipe.attributes?.tag as string) || '',
      };

      const color = FLUID_COLORS[pipeData.fluid as keyof typeof FLUID_COLORS] || '#5F95FF';
      const isJacket = typeof pipeData.insulation === 'string' && pipeData.insulation.startsWith('Jacket');
      const isTracing = typeof pipeData.insulation === 'string' && ['ST', 'ET', 'OT'].includes(pipeData.insulation);

      const existing = graph.getCellById(pipe.id);
      if (existing) graph.removeCell(existing, { silent: true });
      graph.addEdge({
        id: pipe.id,
        shape: 'edge',
        source: { cell: sourceRef.nodeId, port: sourcePort },
        target: { cell: targetRef.nodeId, port: targetPort },
        labels: pipeData.tag ? [{ attrs: { label: { text: String(pipeData.tag) } } }] : [],
        attrs: {
          line: {
            stroke: isJacket ? '#fa8c16' : color,
            strokeWidth: isJacket ? 4 : 2,
            strokeDasharray: isTracing ? '5 5' : null,
            targetMarker: { name: 'classic', width: 8, height: 6 },
          },
        },
        data: pipeData,
      });
      });

      ir.model.relations.forEach((relation) => {
      if (!(relation.type === RELATION_TYPES.MEASURES || relation.type === RELATION_TYPES.CONTROLS)) return;
      const srcRef = relation.source.kind === 'port'
        ? portRefById.get(relation.source.id)
        : { nodeId: relation.source.id, portId: undefined };
      const tgtRef = relation.target.kind === 'port'
        ? portRefById.get(relation.target.id)
        : { nodeId: relation.target.id, portId: undefined };
      if (!srcRef || !tgtRef) return;
      if (!nodeById.has(srcRef.nodeId) || !nodeById.has(tgtRef.nodeId)) return;
      const existing = graph.getCellById(relation.id);
      if (existing) graph.removeCell(existing, { silent: true });
      graph.addEdge({
        id: relation.id,
        shape: 'signal-edge',
        source: { cell: srcRef.nodeId, port: tryResolvePort(srcRef.nodeId, srcRef.portId) },
        target: { cell: tgtRef.nodeId, port: tryResolvePort(tgtRef.nodeId, tgtRef.portId) },
        data: { ...(relation.attributes || {}), type: 'Signal', relationType: relation.type, fluid: 'Signal' },
      });
      });

      // Final safety dedupe: keep only one edge per semantic endpoint key.
      const seenEdgeKeys = new Set<string>();
      graph.getEdges().forEach((edge) => {
        const srcId = edge.getSourceCellId() || '';
        const srcPort = edge.getSourcePortId() || '';
        const tgtId = edge.getTargetCellId() || '';
        const tgtPort = edge.getTargetPortId() || '';
        const data = edge.getData() || {};
        const kind = String(data.type || 'Pipe');
        const rel = String(data.relationType || '');
        const keyA = `${kind}|${rel}|${srcId}|${srcPort}|${tgtId}|${tgtPort}`;
        const keyB = `${kind}|${rel}|${tgtId}|${tgtPort}|${srcId}|${srcPort}`;
        if (seenEdgeKeys.has(keyA) || seenEdgeKeys.has(keyB)) {
          graph.removeCell(edge, { silent: true });
          return;
        }
        seenEdgeKeys.add(keyA);
      });

      // Secondary dedupe: for the same pipe node-pair, drop weaker no-port edges
      // when a port-bound edge exists. This prevents center-to-center ghost duplicates.
      const pipePairMap = new Map<string, Edge[]>();
      graph.getEdges().forEach((edge) => {
        const data = edge.getData() || {};
        if (String(data.type || 'Pipe') !== 'Pipe') return;
        const srcId = edge.getSourceCellId() || '';
        const tgtId = edge.getTargetCellId() || '';
        if (!srcId || !tgtId) return;
        const pairKey = srcId < tgtId ? `${srcId}|${tgtId}` : `${tgtId}|${srcId}`;
        const list = pipePairMap.get(pairKey) || [];
        list.push(edge);
        pipePairMap.set(pairKey, list);
      });
      pipePairMap.forEach((edges) => {
        if (edges.length <= 1) return;
        const withPort = edges.filter((edge) => Boolean(edge.getSourcePortId() || edge.getTargetPortId()));
        if (withPort.length === 0) return;
        edges.forEach((edge) => {
          const hasPort = Boolean(edge.getSourcePortId() || edge.getTargetPortId());
          if (!hasPort) graph.removeCell(edge, { silent: true });
        });
      });

      graph.getNodes().forEach((node) => {
        if (!node.getData()?.isBackground) {
          node.setZIndex(node.getData()?.type === 'TappingPoint' ? 10 : 2);
        }
      });
      graph.getEdges().forEach((edge) => edge.setZIndex(1));
      refreshRouting();
      graph.centerContent();
      });
    } finally {
      isLoadingRef.current = false;
    }
  }, [getShapeIdByType, refreshRouting]);

  // --- [重构] 核心保存逻辑 ---
  const executeSave = useCallback(async (saveId: string) => {
    if (!graphRef.current) return;
    const graph = graphRef.current;
    
    // 1. 处理节点
    const nodes = graph.getNodes()
      .filter(node => !node.getData()?.isBackground)
      .map(node => {
        const data = node.getData() || {};
        const pos = node.getPosition();
        const size = node.getSize();
        const angle = node.getAngle(); 
        const type = data.type || 'Unknown';

        let Tag = data.tag || node.getAttrs()?.label?.text || '';
        if (type === 'Instrument') {
          const func = data.tagId || '';
          const loop = data.loopNum || '';
          if (func || loop) Tag = `${func}${loop ? '-' + loop : ''}`;
        }

        const layoutData = {
          x: Math.round(pos.x),
          y: Math.round(pos.y),
          w: Math.round(size.width),
          h: Math.round(size.height),
          a: Math.round(angle), 
          s: node.shape
        };

        const baseProps = {
          x6Id: node.id,
          type: type, 
          Tag: Tag,
          desc: data.desc || '',
          layout: JSON.stringify(layoutData),
          labelPosition: data.labelPosition || 'auto',
          labelPinned: Boolean(data.labelPinned),
        };

        let specificProps = {};
        if (['LiquidPump', 'CentrifugalPump', 'DiaphragmPump', 'PistonPump', 'GearPump', 'Compressor', 'Fan', 'JetPump'].includes(type)) {
           specificProps = pick(data, ['spec', 'flow', 'head', 'power', 'material']);
        } else if (['Reactor', 'Tank', 'Evaporator', 'Separator'].includes(type)) {
           specificProps = pick(data, ['spec', 'volume', 'material', 'designPressure', 'designTemp', 'internals']);
        } else if (type === 'Exchanger') {
           specificProps = pick(data, ['spec', 'area', 'material', 'designPressure', 'tubePressure']);
        } else if (['ControlValve', 'Valve'].includes(type)) {
           specificProps = pick(data, ['spec', 'size', 'valveClass', 'failPosition']);
        } else if (type === 'Instrument') {
           specificProps = pick(data, ['spec', 'range', 'unit', 'tagId', 'loopNum']);
        } else if (type === 'OffPageConnector') { 
           // [修复] 确保提取 targetDrawingId
           specificProps = pick(data, ['spec', 'targetDrawingId', 'connectorLabel']);
        } else {
           specificProps = pick(data, ['spec', 'material']);
        }

        return { ...baseProps, ...specificProps };
      });

    // 2. 处理连线
    const edges = graph.getEdges().map(edge => {
      const data = edge.getData() || {};
      const sourceNode = edge.getSourceNode();
      const targetNode = edge.getTargetNode();
      const vertices = edge.getVertices(); 
      
      const getPortMeta = (node: Cell | null, portId: string | undefined) => {
        if (!node || !node.isNode() || !portId) return { group: 'default', desc: 'unknown' };
        
        const port = node.getPort(portId);
        if (!port) return { group: 'default', desc: 'unknown' };

        let region = port.data?.region || port.group || 'default';
        if (port.data?.region && port.data?.section) {
          region = `${port.data.region}:${port.data.section}`;
        }

        return {
          group: region, 
          desc: port.data?.desc || port.attrs?.circle?.title || port.id
        };
      };

      const srcMeta = getPortMeta(sourceNode, edge.getSourcePortId());
      const tgtMeta = getPortMeta(targetNode, edge.getTargetPortId());
      const dnSpecRaw = (data as Record<string, unknown>).dnSpec;
      const pnSpecRaw = (data as Record<string, unknown>).pnSpec;
      const dnSpec = dnSpecRaw && typeof dnSpecRaw === 'object'
        ? dnSpecRaw
        : { series: 'DN', value: String(data.dn || '50'), unit: 'mm' };
      const pnSpec = pnSpecRaw && typeof pnSpecRaw === 'object'
        ? pnSpecRaw
        : { series: 'PN', value: String(data.pn || '16'), unit: 'bar' };

      return {
        source: edge.getSourceCell()?.id,
        target: edge.getTargetCell()?.id,
        sourcePort: edge.getSourcePortId(),
        targetPort: edge.getTargetPortId(),
        
        sourceRegion: srcMeta.group, 
        sourceDesc: srcMeta.desc,
        targetRegion: tgtMeta.group, 
        targetDesc: tgtMeta.desc,
        
        type: data.type || 'Pipe', 
        material: data.material || 'CS',
        fluid: data.fluid || 'Water',
        dn: data.dn || 'DN50',
        pn: data.pn || 'PN16',
        dnSpecJson: JSON.stringify(dnSpec),
        pnSpecJson: JSON.stringify(pnSpec),
        insulation: data.insulation || 'None',
        desc: data.desc || '', 
        label: edge.getLabelAt(0)?.attrs?.label?.text || '',
        vertices: JSON.stringify(vertices) 
      };
    });

    try {
      await saveGraphData(saveId, nodes, edges);
      message.success(`保存成功！节点: ${nodes.length}, 连线: ${edges.length}`);
      setDirty(false); // [新增] 保存成功后重置脏状态
    } catch (error) {
      console.error(error);
      message.error('保存失败，请检查数据库连接');
      throw error; // 抛出错误供调用方处理
    }
  }, [setDirty]);

  const executeSaveDomain = useCallback(async (saveId: string, options?: { silent?: boolean; verifyRoundTrip?: boolean; saveOptions?: SaveDomainIROptions }) => {
    const ir = buildDomainIR(saveId);
    if (!ir) {
      if (!options?.silent) message.error('语义IR生成失败');
      return null;
    }
    let roundTripReport: RoundTripReport | null = null;
    if (options?.verifyRoundTrip === false) {
      await saveDomainIR(ir, options?.saveOptions);
    } else {
      roundTripReport = await saveDomainIRWithRoundTripCheck(ir, options?.saveOptions);
      if (!roundTripReport.ok) {
        const errorCount = roundTripReport.issues.filter((i) => i.level === 'error').length;
        const warningCount = roundTripReport.issues.filter((i) => i.level === 'warning').length;
        message.warning(`语义IR已保存，但回读校验存在问题：错误 ${errorCount}，警告 ${warningCount}`);
      }
    }
    if (!options?.silent) {
      message.success(`语义IR已保存: 设备 ${ir.model.equipments.length} / 端口 ${ir.model.ports.length} / 关系 ${ir.model.relations.length}`);
    }
    return roundTripReport;
  }, [buildDomainIR]);

  const focusDomainEntity = useCallback((entityId: string): boolean => {
    const graph = graphRef.current;
    if (!graph || !entityId) return false;

    const tryIds = [entityId];
    let focusPortId: string | undefined;
    if (entityId.includes('::')) {
      const [ownerId, portId] = entityId.split('::');
      tryIds.push(ownerId);
      focusPortId = portId;
    }

    const targetCell = tryIds
      .map((id) => graph.getCellById(id))
      .find((cell): cell is Cell => Boolean(cell));

    if (!targetCell) return false;

    setSelectedCell(targetCell);
    setInspectorFocusHint({ entityId, portId: focusPortId });
    graph.resetSelection(targetCell);
    graph.getEdges().forEach((edge) => {
      edge.attr('line/strokeWidth', edge.id === targetCell.id ? 3 : 2);
      if (edge.id !== targetCell.id) edge.removeTools();
    });
    if (targetCell.isEdge() && targetCell.getData()?.type === 'Pipe') {
      targetCell.addTools([
        { name: 'vertices', args: { attrs: { fill: '#666' } } },
        { name: 'segments', args: { snapRadius: 20, attrs: { fill: '#444' } } },
      ]);
    }

    graph.centerCell(targetCell);
    return true;
  }, []);

  // --- 暴露给父组件的方法 ---
  useImperativeHandle(ref, () => ({
    handleSave: executeSave,
    handleSaveDomainIR: (targetDrawingId: string, options?: { silent?: boolean; verifyRoundTrip?: boolean; saveOptions?: SaveDomainIROptions }) => executeSaveDomain(targetDrawingId, options),
    handleExportDomainIR: (targetDrawingId: string) => buildDomainIR(targetDrawingId),
    handleReplayDomainIR: async (targetDrawingId: string) => {
      const graph = graphRef.current;
      if (!graph) return false;
      const ir = await loadDomainIR(targetDrawingId);
      if (!ir) return false;
      applyDomainIRToCanvas(graph, ir);
      return true;
    },
    handleFocusDomainEntity: (entityId: string) => focusDomainEntity(entityId),
  }), [applyDomainIRToCanvas, buildDomainIR, executeSave, executeSaveDomain, focusDomainEntity]);

   const updateNodeLabel = (node: Node) => {
    const data = node.getData() || {};
    const graph = graphRef.current;
    const position = data.labelPosition || 'auto';
    const isManual = data.labelPinned === true;
    const preferredOrder = ['bottom', 'right', 'top', 'left'] as const;
    type LabelPosition = typeof preferredOrder[number] | 'center';
    const angle = node.getAngle();
    const size = node.getSize();
    const PADDING = 26;
    const rad = (angle * Math.PI) / 180;
    const sin = Math.abs(Math.sin(rad));
    const cos = Math.abs(Math.cos(rad));
    const visualHalfW = (size.width * cos + size.height * sin) / 2;
    const visualHalfH = (size.width * sin + size.height * cos) / 2;
    const center = node.getBBox().getCenter();

    const labelText = String(node.attr('label/text') || '');
    const labelWidth = Math.max(36, Math.min(220, 12 + labelText.length * 7));
    const labelHeight = 20;

    const getOffsetByPosition = (current: LabelPosition) => {
      let visualOffsetX = 0;
      let visualOffsetY = 0;
      switch (current) {
        case 'top': visualOffsetY = -(visualHalfH + PADDING); break;
        case 'bottom': visualOffsetY = (visualHalfH + PADDING); break;
        case 'left': visualOffsetX = -(visualHalfW + PADDING); break;
        case 'right': visualOffsetX = (visualHalfW + PADDING); break;
        case 'center': visualOffsetX = 0; visualOffsetY = 0; break;
      }
      return { x: visualOffsetX, y: visualOffsetY };
    };

    const ccw = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) =>
      (cy - ay) * (bx - ax) > (by - ay) * (cx - ax);
    const segmentIntersect = (
      p1: { x: number; y: number },
      p2: { x: number; y: number },
      p3: { x: number; y: number },
      p4: { x: number; y: number },
    ) => ccw(p1.x, p1.y, p3.x, p3.y, p4.x, p4.y) !== ccw(p2.x, p2.y, p3.x, p3.y, p4.x, p4.y)
      && ccw(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y) !== ccw(p1.x, p1.y, p2.x, p2.y, p4.x, p4.y);

    const countPipeCrossings = (offset: { x: number; y: number }) => {
      if (!graph) return 0;
      const rect = {
        x: center.x + offset.x - labelWidth / 2,
        y: center.y + offset.y - labelHeight / 2,
        width: labelWidth,
        height: labelHeight,
      };
      const rectEdges = [
        [{ x: rect.x, y: rect.y }, { x: rect.x + rect.width, y: rect.y }],
        [{ x: rect.x + rect.width, y: rect.y }, { x: rect.x + rect.width, y: rect.y + rect.height }],
        [{ x: rect.x + rect.width, y: rect.y + rect.height }, { x: rect.x, y: rect.y + rect.height }],
        [{ x: rect.x, y: rect.y + rect.height }, { x: rect.x, y: rect.y }],
      ] as const;
      let crossings = 0;
      graph.getEdges().forEach((edge) => {
        if (edge.getData()?.type === 'Signal') return;
        const points = [edge.getSourcePoint(), ...(edge.getVertices() || []), edge.getTargetPoint()];
        for (let i = 0; i < points.length - 1; i++) {
          const p1 = points[i];
          const p2 = points[i + 1];
          for (const [r1, r2] of rectEdges) {
            if (segmentIntersect(p1, p2, r1, r2)) {
              crossings += 1;
              return;
            }
          }
          const p1Inside = p1.x >= rect.x && p1.x <= rect.x + rect.width && p1.y >= rect.y && p1.y <= rect.y + rect.height;
          const p2Inside = p2.x >= rect.x && p2.x <= rect.x + rect.width && p2.y >= rect.y && p2.y <= rect.y + rect.height;
          if (p1Inside || p2Inside) {
            crossings += 1;
            return;
          }
        }
      });
      return crossings;
    };

    let finalPosition: LabelPosition = 'bottom';
    if (isManual && ['top', 'bottom', 'left', 'right', 'center'].includes(position)) {
      finalPosition = position as LabelPosition;
    } else {
      let bestScore = Number.POSITIVE_INFINITY;
      preferredOrder.forEach((candidate, index) => {
        const offset = getOffsetByPosition(candidate);
        const crossings = countPipeCrossings(offset);
        const score = crossings * 100 + index;
        if (score < bestScore) {
          bestScore = score;
          finalPosition = candidate;
        }
      });
    }

    const { x: visualOffsetX, y: visualOffsetY } = getOffsetByPosition(finalPosition);

    const localRad = (-angle * Math.PI) / 180;
    const localX = visualOffsetX * Math.cos(localRad) - visualOffsetY * Math.sin(localRad);
    const localY = visualOffsetX * Math.sin(localRad) + visualOffsetY * Math.cos(localRad);

    node.setAttrs({
      label: {
        refX: 0.5, refY: 0.5, refX2: localX, refY2: localY,
        textAnchor: 'middle', textVerticalAnchor: 'middle',
        transform: `rotate(${-angle})`,
      }
    });
  };

  const performCopy = (targetCell?: Cell) => {
    const graph = graphRef.current;
    if (!graph) return;
    try {
      let cells = graph.getSelectedCells();
      if (cells.length === 0 && targetCell) {
        cells = [targetCell];
        graph.select(targetCell);
      }
      if (cells.length === 0) {
        message.info('请先选中要复制的对象');
        return;
      }
      const cellsToCopy = cells.filter(cell => !cell.getData()?.isBackground && cell.isNode());
      if (cellsToCopy.length === 0) {
        message.warning('没有可复制的设备对象 (管线已忽略)');
        return;
      }
      const jsonList = cellsToCopy.map(cell => {
        try {
          const safeData = cell.getData() ? JSON.parse(JSON.stringify(cell.getData())) : {};
          if (cell.isNode()) {
            return {
              id: cell.id, shape: cell.shape, position: cell.getPosition(), size: cell.getSize(),
              angle: cell.getAngle(), zIndex: cell.getZIndex(), attrs: cell.getAttrs(),
              data: safeData, ports: cell.getPorts(), 
            };
          }
          return null;
        } catch { return null; }
      }).filter(item => item !== null);

      if (jsonList.length > 0) {
        clipboardRef.current = jsonList;
        message.destroy();
        message.success(`已复制 ${jsonList.length} 个设备`);
      } else {
        message.error('复制失败：无法提取对象数据');
      }
    } catch (e) {
      console.error('Copy critical error:', e);
      message.error('复制操作失败');
    }
  };

  const performPaste = (offsetPoint?: { x: number, y: number }) => {
    const graph = graphRef.current;
    if (!graph || !clipboardRef.current || clipboardRef.current.length === 0) return;
    try {
      const cellsJSON = clipboardRef.current;
      let dx = 20;
      let dy = 20;
      if (offsetPoint) {
        const nodesOnly = cellsJSON.filter((c) => {
          const position = c.position as { x?: unknown } | undefined;
          return position && typeof position.x === 'number';
        });
        if (nodesOnly.length > 0) {
          const minX = Math.min(...nodesOnly.map((c) => (c.position as { x: number }).x));
          const minY = Math.min(...nodesOnly.map((c) => (c.position as { y: number }).y));
          dx = offsetPoint.x - minX;
          dy = offsetPoint.y - minY;
        }
      }
      graph.cleanSelection();
      const newCells: Cell[] = [];
      const idMap: Record<string, string> = {};
      const cleanData = (obj: unknown): unknown => {
        if (obj === null || obj === undefined) return {};
        if (typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) return obj.map(cleanData);
        const res: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(obj)) {
          if (value !== undefined && value !== null) {
            res[key] = cleanData(value);
          }
        }
        return res;
      };
      cellsJSON.forEach((cellData) => {
        if (!cellData.position) return;
        try {
          const oldId = cellData.id;
          const { id, zIndex, ...otherData } = cellData;
          void id;
          const safeData = cleanData(otherData.data || {}) as Record<string, unknown>;
          const safeAttrs = cleanData(otherData.attrs || {}) as Cell.Metadata['attrs'];
          const newNode = graph.createNode({
            ...otherData, data: safeData, attrs: safeAttrs,
            x: otherData.position.x + dx,
            y: otherData.position.y + dy,
            zIndex: (zIndex || 2) + 1
          });
          idMap[oldId] = newNode.id;
          newCells.push(newNode);
        } catch (nodeErr) { console.error('Failed to create node:', nodeErr); }
      });
      if (newCells.length > 0) {
        graph.addCell(newCells);
        graph.select(newCells);
        message.success(`已粘贴 ${newCells.length} 个设备`);
      }
      if (!offsetPoint) {
         clipboardRef.current = cellsJSON.map((c) => {
           if (c.position) {
             return { ...c, position: { x: c.position.x + 20, y: c.position.y + 20 } };
           }
           return c;
         });
      }
    } catch (e) {
      console.error('Paste critical error:', e);
      message.error('粘贴操作异常');
    }
  };

  const onUndo = () => historyRef.current?.undo();
  const onRedo = () => historyRef.current?.redo();
  const onZoom = (f: number) => graphRef.current?.zoom(f);
  const onZoomToFit = () => graphRef.current?.zoomToFit({ padding: 10 });
  const onZoomReset = () => graphRef.current?.zoomTo(1);
  const onClear = () => {
    Modal.confirm({
      title: '清空画布', content: '确定要清空吗？图框将被保留。', okType: 'danger',
      onOk: () => {
        if (!graphRef.current) return;
        const cellsToRemove = graphRef.current.getCells().filter(cell => !cell.getData()?.isBackground);
        graphRef.current.removeCells(cellsToRemove);
        setSelectedCell(null);
      },
    });
  };

  const handleMenuAction = (action: string) => {
    const { cellId } = menu;
    const graph = graphRef.current;
    if (!graph) return;
    const cell = cellId ? graph.getCellById(cellId) : null;
    if (action.startsWith('label:')) {
      if (cell && cell.isNode()) {
        const position = action.split(':')[1];
        cell.setData({ ...(cell.getData() || {}), labelPosition: position, labelPinned: true });
        message.success(`位号位置已更新`);
      }
      return;
    }
    switch (action) {
      case 'copy': 
        if (cell && !graph.isSelected(cell)) { graph.resetSelection(cell); }
        performCopy(cell || undefined); 
        break;
      case 'paste': {
        const point = graph.clientToLocal({ x: menu.x, y: menu.y }); 
        performPaste(point); 
        break;
      }
      case 'property': message.success('已定位到属性面板'); break;
      case 'clear': onClear(); break;
      case 'fit': onZoomToFit(); break;
      case 'delete': {
        const selected = graph.getSelectedCells();
        if (selected.length > 0) { graph.removeCells(selected); } else if (cell) { graph.removeCell(cell); }
        break;
      }
      case 'rotate': 
        if (cell && cell.isNode() && !cell.getData()?.isBackground) { cell.rotate(90); } break;
    }
  };

  // --- 初始化 Graph ---
  useEffect(() => {
    if (!containerRef.current || !stencilRef.current) return;
    stencilRef.current.innerHTML = '';

    const graph = new Graph({
      container: containerRef.current,
      autoResize: true,
      grid: { size: 10, visible: true, type: 'doubleMesh', args: [{ color: '#eee' }, { color: '#ddd', factor: 4 }] },
      panning: { enabled: true, eventTypes: ['rightMouseDown'] },
      mousewheel: { enabled: true, zoomAtMousePosition: true, modifiers: null, factor: 1.1, maxScale: 3, minScale: 0.1 },
      interacting: {
        nodeMovable: (view) => !view.cell.getData()?.isBackground,
        magnetConnectable: (view) => !view.cell.getData()?.isBackground,
      },
      connecting: {
        router: { name: 'manhattan', args: { padding: 10, excludeNodes: ['SHEET_FRAME_A2'] } },
        connector: { name: 'rounded', args: { radius: 8 } },
        anchor: 'center', connectionPoint: 'anchor', snap: true, allowBlank: false, allowEdge: true, highlight: true,
        validateConnection: ({ sourceView, targetView, sourceMagnet, targetMagnet }) => {
          if (!sourceView || !targetView || !sourceMagnet) return false;
          if (sourceView === targetView) return false;
          if (targetView.isEdgeElement()) {
            const sourceNode = sourceView.cell as Node;
            if (sourceNode.getData()?.type === 'Instrument') return true;
            return false;
          }
          if (!targetMagnet) return false;
          const sourcePortId = sourceMagnet.getAttribute('port');
          const targetPortId = targetMagnet.getAttribute('port');
          if (!sourcePortId || !targetPortId) return false;
          const sourceNode = sourceView.cell as Node;
          const targetNode = targetView.cell as Node;
          const sDir = getPortDirection(sourceNode, sourcePortId);
          const tDir = getPortDirection(targetNode, targetPortId);
          if (sDir === 'in' || tDir === 'out') return false;
          const sourceFace = getPortFace(sourceNode, sourcePortId);
          const targetFace = getPortFace(targetNode, targetPortId);
          if (isFaceOpposite(sourceFace, targetFace)) return true;
          return sDir === 'bi' || tDir === 'bi';
        },
        createEdge(args) {
          let data = {
            type: 'Pipe',
            material: 'CS',
            fluid: 'Water',
            dn: 'DN50',
            pn: 'PN16',
            dnSpec: { series: 'DN', value: '50', unit: 'mm' },
            pnSpec: { series: 'PN', value: '16', unit: 'bar' },
            insulation: 'None'
          };
          if (args.sourceCell) {
            const cell = args.sourceCell;
            const connectedEdges = this.getConnectedEdges(cell);
            const pipes = connectedEdges.filter(e => e.getData()?.type === 'Pipe');
            if (pipes.length > 0) {
              const lastPipe = pipes[pipes.length - 1];
              const lastData = lastPipe.getData() || {};
              data = {
                ...data,
                material: lastData.material || data.material,
                fluid: lastData.fluid || data.fluid,
                dn: lastData.dn || data.dn,
                pn: lastData.pn || data.pn,
                dnSpec: ((lastData as Record<string, unknown>).dnSpec && typeof (lastData as Record<string, unknown>).dnSpec === 'object'
                  ? (lastData as Record<string, unknown>).dnSpec
                  : data.dnSpec) as { series: string; value: string; unit: string },
                pnSpec: ((lastData as Record<string, unknown>).pnSpec && typeof (lastData as Record<string, unknown>).pnSpec === 'object'
                  ? (lastData as Record<string, unknown>).pnSpec
                  : data.pnSpec) as { series: string; value: string; unit: string },
                insulation: lastData.insulation || data.insulation
              };
            }
          }
          const color = FLUID_COLORS[data.fluid] || '#5F95FF';
          return this.createEdge({
            shape: 'edge',
            attrs: { line: { stroke: color, strokeWidth: 2, targetMarker: { name: 'classic', width: 8, height: 6 } } },
            labels: [], data: data
          });
        },
      },
    });
    graphRef.current = graph;

    graph.on('node:change:angle', ({ node }) => updateNodeLabel(node as Node));
    graph.on('node:change:position', ({ node }) => updateNodeLabel(node as Node));
    graph.on('node:change:data', ({ node }) => updateNodeLabel(node as Node));
    const refreshAllNodeLabels = () => {
      graph.getNodes().forEach((n) => {
        if (!n.getData()?.isBackground) {
          updateNodeLabel(n as Node);
        }
      });
    };
    graph.on('edge:change:vertices', refreshAllNodeLabels);
    graph.on('edge:change:source', refreshAllNodeLabels);
    graph.on('edge:change:target', refreshAllNodeLabels);

    const parsePortCoord = (
      value: unknown,
      total: number,
    ) => {
      if (typeof value === 'string' && value.endsWith('%')) {
        const parsed = parseFloat(value);
        return Number.isFinite(parsed) ? (parsed / 100) * total : 0;
      }
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }
      return 0;
    };

    type PortFace = 'top' | 'right' | 'bottom' | 'left';

    const movePointByFace = (point: { x: number; y: number }, face: PortFace, distance: number) => {
      if (face === 'top') return { x: point.x, y: point.y - distance };
      if (face === 'right') return { x: point.x + distance, y: point.y };
      if (face === 'bottom') return { x: point.x, y: point.y + distance };
      return { x: point.x - distance, y: point.y };
    };

    const getPortAbsolutePosition = (node: Node, portId: string) => {
      const port = node.getPort(portId);
      if (!port) return null;
      const pos = node.getPosition();
      const size = node.getSize();
      const angle = node.getAngle();
      const cx = pos.x + size.width / 2;
      const cy = pos.y + size.height / 2;
      const rad = (angle * Math.PI) / 180;
      const args = node.getPortProp(portId, 'args') as { x?: unknown; y?: unknown } | undefined;
      const relX = parsePortCoord(args?.x, size.width);
      const relY = parsePortCoord(args?.y, size.height);
      const absoluteX = pos.x + relX;
      const absoluteY = pos.y + relY;
      return {
        x: (absoluteX - cx) * Math.cos(rad) - (absoluteY - cy) * Math.sin(rad) + cx,
        y: (absoluteX - cx) * Math.sin(rad) + (absoluteY - cy) * Math.cos(rad) + cy,
      };
    };

    const getExpectedPortFace = (node: Node, point: { x: number; y: number }): PortFace => {
      const bbox = node.getBBox();
      const cx = bbox.x + bbox.width / 2;
      const cy = bbox.y + bbox.height / 2;
      const dx = point.x - cx;
      const dy = point.y - cy;
      if (Math.abs(dx) >= Math.abs(dy)) {
        return dx >= 0 ? 'right' : 'left';
      }
      return dy >= 0 ? 'bottom' : 'top';
    };

    const getPortFace = (node: Node, portId: string): PortFace => {
      const portPos = getPortAbsolutePosition(node, portId);
      const bbox = node.getBBox();
      if (!portPos) return 'right';
      const distances: Record<PortFace, number> = {
        top: Math.abs(portPos.y - bbox.y),
        right: Math.abs(portPos.x - (bbox.x + bbox.width)),
        bottom: Math.abs(portPos.y - (bbox.y + bbox.height)),
        left: Math.abs(portPos.x - bbox.x),
      };
      let bestFace: PortFace = 'right';
      let minDist = distances.right;
      (['top', 'bottom', 'left'] as PortFace[]).forEach((face) => {
        if (distances[face] < minDist) {
          minDist = distances[face];
          bestFace = face;
        }
      });
      return bestFace;
    };

    const getPortDirection = (node: Node, portId: string) => {
      const port = node.getPort(portId);
      return port?.data?.dir || 'bi';
    };

    const isFaceOpposite = (sourceFace: PortFace, targetFace: PortFace) => {
      const opposite: Record<PortFace, PortFace> = {
        top: 'bottom',
        right: 'left',
        bottom: 'top',
        left: 'right',
      };
      return opposite[sourceFace] === targetFace;
    };

    const getBestPortId = (
      node: Node,
      point: { x: number; y: number },
      peerPoint: { x: number; y: number } | null,
      role: 'source' | 'target',
    ) => {
      const ports = node.getPorts();
      if (!ports.length) return undefined;
      const firstPortId = ports.find((port) => typeof port.id === 'string')?.id;
      if (!firstPortId) return undefined;
      const connectedEdges = graph.getConnectedEdges(node);
      const expectedFace = getExpectedPortFace(node, peerPoint || point);
      let bestScore = Infinity;
      let bestPortId = firstPortId;
      ports.forEach((port) => {
        const portId = port.id;
        if (!portId) return;
        const portPos = getPortAbsolutePosition(node, portId);
        if (!portPos) return;
        const dist = Math.hypot(portPos.x - point.x, portPos.y - point.y);
        const direction = getPortDirection(node, portId);
        const directionPenalty = role === 'source'
          ? (direction === 'in' ? 10000 : 0)
          : (direction === 'out' ? 10000 : 0);
        const face = getPortFace(node, portId);
        const facePenalty = face === expectedFace ? 0 : (isFaceOpposite(face, expectedFace) ? 25 : 70);
        const occupancy = connectedEdges.filter((edge) => {
          const sourcePortId = edge.getSourcePortId();
          const targetPortId = edge.getTargetPortId();
          return sourcePortId === portId || targetPortId === portId;
        }).length;
        const occupancyPenalty = occupancy * 20;
        const score = dist + directionPenalty + facePenalty + occupancyPenalty;
        if (score < bestScore) {
          bestScore = score;
          bestPortId = portId;
        }
      });
      return bestPortId;
    };

    const applyPortStubVertices = (edge: Edge) => {
      const sourceNode = edge.getSourceNode();
      const targetNode = edge.getTargetNode();
      const sourcePortId = edge.getSourcePortId();
      const targetPortId = edge.getTargetPortId();
      if (!sourceNode || !targetNode || !sourcePortId || !targetPortId) return;
      const sourcePoint = getPortAbsolutePosition(sourceNode, sourcePortId);
      const targetPoint = getPortAbsolutePosition(targetNode, targetPortId);
      if (!sourcePoint || !targetPoint) return;
      const sourceFace = getPortFace(sourceNode, sourcePortId);
      const targetFace = getPortFace(targetNode, targetPortId);
      const STUB_LENGTH = 14;
      const sourceStub = movePointByFace(sourcePoint, sourceFace, STUB_LENGTH);
      const targetStub = movePointByFace(targetPoint, targetFace, STUB_LENGTH);
      if (Math.hypot(sourceStub.x - targetStub.x, sourceStub.y - targetStub.y) < 12) return;
      edge.setVertices([sourceStub, targetStub]);
    };

    const handlePipeSplit = (node: Node) => {
      if (isLoadingRef.current) return;
      const nodeType = node.getData()?.type;
      if (!INLINE_TYPES.includes(nodeType)) return; 
      
      const connectedEdges = graph.getConnectedEdges(node);
      if (connectedEdges.length > 0) return; 

      const nodeBBox = node.getBBox();
      const allEdges = graph.getEdges();
      const ports = node.getPorts(); // 获取所有端口

      // 定义吸附阈值 (像素)
      const SNAP_THRESHOLD = 25; 

      // 1. 找出最佳匹配的管线
      type GraphPoint = ReturnType<Edge['getSourcePoint']>;
      type Candidate = {
        edge: Edge;
        distance: number;
        closestPoint: GraphPoint;
        refPortId: string;
      };
      const candidates: Candidate[] = [];
      allEdges.forEach((edge) => {
        if (edge.getData()?.type === 'Signal') return;
        if (!edge.getBBox().intersectsWithRect(nodeBBox)) return;

        const view = graph.findViewByCell(edge);
        if (!view) return;

        let minPortDist = Infinity;
        let minPortScore = Infinity;
        let bestPortId: string | null = null;
        let bestClosestPoint: GraphPoint | null = null;

        ports.forEach((port) => {
          if (!port.id) return;
          const portPos = node.getPortProp(port.id, 'args') as { x?: unknown; y?: unknown } | undefined;
          const px = nodeBBox.x + parsePortCoord(portPos?.x, nodeBBox.width);
          const py = nodeBBox.y + parsePortCoord(portPos?.y, nodeBBox.height);

          const closestGetter = view as { getClosestPoint?: (point: { x: number; y: number }) => GraphPoint };
          if (!closestGetter.getClosestPoint) return;
          const closest = closestGetter.getClosestPoint({ x: px, y: py });
          const dist = Math.hypot(closest.x - px, closest.y - py);
          const facePenalty = getPortFace(node, port.id) === getExpectedPortFace(node, closest) ? 0 : 50;
          const score = dist + facePenalty;
          if (score < minPortScore) {
            minPortScore = score;
            minPortDist = dist;
            bestPortId = port.id;
            bestClosestPoint = closest;
          }
        });

        if (!bestClosestPoint || !bestPortId || minPortDist > SNAP_THRESHOLD) return;
        candidates.push({
          edge,
          distance: minPortDist,
          closestPoint: bestClosestPoint,
          refPortId: bestPortId,
        });
      });
      candidates.sort((a, b) => a.distance - b.distance);

      if (candidates.length === 0) return;

      const bestMatch = candidates[0];
      const targetEdge = bestMatch.edge;
      const closestPoint = bestMatch.closestPoint;
      const refPortId = bestMatch.refPortId;

      if (targetEdge) {
        const targetView = graph.findViewByCell(targetEdge);
        if (!targetView) return;
        
        const routePoints = Array.isArray((targetView as { routePoints?: unknown }).routePoints)
          ? ((targetView as unknown as { routePoints: GraphPoint[] }).routePoints)
          : [];
        const points = [targetEdge.getSourcePoint(), ...routePoints, targetEdge.getTargetPoint()];
        
        let isPipeHorizontal = true; 
        let foundSegment = false;
        let segmentStart = targetEdge.getSourcePoint();
        let segmentEnd = targetEdge.getTargetPoint();

        // 寻找最近点所在的线段
        for (let i = 0; i < points.length - 1; i++) {
          const p1 = points[i];
          const p2 = points[i + 1];
          const buffer = 2;
          const minX = Math.min(p1.x, p2.x) - buffer;
          const maxX = Math.max(p1.x, p2.x) + buffer;
          const minY = Math.min(p1.y, p2.y) - buffer;
          const maxY = Math.max(p1.y, p2.y) + buffer;

          if (closestPoint.x >= minX && closestPoint.x <= maxX && closestPoint.y >= minY && closestPoint.y <= maxY) {
            if (Math.abs(p1.y - p2.y) < 5) { isPipeHorizontal = true; } else { isPipeHorizontal = false; }
            foundSegment = true;
            segmentStart = p1;
            segmentEnd = p2;
            break; 
          }
        }

        if (!foundSegment) {
           const src = targetEdge.getSourcePoint();
           const tgt = targetEdge.getTargetPoint();
           isPipeHorizontal = Math.abs(src.x - tgt.x) > Math.abs(src.y - tgt.y);
           segmentStart = src;
           segmentEnd = tgt;
        }

        // 校验方向 (保持不变)
        const angle = node.getAngle();
        const normalizedAngle = (angle % 360 + 360) % 360;
        const isValveHorizontal = (normalizedAngle < 10 || normalizedAngle > 350) || (normalizedAngle > 170 && normalizedAngle < 190);
        if (nodeType !== 'Fitting' && isValveHorizontal !== isPipeHorizontal) return; 

        // ============================================================
        // [核心修改] 基于端口位置修正节点坐标
        // ============================================================
        
        // 获取参考端口相对于节点左上角的偏移量
        const portArgs = node.getPortProp(refPortId, 'args') as { x?: unknown; y?: unknown } | undefined;
        const portOffsetX = parsePortCoord(portArgs?.x, nodeBBox.width);
        const portOffsetY = parsePortCoord(portArgs?.y, nodeBBox.height);

        let newX = nodeBBox.x;
        let newY = nodeBBox.y;

        if (isPipeHorizontal) {
          const pipeY = closestPoint.y;
          // 目标：让端口的 Y 坐标等于 pipeY
          // nodeY + portOffsetY = pipeY  =>  nodeY = pipeY - portOffsetY
          newY = Math.round((pipeY - portOffsetY) / 10) * 10; 
          // X 轴保持当前拖拽位置 (对齐网格)
          newX = Math.round(nodeBBox.x / 10) * 10; 
        } else {
          const pipeX = closestPoint.x;
          // 目标：让端口的 X 坐标等于 pipeX
          // nodeX + portOffsetX = pipeX => nodeX = pipeX - portOffsetX
          newX = Math.round((pipeX - portOffsetX) / 10) * 10;
          // Y 轴保持当前拖拽位置
          newY = Math.round(nodeBBox.y / 10) * 10; 
        }
        
        node.setPosition(newX, newY);

        // ... (后续打断连线逻辑保持不变)
        const portForSource = getBestPortId(node, segmentStart, segmentEnd, 'source');
        const portForTarget = getBestPortId(node, segmentEnd, segmentStart, 'target');
        
        if (!portForSource || !portForTarget) {
          console.warn('无法找到合适的连接端口');
          return;
        }

        const source = targetEdge.getSource();
        const target = targetEdge.getTarget();
        const edgeData = targetEdge.getData();
        const edgeAttrs = targetEdge.getAttrs(); 
        const sourceCellId = typeof source === 'object' && source !== null && 'cell' in source
          ? (source as { cell?: string }).cell ?? ''
          : '';
        const targetCellId = typeof target === 'object' && target !== null && 'cell' in target
          ? (target as { cell?: string }).cell ?? ''
          : '';

        graph.removeCell(targetEdge);

        const exclude1 = ['SHEET_FRAME_A2', node.id];
        if (isInlineComponent(sourceCellId)) exclude1.push(sourceCellId);
        
        const exclude2 = ['SHEET_FRAME_A2', node.id];
        if (isInlineComponent(targetCellId)) exclude2.push(targetCellId);

        const router1 = { name: 'manhattan', args: { padding: 10, excludeNodes: exclude1 } };
        const router2 = { name: 'manhattan', args: { padding: 10, excludeNodes: exclude2 } };

        const edge1 = graph.createEdge({
          shape: 'edge', source: source, target: { cell: node.id, port: portForSource }, 
          data: { ...edgeData }, attrs: edgeAttrs, labels: [], router: router1 
        });

        const edge2 = graph.createEdge({
          shape: 'edge', source: { cell: node.id, port: portForTarget }, target: target,
          data: { ...edgeData }, attrs: edgeAttrs, labels: [], router: router2 
        });

        applyPortStubVertices(edge1);
        applyPortStubVertices(edge2);
        graph.addCell([edge1, edge2]);
        message.success('元件已接入管线');
      }
    };

    const handleSignalDrop = (args: { e: MouseEvent; edge: Edge }) => {
      if (isLoadingRef.current) return;
      const { e, edge } = args;
      const sourceNode = edge.getSourceNode();
      if (sourceNode?.getData()?.type !== 'Instrument') return;
      const sourcePortId = edge.getSourcePortId(); 
      let hitPipe: Edge | null = null;
      const point = graph.clientToLocal(e.clientX, e.clientY);
      const targetCell = edge.getTargetCell();
      if (targetCell && targetCell.isEdge()) {
        hitPipe = targetCell as Edge;
      } else {
        if (edge.getTargetNode()) return; 
        const views = graph.findViewsFromPoint(point);
        const pipeView = views.find(v => v.isEdgeElement() && v.cell.id !== edge.id && v.cell.getData()?.type !== 'Signal');
        if (pipeView) hitPipe = pipeView.cell as Edge;
      }
      if (hitPipe) {
        const src = hitPipe.getSourcePoint();
        const tgt = hitPipe.getTargetPoint();
        let tapX = point.x;
        let tapY = point.y;
        const isHorizontal = Math.abs(src.y - tgt.y) < 5; 
        const isVertical = Math.abs(src.x - tgt.x) < 5;
        if (isHorizontal) { tapY = src.y; tapX = Math.round(point.x / 10) * 10; } 
        else if (isVertical) { tapX = src.x; tapY = Math.round(point.y / 10) * 10; } 
        else { tapX = Math.round(point.x / 10) * 10; tapY = Math.round(point.y / 10) * 10; }
        const tappingPoint = graph.createNode({
          shape: 'tapping-point', x: tapX - 6, y: tapY - 6, data: { type: 'TappingPoint' },
          zIndex: 10 
        });
        graph.removeCell(edge); 
        const signalEdge = graph.createEdge({
          shape: 'signal-edge', source: { cell: tappingPoint.id },  target: { cell: sourceNode.id, port: sourcePortId },
          data: { 
            type: 'Signal', relationType: 'MEASURES', fluid: 'Signal',
            material: undefined, dn: undefined, pn: undefined, insulation: undefined
          }
        });
        const source = hitPipe.getSource();
        const target = hitPipe.getTarget();
        const pipeData = hitPipe.getData();
        const pipeAttrs = hitPipe.getAttrs(); 
        graph.removeCell(hitPipe);
        const pipe1 = graph.createEdge({
          shape: 'edge', source: source, target: { cell: tappingPoint.id },
          data: pipeData, attrs: pipeAttrs, labels: []
        });
        const pipe2 = graph.createEdge({
          shape: 'edge', source: { cell: tappingPoint.id }, target: target,
          data: pipeData, attrs: pipeAttrs, labels: []
        });
        graph.addCell([tappingPoint, pipe1, pipe2, signalEdge]);
        setTimeout(refreshRouting, 50);
        message.success('已生成测点');
      } else {
        if (!edge.getTargetCell()) graph.removeCell(edge);
      }
    };

    graph.on('node:added', ({ node }) => {
      if (isLoadingRef.current) return;
      ensureNodeTypeTag(node as Node);
      setTimeout(() => {
        if (isLoadingRef.current) return;
        handlePipeSplit(node as Node);
      }, 50);
    });
    graph.on('node:mouseup', ({ node }) => handlePipeSplit(node as Node));
    graph.on('edge:mouseup', handleSignalDrop); 

    graph.on('edge:connected', ({ edge }) => {
      const sourceNode = edge.getSourceNode();
      const targetPortId = edge.getTargetPortId();
      const isSourceInstrument = sourceNode?.getData()?.type === 'Instrument';
      const isTargetActuator = targetPortId === 'actuator';
      if (isSourceInstrument || isTargetActuator) {
        edge.setAttrs({
          line: { stroke: '#888', strokeWidth: 1, strokeDasharray: '4 4', targetMarker: { name: 'classic', size: 3 } } 
        });
        edge.setData({ type: 'Signal', fluid: 'Signal', relationType: isTargetActuator ? 'CONTROLS' : 'MEASURES' });
        if (isTargetActuator) edge.setRouter('manhattan', { padding: 10 });
      } else {
        applyPortStubVertices(edge);
        refreshRouting();
      }
      refreshAllNodeLabels();
    });

    graph.use(new Selection({ enabled: true, multiple: true, rubberband: true, movable: true, showNodeSelectionBox: true, filter: (cell) => !cell.getData()?.isBackground }));
    graph.use(new Keyboard({ enabled: true }));
    graph.use(new Transform({ resizing: { enabled: true }, rotating: { enabled: true, grid: 15 } }));
    const history = new History({ enabled: true });
    graph.use(history);
    historyRef.current = history;
    graph.on('history:change', () => { setCanUndo(history.canUndo()); setCanRedo(history.canRedo()); });

    graph.bindKey(['meta+c', 'ctrl+c'], () => { performCopy(); return false; });
    graph.bindKey(['meta+v', 'ctrl+v'], () => { performPaste(); return false; });
    graph.bindKey(['backspace', 'delete'], () => { const cells = graph.getSelectedCells().filter(c => !c.getData()?.isBackground); if (cells.length) graph.removeCells(cells); });

    graph.on('cell:click', ({ cell }) => {
      if (cell.getData()?.isBackground) { setSelectedCell(null); graph.getEdges().forEach(edge => edge.removeTools()); return; }
      setSelectedCell(cell);
      setInspectorFocusHint(null);
      if (cell.isEdge()) { cell.attr('line/strokeWidth', 3); }
      graph.getEdges().forEach(edge => { if (edge.id !== cell.id) { edge.attr('line/strokeWidth', 2); edge.removeTools(); } });
      if (cell.isEdge() && cell.getData()?.type === 'Pipe') {
        cell.addTools([{ name: 'vertices', args: { attrs: { fill: '#666' } } }, { name: 'segments', args: { snapRadius: 20, attrs: { fill: '#444' } } }]);
      }
    });
    
    graph.on('blank:click', () => { setSelectedCell(null); setInspectorFocusHint(null); graph.getEdges().forEach(edge => { edge.attr('line/strokeWidth', 2); edge.removeTools(); }); });
    graph.on('cell:contextmenu', ({ e, cell }) => { if (cell.getData()?.isBackground) return; setMenu({ visible: true, x: e.clientX, y: e.clientY, type: cell.isNode() ? 'node' : 'edge', cellId: cell.id }); });
    graph.on('blank:contextmenu', ({ e }) => { setMenu({ visible: true, x: e.clientX, y: e.clientY, type: 'blank' }); });

    const RECENT_STENCIL_KEY = 'editor.stencil.recent.v1';
    const RECENT_LIMIT = 10;
    const STENCIL_GROUPS = [
      { title: '最近使用', name: 'recent', layoutOptions: { columns: 2, columnWidth: 105, rowHeight: 100 } },
      { title: '反应设备', name: 'reaction', layoutOptions: { columns: 2, columnWidth: 105, rowHeight: 100 } },
      { title: '换热设备', name: 'heat_transfer', layoutOptions: { columns: 2, columnWidth: 105, rowHeight: 100 } },
      { title: '分离与储存', name: 'separation_storage', layoutOptions: { columns: 2, columnWidth: 105, rowHeight: 100 } },
      { title: '输送设备', name: 'transfer', layoutOptions: { columns: 2, columnWidth: 105, rowHeight: 100 } },
      { title: '仪表控制', name: 'instrumentation', layoutOptions: { columns: 3, columnWidth: 60, rowHeight: 70 } },
      { title: '管道附件', name: 'piping_parts', layoutOptions: { columns: 2, columnWidth: 105, rowHeight: 88 } },
    ] as const;
    type StencilGroupName = typeof STENCIL_GROUPS[number]['name'];

    const TYPE_TO_GROUP: Record<string, StencilGroupName | 'ignore'> = {
      Reactor: 'reaction',
      FixedBedReactor: 'reaction',
      Exchanger: 'heat_transfer',
      VerticalExchanger: 'heat_transfer',
      Evaporator: 'heat_transfer',
      GasCooler: 'heat_transfer',
      Trap: 'heat_transfer',
      Tank: 'separation_storage',
      Separator: 'separation_storage',
      Pump: 'transfer',
      LiquidPump: 'transfer',
      CentrifugalPump: 'transfer',
      DiaphragmPump: 'transfer',
      PistonPump: 'transfer',
      GearPump: 'transfer',
      Compressor: 'transfer',
      Fan: 'transfer',
      JetPump: 'transfer',
      Instrument: 'instrumentation',
      Valve: 'piping_parts',
      ControlValve: 'piping_parts',
      ManualValve: 'piping_parts',
      Fitting: 'piping_parts',
      OffPageConnector: 'piping_parts',
      TappingPoint: 'ignore',
      Frame: 'ignore',
    };

    const getRecentShapeIds = (): string[] => {
      try {
        const raw = localStorage.getItem(RECENT_STENCIL_KEY);
        if (!raw) return [];
        const arr = JSON.parse(raw);
        if (!Array.isArray(arr)) return [];
        return arr.filter((id): id is string => typeof id === 'string' && id in SHAPE_LIBRARY).slice(0, RECENT_LIMIT);
      } catch {
        return [];
      }
    };

    const saveRecentShapeIds = (ids: string[]) => {
      try {
        localStorage.setItem(RECENT_STENCIL_KEY, JSON.stringify(ids.slice(0, RECENT_LIMIT)));
      } catch {
        // ignore localStorage write failure
      }
    };

    const resolveGroupByType = (type: string): StencilGroupName | 'ignore' => {
      const mapped = TYPE_TO_GROUP[type];
      if (mapped) return mapped;
      if (/reactor/i.test(type)) return 'reaction';
      if (/exchanger|evaporator|cooler|heater/i.test(type)) return 'heat_transfer';
      if (/tank|separator|vessel|drum/i.test(type)) return 'separation_storage';
      if (/pump|compressor|fan|blower/i.test(type)) return 'transfer';
      if (/instrument|transmitter|controller/i.test(type)) return 'instrumentation';
      if (/valve|fitting|connector|pipe/i.test(type)) return 'piping_parts';
      return 'piping_parts';
    };

    const buildStencilNodesByGroup = (recentShapeIds: string[]): Record<StencilGroupName, Node[]> => {
      const nodesByGroup = STENCIL_GROUPS.reduce<Record<StencilGroupName, Node[]>>((acc, group) => {
        acc[group.name] = [];
        return acc;
      }, {} as Record<StencilGroupName, Node[]>);

      const typeCounts: Record<string, number> = {};
      Object.values(SHAPE_LIBRARY).forEach((config) => {
        const t = typeof config.data?.type === 'string' ? config.data.type : 'Unknown';
        typeCounts[t] = (typeCounts[t] || 0) + 1;
      });
      const typeIterators: Record<string, number> = {};

      Object.keys(SHAPE_LIBRARY).forEach((shapeId) => {
        const config = SHAPE_LIBRARY[shapeId];
        const type = typeof config.data?.type === 'string' ? config.data.type : 'Unknown';
        const groupName = resolveGroupByType(type);
        if (groupName === 'ignore') return;

        const MAX_W = 70;
        const MAX_H = 70;
        const originalW = config.width || 80;
        const originalH = config.height || 80;
        let displayW = originalW;
        let displayH = originalH;
        if (originalW > MAX_W || originalH > MAX_H) {
          const ratio = originalW / originalH;
          if (ratio > 1) { displayW = MAX_W; displayH = displayW / ratio; } else { displayH = MAX_H; displayW = displayH * ratio; }
        }

        let displayLabel = type;
        if (type === 'Instrument') {
          displayLabel = typeof config.data?.tagId === 'string' ? config.data.tagId : 'Inst';
        } else if (typeCounts[type] > 1) {
          const parts = shapeId.split('-');
          let suffix = parts[parts.length - 1];
          if (type.toLowerCase().includes(suffix.toLowerCase())) {
            typeIterators[type] = (typeIterators[type] || 0) + 1;
            suffix = `${typeIterators[type]}`;
          } else {
            suffix = suffix.charAt(0).toUpperCase() + suffix.slice(1);
          }
          displayLabel = `${type} ${suffix}`;
        }

        const node = graph.createNode({
          shape: shapeId,
          width: displayW,
          height: displayH,
          label: displayLabel,
          attrs: { label: { fontSize: 10, refY: '100%', refY2: 4, textWrap: { width: 90, ellipsis: true } } },
          data: { ...config.data, originalSize: { width: originalW, height: originalH }, _paletteShapeId: shapeId },
        });
        nodesByGroup[groupName].push(node);
      });

      recentShapeIds.forEach((shapeId) => {
        const sourceNode = Object.values(nodesByGroup).flat().find((n) => n.shape === shapeId);
        if (sourceNode) nodesByGroup.recent.push(sourceNode.clone());
      });
      return nodesByGroup;
    };

    const stencil = new Stencil({
      title: '组件库',
      target: graph,
      stencilGraphWidth: 240,
      stencilGraphHeight: 0,
      collapsable: true,
      search: { visible: true, placeholder: '搜索图元 / 类型...' },
      groups: STENCIL_GROUPS as unknown as Array<{ title: string; name: string; layoutOptions: Record<string, unknown> }>,
      getDropNode(node) {
        const clone = node.clone();
        const data = clone.getData();
        const shapeId = typeof data?._paletteShapeId === 'string' ? data._paletteShapeId : '';
        if (shapeId) {
          const nextRecent = [shapeId, ...getRecentShapeIds().filter((id) => id !== shapeId)].slice(0, RECENT_LIMIT);
          saveRecentShapeIds(nextRecent);
          const nextNodes = buildStencilNodesByGroup(nextRecent);
          STENCIL_GROUPS.forEach((group) => {
            stencil.load(nextNodes[group.name], group.name);
          });
        }
        if (data?.originalSize) {
          clone.setSize(data.originalSize.width, data.originalSize.height);
          const { originalSize: _originalSize, _paletteShapeId: _paletteShapeId, ...rest } = data;
          void _originalSize;
          void _paletteShapeId;
          clone.setData(rest);
        }
        return clone;
      },
    });
    stencilRef.current.appendChild(stencil.container);

    const initialStencilNodes = buildStencilNodesByGroup(getRecentShapeIds());
    STENCIL_GROUPS.forEach((group) => {
      stencil.load(initialStencilNodes[group.name], group.name);
    });

    const setupBackgroundFrame = () => {
      if (graph.getNodes().some(n => n.getData()?.isBackground)) return;
      graph.addNode({ shape: 'drawing-frame-a2', id: 'SHEET_FRAME_A2', x: 0, y: 0, zIndex: -1, movable: false, selectable: false, data: { type: 'Frame', isBackground: true } });
    };

    // [修改] 监听 drawingId 变化加载数据
    const initCanvasData = async () => {
      if (!drawingId) return;
      isLoadingRef.current = true;
      
      // 清空画布 (保留背景框)
      const cellsToRemove = graph.getCells().filter(cell => !cell.getData()?.isBackground);
      graph.removeCells(cellsToRemove, { silent: true });
      setupBackgroundFrame();

      try {
        const data = await loadGraphData(drawingId);
        if (data && data.nodes.length > 0) {
          graph.fromJSON(data as Record<string, unknown>);
          graph.batchUpdate(() => {
            const nodes = graph.getNodes();
            const edges = graph.getEdges();
            nodes.forEach(node => {
              if (!node.getData()?.isBackground) {
                updateNodeLabel(node); 
                node.setZIndex(node.getData()?.type === 'TappingPoint' ? 10 : 2);     
              }
            });
            edges.forEach(edge => edge.setZIndex(1));
            refreshRouting();
          });
          setupBackgroundFrame();
          graph.centerContent();
          message.success('数据已恢复');
        } else {
          const ir = await loadDomainIR(drawingId);
          if (ir) {
            applyDomainIRToCanvas(graph, ir);
            setupBackgroundFrame();
            message.success('已从语义IR回放到画布');
          }
        }
        // 重置历史记录和脏状态
        if (historyRef.current) historyRef.current.clean();
        setDirty(false);
      } catch (error) {
        console.error('Data Load Error:', error);
        message.error('数据加载失败');
      } finally {
        isLoadingRef.current = false;
      }
    };
    
    initCanvasData();

    const stencilEl = stencilRef.current;
    return () => {
      graph.dispose();
      if (stencilEl) stencilEl.innerHTML = '';
    };
  }, [applyDomainIRToCanvas, drawingId, ensureNodeTypeTag, isInlineComponent, refreshRouting, setDirty]);

  // [新增] 监听脏状态 (History & Data Change)
  useEffect(() => {
    if (!graphRef.current) return;
    const graph = graphRef.current;

    const handleHistoryChange = () => {
      setDirty(true);
    };

    graph.on('history:change', handleHistoryChange);
    graph.on('node:change:data', handleHistoryChange);

    return () => {
      graph.off('history:change', handleHistoryChange);
      graph.off('node:change:data', handleHistoryChange);
    };
  }, [setDirty]);

  // [新增] 双击跳转逻辑 (增加脏检查)
  useEffect(() => {
    if (!graphRef.current) return;
    const handleNodeDblClick = ({ node }: { node: Node }) => {
      const data = node.getData();
      if (data?.type === 'OffPageConnector' && data.targetDrawingId) {
        const targetId = data.targetDrawingId;
        const targetName = drawings.find(d => d.id === targetId)?.name;
        
        const doSwitch = () => setCurrentDrawing(targetId);

        if (isDirty) {
          Modal.confirm({
            title: '未保存的更改',
            content: `当前图纸有未保存的修改，是否先保存再跳转到 "${targetName || 'Unknown'}"?`,
            okText: '保存并跳转',
            cancelText: '不保存直接跳转',
            onOk: async () => {
              try {
                if (drawingId) await executeSave(drawingId);
                doSwitch();
              } catch { /* save failed */ }
            },
            onCancel: () => {
              // 点击 Cancel 按钮视为“不保存直接跳转”
            },
            footer: (_, { OkBtn }) => (
              <>
                <Button onClick={() => Modal.destroyAll()}>取消</Button>
                <Button danger onClick={() => { Modal.destroyAll(); doSwitch(); }}>不保存</Button>
                <OkBtn />
              </>
            ),
          });
        } else {
          Modal.confirm({
            title: '跳转页面',
            content: `是否跳转到关联图纸 "${targetName || 'Unknown'}"?`,
            onOk: doSwitch
          });
        }
      }
    };
    graphRef.current.on('node:dblclick', handleNodeDblClick);
    return () => { graphRef.current?.off('node:dblclick', handleNodeDblClick); };
  }, [drawingId, isDirty, drawings, executeSave, setCurrentDrawing]); // 依赖 drawingId, isDirty, drawings

  return (
    <div className="editor-container">
      <div ref={stencilRef} className="stencil-container" />
      <div className="toolbar-container">
         <Tooltip title="撤销"><Button type="text" icon={<UndoOutlined />} disabled={!canUndo} onClick={onUndo} /></Tooltip>
         <Tooltip title="重做"><Button type="text" icon={<RedoOutlined />} disabled={!canRedo} onClick={onRedo} /></Tooltip>
         <div className="toolbar-sep"></div>
         <Tooltip title="放大"><Button type="text" icon={<ZoomInOutlined />} onClick={() => onZoom(0.1)} /></Tooltip>
         <Tooltip title="缩小"><Button type="text" icon={<ZoomOutOutlined />} onClick={() => onZoom(-0.1)} /></Tooltip>
         <Tooltip title="适应"><Button type="text" icon={<CompressOutlined />} onClick={onZoomToFit} /></Tooltip>
         <Tooltip title="1:1"><Button type="text" icon={<OneToOneOutlined />} onClick={onZoomReset} /></Tooltip>
         <div className="toolbar-sep"></div>
         <Tooltip title="清空"><Button type="text" danger icon={<ClearOutlined />} onClick={onClear} /></Tooltip>
      </div>
      <div ref={containerRef} className="canvas-container" />
      <div className="inspector-container"><Inspector cell={selectedCell} focusHint={inspectorFocusHint} /></div>
      <ContextMenu visible={menu.visible} x={menu.x} y={menu.y} type={menu.type} onClose={() => setMenu({ ...menu, visible: false })} onAction={handleMenuAction} />
    </div>
  );
});

export default GraphCanvas;
