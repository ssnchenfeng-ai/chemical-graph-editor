// src/components/Editor/Canvas/index.tsx
import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
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
import { saveGraphData, loadGraphData } from '../../../services/neo4j';
import { FLUID_COLORS, INLINE_TYPES } from '../../../config/rules';
import { SHAPE_LIBRARY } from '../../../graph/cells/registry';
import { useDrawingStore } from '../../../store/drawingStore'; // [新增] 引入 Store

export interface GraphCanvasRef {
  handleSave: (drawingId: string) => Promise<void>;
}

interface GraphCanvasProps {
  drawingId: string | null;
}

// 辅助函数：提取对象中的指定属性
const pick = (obj: any, keys: string[]) => {
  const ret: any = {};
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
  const clipboardRef = useRef<any>(null);

  const [selectedCell, setSelectedCell] = useState<Cell | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  
  const [menu, setMenu] = useState<MenuState>({ visible: false, x: 0, y: 0, type: null });

  // [新增] 获取 Store 方法
  const { setDirty, isDirty, setCurrentDrawing, drawings } = useDrawingStore();

  // --- 辅助函数：判断是否为在线元件 ---
  const isInlineComponent = (cellId: string) => {
    if (!graphRef.current) return false;
    const cell = graphRef.current.getCellById(cellId);
    if (!cell || !cell.isNode()) return false;
    return INLINE_TYPES.includes(cell.getData()?.type);
  };

  // --- 辅助函数：刷新所有管线的路由策略 ---
  const refreshRouting = () => {
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
  };

  // --- [重构] 核心保存逻辑 ---
  const executeSave = async (saveId: string) => {
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
          labelPosition: data.labelPosition || 'bottom' 
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
        insulation: data.insulation || 'None',
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
  };

  // --- 暴露给父组件的方法 ---
  useImperativeHandle(ref, () => ({
    handleSave: executeSave
  }));

   const updateNodeLabel = (node: Node) => {
    const data = node.getData() || {};
    const position = data.labelPosition || 'bottom'; 
    const angle = node.getAngle();
    const size = node.getSize();
    const PADDING = 15;
    const rad = (angle * Math.PI) / 180;
    const sin = Math.abs(Math.sin(rad));
    const cos = Math.abs(Math.cos(rad));
    const visualHalfW = (size.width * cos + size.height * sin) / 2;
    const visualHalfH = (size.width * sin + size.height * cos) / 2;

    let visualOffsetX = 0;
    let visualOffsetY = 0;

    switch (position) {
      case 'top': visualOffsetY = -(visualHalfH + PADDING); break;
      case 'bottom': visualOffsetY = (visualHalfH + PADDING); break;
      case 'left': visualOffsetX = -(visualHalfW + PADDING); break;
      case 'right': visualOffsetX = (visualHalfW + PADDING); break;
      case 'center': visualOffsetX = 0; visualOffsetY = 0; break;
    }

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
        } catch (err) { return null; }
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
        const nodesOnly = cellsJSON.filter((c: any) => c.position && typeof c.position.x === 'number');
        if (nodesOnly.length > 0) {
          const minX = Math.min(...nodesOnly.map((c: any) => c.position.x));
          const minY = Math.min(...nodesOnly.map((c: any) => c.position.y));
          dx = offsetPoint.x - minX;
          dy = offsetPoint.y - minY;
        }
      }
      graph.cleanSelection();
      const newCells: Cell[] = [];
      const idMap: Record<string, string> = {};
      const cleanData = (obj: any): any => {
        if (obj === null || obj === undefined) return {};
        if (typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) return obj.map(cleanData);
        const res: any = {};
        for (const key in obj) {
          if (obj[key] !== undefined && obj[key] !== null) {
            res[key] = cleanData(obj[key]);
          }
        }
        return res;
      };
      cellsJSON.forEach((cellData: any) => {
        if (!cellData.position) return;
        try {
          const oldId = cellData.id;
          const { id, zIndex, ...otherData } = cellData;
          const safeData = cleanData(otherData.data || {});
          const safeAttrs = cleanData(otherData.attrs || {});
          const newNode = graph.createNode({
            ...otherData, data: safeData, attrs: safeAttrs,
            x: (otherData.position.x) + dx, y: (otherData.position.y) + dy,
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
         clipboardRef.current = cellsJSON.map((c: any) => {
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
        cell.setData({ labelPosition: position });
        message.success(`位号位置已更新`);
      }
      return;
    }
    switch (action) {
      case 'copy': 
        if (cell && !graph.isSelected(cell)) { graph.resetSelection(cell); }
        performCopy(cell || undefined); 
        break;
      case 'paste': 
        const point = graph.clientToLocal({ x: menu.x, y: menu.y }); 
        performPaste(point); 
        break;
      case 'property': message.success('已定位到属性面板'); break;
      case 'clear': onClear(); break;
      case 'fit': onZoomToFit(); break;
      case 'delete': 
        const selected = graph.getSelectedCells();
        if (selected.length > 0) { graph.removeCells(selected); } else if (cell) { graph.removeCell(cell); }
        break;
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
          const sourcePort = sourceNode.getPort(sourcePortId);
          const targetPort = targetNode.getPort(targetPortId);
          const sDir = sourcePort?.data?.dir || 'bi';
          const tDir = targetPort?.data?.dir || 'bi';
          return sDir !== 'in' && tDir !== 'out';
        },
        createEdge(args) {
          let data = { type: 'Pipe', material: 'CS', fluid: 'Water', dn: 'DN50', pn: 'PN16', insulation: 'None' };
          if (args.sourceCell) {
            const cell = args.sourceCell;
            const connectedEdges = this.getConnectedEdges(cell);
            const pipes = connectedEdges.filter(e => e.getData()?.type === 'Pipe');
            if (pipes.length > 0) {
              const lastPipe = pipes[pipes.length - 1];
              const lastData = lastPipe.getData() || {};
              data = { ...data, material: lastData.material || data.material, fluid: lastData.fluid || data.fluid, dn: lastData.dn || data.dn, pn: lastData.pn || data.pn, insulation: lastData.insulation || data.insulation };
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
    graph.on('node:change:data', ({ node }) => updateNodeLabel(node as Node));

    const getClosestPortId = (node: Node, point: { x: number; y: number }) => {
      const ports = node.getPorts();
      if (!ports.length) return undefined;
      const pos = node.getPosition(); 
      const size = node.getSize();
      const angle = node.getAngle();
      const cx = pos.x + size.width / 2;
      const cy = pos.y + size.height / 2;
      const rad = (angle * Math.PI) / 180;
      let minDistance = Infinity;
      let closestPortId = ports[0].id;
      ports.forEach((port) => {
        const args = port.args || {};
        let relX = 0;
        let relY = 0;
        if (typeof args.x === 'string' && args.x.endsWith('%')) {
          relX = (parseFloat(args.x) / 100) * size.width;
        } else {
          relX = (args.x as number) || 0;
        }
        if (typeof args.y === 'string' && args.y.endsWith('%')) {
          relY = (parseFloat(args.y) / 100) * size.height;
        } else {
          relY = (args.y as number) || 0;
        }
        const absoluteX = pos.x + relX;
        const absoluteY = pos.y + relY;
        const rotatedX = (absoluteX - cx) * Math.cos(rad) - (absoluteY - cy) * Math.sin(rad) + cx;
        const rotatedY = (absoluteX - cx) * Math.sin(rad) + (absoluteY - cy) * Math.cos(rad) + cy;
        const dist = Math.sqrt(Math.pow(rotatedX - point.x, 2) + Math.pow(rotatedY - point.y, 2));
        if (dist < minDistance) {
          minDistance = dist;
          closestPortId = port.id;
        }
      });
      return closestPortId;
    };

    const handlePipeSplit = (node: Node) => {
      const nodeType = node.getData()?.type;
      if (!INLINE_TYPES.includes(nodeType)) return; 
      const connectedEdges = graph.getConnectedEdges(node);
      if (connectedEdges.length > 0) return; 
      const nodeBBox = node.getBBox();
      const center = nodeBBox.center;
      const allEdges = graph.getEdges();
      const targetEdge = allEdges.find(edge => {
        if (edge.getData()?.type === 'Signal') return false;
        return edge.getBBox().intersectsWithRect(nodeBBox);
      });
      if (targetEdge) {
        const targetView = graph.findViewByCell(targetEdge);
        if (!targetView) return;
        // @ts-ignore
        const closestPoint = targetView.getClosestPoint(center);
        // @ts-ignore
        const routePoints = targetView.routePoints || [];
        const points = [targetEdge.getSourcePoint(), ...routePoints, targetEdge.getTargetPoint()];
        let isPipeHorizontal = true; 
        let foundSegment = false;
        let segmentStart = targetEdge.getSourcePoint();
        let segmentEnd = targetEdge.getTargetPoint();
        for (let i = 0; i < points.length - 1; i++) {
          const p1 = points[i];
          const p2 = points[i + 1];
          const minX = Math.min(p1.x, p2.x) - 5;
          const maxX = Math.max(p1.x, p2.x) + 5;
          const minY = Math.min(p1.y, p2.y) - 5;
          const maxY = Math.max(p1.y, p2.y) + 5;
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
        const angle = node.getAngle();
        const normalizedAngle = (angle % 360 + 360) % 360;
        const isValveHorizontal = (normalizedAngle < 10 || normalizedAngle > 350) || (normalizedAngle > 170 && normalizedAngle < 190);
        if (nodeType !== 'Fitting' && isValveHorizontal !== isPipeHorizontal) return; 
        const OFFSET = 20; 
        let newX = nodeBBox.x;
        let newY = nodeBBox.y;
        if (isPipeHorizontal) {
          const pipeY = closestPoint.y;
          newY = Math.round((pipeY - OFFSET) / 10) * 10; 
          newX = Math.round(nodeBBox.x / 10) * 10; 
        } else {
          const pipeX = closestPoint.x;
          newX = Math.round((pipeX + OFFSET) / 10) * 10;
          newY = Math.round(nodeBBox.y / 10) * 10; 
        }
        node.setPosition(newX, newY);
        const portForSource = getClosestPortId(node, segmentStart);
        const portForTarget = getClosestPortId(node, segmentEnd);
        if (!portForSource || !portForTarget) {
          console.warn('无法找到合适的连接端口');
          return;
        }
        const source = targetEdge.getSource();
        const target = targetEdge.getTarget();
        const edgeData = targetEdge.getData();
        const edgeAttrs = targetEdge.getAttrs(); 
        const sourceCellId = (source as any).cell;
        const targetCellId = (target as any).cell;
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
        graph.addCell([edge1, edge2]);
        message.success('元件已接入管线');
      }
    };

    const handleSignalDrop = (args: any) => {
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

    graph.on('node:added', ({ node }) => setTimeout(() => handlePipeSplit(node as Node), 50));
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
        refreshRouting();
      }
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
      if (cell.isEdge()) { cell.attr('line/strokeWidth', 3); }
      graph.getEdges().forEach(edge => { if (edge.id !== cell.id) { edge.attr('line/strokeWidth', 2); edge.removeTools(); } });
      if (cell.isEdge() && cell.getData()?.type === 'Pipe') {
        cell.addTools([{ name: 'vertices', args: { attrs: { fill: '#666' } } }, { name: 'segments', args: { snapRadius: 20, attrs: { fill: '#444' } } }]);
      }
    });
    
    graph.on('blank:click', () => { setSelectedCell(null); graph.getEdges().forEach(edge => { edge.attr('line/strokeWidth', 2); edge.removeTools(); }); });
    graph.on('cell:contextmenu', ({ e, cell }) => { if (cell.getData()?.isBackground) return; setMenu({ visible: true, x: e.clientX, y: e.clientY, type: cell.isNode() ? 'node' : 'edge', cellId: cell.id }); });
    graph.on('blank:contextmenu', ({ e }) => { setMenu({ visible: true, x: e.clientX, y: e.clientY, type: 'blank' }); });

    const stencil = new Stencil({
      title: '组件库', target: graph, stencilGraphWidth: 240, stencilGraphHeight: 0, collapsable: true,
      search: { visible: true, placeholder: '搜索设备...' },
      groups: [
        { title: '主工艺设备', name: 'main_equip', layoutOptions: { columns: 2, columnWidth: 105, rowHeight: 100 } }, 
        { title: '泵类设备', name: 'pumps', layoutOptions: { columns: 2, columnWidth: 100, rowHeight: 100 } },
        { title: '仪表控制', name: 'instruments', layoutOptions: { columns: 3, columnWidth: 60, rowHeight: 70 } },
        { title: '管路附件', name: 'parts', layoutOptions: { columns: 2, columnWidth: 100, rowHeight: 80 } }
      ],
      getDropNode(node) {
        const clone = node.clone();
        const data = clone.getData();
        if (data?.originalSize) {
          clone.setSize(data.originalSize.width, data.originalSize.height);
          const { originalSize, ...rest } = data;
          clone.setData(rest);
        }
        return clone;
      }
    });
    stencilRef.current.appendChild(stencil.container);

    const TYPE_TO_GROUP: Record<string, string> = {
      'Reactor': 'main_equip', 'FixedBedReactor': 'main_equip', 'Exchanger': 'main_equip', 'VerticalExchanger': 'main_equip',
      'Evaporator': 'main_equip', 'Tank': 'main_equip', 'GasCooler': 'main_equip', 'Trap': 'main_equip', 
      'Pump': 'pumps', 'LiquidPump': 'pumps', 'CentrifugalPump': 'pumps', 'DiaphragmPump': 'pumps', 'PistonPump': 'pumps',
      'GearPump': 'pumps', 'Compressor': 'pumps', 'Fan': 'pumps', 'JetPump': 'pumps',
      'Instrument': 'instruments',
      'Valve': 'parts', 'ControlValve': 'parts', 'ManualValve': 'parts', 'Fitting': 'parts', 'OffPageConnector': 'parts',
      'TappingPoint': 'ignore', 'Frame': 'ignore'         
    };

    const stencilNodes: Record<string, Node[]> = { main_equip: [], pumps: [], instruments: [], parts: [] };
    const typeCounts: Record<string, number> = {};
    Object.values(SHAPE_LIBRARY).forEach((config: any) => {
      const t = config.data?.type || 'Unknown';
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    });
    const typeIterators: Record<string, number> = {};

    Object.keys(SHAPE_LIBRARY).forEach(shapeId => {
      const config = SHAPE_LIBRARY[shapeId];
      const type = config.data?.type || 'Unknown';
      let groupName = TYPE_TO_GROUP[type];
      if (!groupName) {
        if (type.includes('Pump')) groupName = 'pumps';
        else if (type.includes('Valve')) groupName = 'parts';
        else groupName = 'parts'; 
      }
      if (groupName === 'ignore') return;

      const MAX_W = 70; const MAX_H = 70; 
      const originalW = config.width || 80; const originalH = config.height || 80;
      let displayW = originalW; let displayH = originalH;
      if (originalW > MAX_W || originalH > MAX_H) {
        const ratio = originalW / originalH;
        if (ratio > 1) { displayW = MAX_W; displayH = displayW / ratio; } else { displayH = MAX_H; displayW = displayH * ratio; }
      }

      let displayLabel = type;
      if (type === 'Instrument') { displayLabel = config.data?.tagId || 'Inst'; }
      else if (typeCounts[type] > 1) {
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
        shape: shapeId, width: displayW, height: displayH, label: displayLabel, 
        attrs: { label: { fontSize: 10, refY: '100%', refY2: 4, textWrap: { width: 90, ellipsis: true } } },
        data: { ...config.data, originalSize: { width: originalW, height: originalH } } 
      });
      if (stencilNodes[groupName]) { stencilNodes[groupName].push(node); }
    });

    stencil.load(stencilNodes.main_equip, 'main_equip');
    stencil.load(stencilNodes.pumps, 'pumps');
    stencil.load(stencilNodes.instruments, 'instruments');
    stencil.load(stencilNodes.parts, 'parts');

    const setupBackgroundFrame = () => {
      if (graph.getNodes().some(n => n.getData()?.isBackground)) return;
      graph.addNode({ shape: 'drawing-frame-a2', id: 'SHEET_FRAME_A2', x: 0, y: 0, zIndex: -1, movable: false, selectable: false, data: { type: 'Frame', isBackground: true } });
    };

    // [修改] 监听 drawingId 变化加载数据
    const initCanvasData = async () => {
      if (!drawingId) return;
      
      // 清空画布 (保留背景框)
      const cellsToRemove = graph.getCells().filter(cell => !cell.getData()?.isBackground);
      graph.removeCells(cellsToRemove, { silent: true });
      setupBackgroundFrame();

      try {
        const data = await loadGraphData(drawingId);
        if (data && data.nodes.length > 0) {
          graph.fromJSON(data as any);
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
        }
        // 重置历史记录和脏状态
        if (historyRef.current) historyRef.current.clean();
        setDirty(false);
      } catch (error) {
        console.error('Data Load Error:', error);
        message.error('数据加载失败');
      }
    };
    
    initCanvasData();

    return () => { graph.dispose(); if (stencilRef.current) stencilRef.current.innerHTML = ''; };
  }, [drawingId]);

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
  }, []);

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
              } catch (e) { /* save failed */ }
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
  }, [drawingId, isDirty, drawings]); // 依赖 drawingId, isDirty, drawings

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
      <div className="inspector-container"><Inspector cell={selectedCell} /></div>
      <ContextMenu visible={menu.visible} x={menu.x} y={menu.y} type={menu.type} onClose={() => setMenu({ ...menu, visible: false })} onAction={handleMenuAction} />
    </div>
  );
});

export default GraphCanvas;