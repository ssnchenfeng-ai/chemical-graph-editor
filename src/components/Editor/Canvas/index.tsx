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
import { registerCustomCells } from '../../../graph/cells/registry';
import { saveGraphData, loadGraphData } from '../../../services/neo4j';

try { registerCustomCells(); } catch (e) { console.warn(e); }

export interface GraphCanvasRef {
  handleSave: () => Promise<void>;
}

const pick = (obj: any, keys: string[]) => {
  const ret: any = {};
  keys.forEach(key => {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') {
      ret[key] = obj[key];
    }
  });
  return ret;
};
// ==================== [新增] 介质颜色定义 (用于新建连线时立即生效) ====================
const FLUID_COLORS: Record<string, string> = {
  Water: '#1890ff',       // 工艺水 - 蓝
  Steam: '#ff4d4f',       // 蒸汽 - 红
  Air: '#52c41a',         // 空气 - 绿
  N2: '#13c2c2',          // 氮气 - 青
  Oil: '#fa8c16',         // 导热油 - 橙
  Salt: '#722ed1',        // 熔盐 - 紫
  Naphthalene: '#8c8c8c', // 萘 - 深灰
  PA: '#eb2f96',          // 苯酐 - 洋红
  CrudePA: '#f759ab',     // 粗苯酐 - 浅洋红
  ProductGas: '#faad14',  // 产物气 - 金黄
  TailGas: '#bfbfbf',     // 尾气 - 浅灰
};

const GraphCanvas = forwardRef<GraphCanvasRef, {}>((_, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stencilRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);
  const historyRef = useRef<History | null>(null);
  const clipboardRef = useRef<any>(null);

  const [selectedCell, setSelectedCell] = useState<Cell | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  
  const [menu, setMenu] = useState<MenuState>({ visible: false, x: 0, y: 0, type: null });

  // --- 保存功能 ---
  useImperativeHandle(ref, () => ({
    handleSave: async () => {
      if (!graphRef.current) return;
      const graph = graphRef.current;
      
      // 1. 处理节点
      const nodes = graph.getNodes()
        .filter(node => !node.getData()?.isBackground)
        .map(node => {
          const data = node.getData() || {};
          const pos = node.getPosition();
          const size = node.getSize();
          const type = data.type || 'Unknown';

          let Tag = data.tag || node.getAttrs()?.label?.text || '';
          if (type === 'Instrument') {
            const func = data.tagId || '';
            const loop = data.loopNum || '';
            if (func || loop) Tag = `${func}${loop ? '-' + loop : ''}`;
          }

          const baseProps = {
            x6Id: node.id, // 使用 x6Id
            type: type, 
            Tag: Tag,
            x: pos.x, y: pos.y, width: size.width, height: size.height, angle: node.getAngle(),
            desc: data.desc || ''
          };

          let specificProps = {};
          if (['LiquidPump', 'CentrifugalPump', 'DiaphragmPump', 'PistonPump', 'GearPump', 'Compressor', 'Fan', 'JetPump'].includes(type)) {
             specificProps = pick(data, ['spec', 'flow', 'head', 'power', 'material']);
          } else if (['Reactor', 'Tank', 'Evaporator'].includes(type)) {
             specificProps = pick(data, ['spec', 'volume', 'material', 'designPressure', 'designTemp']);
          } else if (type === 'Exchanger') {
             specificProps = pick(data, ['spec', 'area', 'material', 'designPressure', 'tubePressure']);
          } else if (['ControlValve', 'Valve'].includes(type)) {
             specificProps = pick(data, ['spec', 'size', 'valveClass', 'failPosition']);
          } else if (type === 'Instrument') {
             specificProps = pick(data, ['spec', 'range', 'unit', 'tagId', 'loopNum']);
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
          return {
            group: port.group || 'default',
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
          sourceRegion: srcMeta.group, sourceDesc: srcMeta.desc,
          targetRegion: tgtMeta.group, targetDesc: tgtMeta.desc,
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
        await saveGraphData(nodes, edges);
        message.success(`保存成功！节点: ${nodes.length}, 连线: ${edges.length}`);
      } catch (error) {
        console.error(error);
        message.error('保存失败，请检查数据库连接');
      }
    }
  }));

  const updateNodeLabel = (node: Node) => {
    const angle = node.getAngle();
    if (angle === 0) {
      // 恢复默认位置 (底部居中)
      node.setAttrs({
        label: {
          refX: 0.5, refY: '100%', refY2: 10, refX2: 0,
          textAnchor: 'middle', textVerticalAnchor: 'top',
          transform: null 
        }
      });
      return;
    }

    const size = node.getSize();
    const rad = (angle * Math.PI) / 180;
    const visualHeight = size.width * Math.abs(Math.sin(rad)) + size.height * Math.abs(Math.cos(rad));
    const distance = visualHeight / 2 + 15;

    const offsetX = distance * Math.sin(rad);
    const offsetY = distance * Math.cos(rad);

    node.setAttrs({
      label: {
        refX: 0.5, refY: 0.5,
        refX2: offsetX, refY2: offsetY,
        textAnchor: 'middle', textVerticalAnchor: 'middle',
        transform: `rotate(${-angle})`,
      }
    });
  };
  // ============================================================
  // [新增] 复制粘贴核心逻辑
  // ============================================================
  
  // 执行复制
  const performCopy = () => {
    const graph = graphRef.current;
    if (!graph) return;

    const cells = graph.getSelectedCells();
    if (cells.length === 0) return;

    // 过滤掉背景图框，只复制选中的设备和管线
    const cellsToCopy = cells.filter(cell => !cell.getData()?.isBackground);
    
    if (cellsToCopy.length > 0) {
      // 序列化并存储到 ref 中
      clipboardRef.current = cellsToCopy.map(cell => cell.toJSON());
      message.success(`已复制 ${cellsToCopy.length} 个对象`);
    }
  };

  // 执行粘贴
  // offsetPoint: 可选，鼠标右键粘贴时的位置（画布坐标）
  const performPaste = (offsetPoint?: { x: number, y: number }) => {
    const graph = graphRef.current;
    if (!graph || !clipboardRef.current || clipboardRef.current.length === 0) return;

    const cellsJSON = clipboardRef.current;
    
    // 1. 计算粘贴位置的偏移量
    let dx = 20;
    let dy = 20;

    if (offsetPoint) {
      // 如果是鼠标右键粘贴，计算从"复制时的中心"到"鼠标位置"的偏移
      // 这里简化处理：直接取第一个节点的差值，或者简单地将所有节点移动到鼠标附近
      // 为了体验更好，我们通常保留相对位置，只计算整体偏移
      const minX = Math.min(...cellsJSON.map((c: any) => c.position?.x || 0));
      const minY = Math.min(...cellsJSON.map((c: any) => c.position?.y || 0));
      dx = offsetPoint.x - minX;
      dy = offsetPoint.y - minY;
    }

    // 2. 清除选中状态
    graph.cleanSelection();

    // 3. 创建新节点/连线
    const newCells: Cell[] = [];
    
    // 建立旧 ID 到新 ID 的映射，用于修复连线关系
    const idMap: Record<string, string> = {};

    // 第一步：先处理节点 (生成新 ID)
    cellsJSON.forEach((cellData: any) => {
      if (cellData.shape === 'edge') return; // 先跳过连线

      const oldId = cellData.id;
      // 删除 ID 以便生成新的，删除 zIndex 以便由 graph 管理
      const { id, zIndex, ...otherData } = cellData;
      
      const newNode = graph.createNode({
        ...otherData,
        x: (otherData.position?.x || 0) + dx,
        y: (otherData.position?.y || 0) + dy,
      });
      
      idMap[oldId] = newNode.id;
      newCells.push(newNode);
    });

    // 第二步：处理连线 (修复 source/target ID)
    cellsJSON.forEach((cellData: any) => {
      if (cellData.shape !== 'edge') return;

      const { id, zIndex, source, target, ...otherData } = cellData;
      
      // 如果连线的端点在这次复制的节点中，就替换为新 ID；否则保持原样（连到原有设备）
      const newSource = { ...source, cell: idMap[source.cell] || source.cell };
      const newTarget = { ...target, cell: idMap[target.cell] || target.cell };

      const newEdge = graph.createEdge({
        ...otherData,
        source: newSource,
        target: newTarget,
      });
      
      newCells.push(newEdge);
    });

    // 4. 添加到画布并选中
    graph.addCell(newCells);
    graph.select(newCells);
    
    // 如果是键盘粘贴（没有指定位置），更新剪贴板中的坐标，以便下次粘贴能继续偏移
    if (!offsetPoint) {
       clipboardRef.current = cellsJSON.map((c: any) => ({
         ...c,
         position: c.position ? { x: c.position.x + 20, y: c.position.y + 20 } : undefined
       }));
    }
  };

  // ============================================================

  // --- 内部操作函数 ---
  const onUndo = () => historyRef.current?.undo();
  const onRedo = () => historyRef.current?.redo();
  const onZoom = (f: number) => graphRef.current?.zoom(f);
  const onZoomToFit = () => graphRef.current?.zoomToFit({ padding: 20 });
  const onZoomReset = () => graphRef.current?.zoomTo(1);
  
  const onClear = () => {
    Modal.confirm({
      title: '清空画布',
      content: '确定要清空吗？图框将被保留。',
      okType: 'danger',
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

    switch (action) {
      case 'delete':
        if (cell && !cell.getData()?.isBackground) {
          graph.removeCell(cell);
          setSelectedCell(null);
        }
        break;
      case 'copy':
        if (cell) {
          graph.resetSelection(cell);
        }
        performCopy();
        break;
      case 'paste':
        const point = graph.clientToLocal({ x: menu.x, y: menu.y });
        performPaste(point);
        break;
      case 'property':
        message.success('已定位到属性面板');
        break;
      case 'clear':
        onClear();
        break;
      case 'fit':
        onZoomToFit();
        break;
      case 'rotate':
        if (cell && cell.isNode() && !cell.getData()?.isBackground) {
          cell.rotate(90);
        }
        break;
    }
  };

  // --- 初始化 ---
  useEffect(() => {
    if (!containerRef.current || !stencilRef.current) return;
    stencilRef.current.innerHTML = '';

    const graph = new Graph({
      container: containerRef.current,
      autoResize: true,
      grid: { size: 10, visible: true, type: 'doubleMesh', args: [{ color: '#eee' }, { color: '#ddd', factor: 4 }] },
      panning: { enabled: true, eventTypes: ['rightMouseDown'] },
      mousewheel: {
        enabled: true, zoomAtMousePosition: true, modifiers: null, factor: 1.1, maxScale: 3, minScale: 0.1,
      },
      interacting: {
        nodeMovable: (view) => !view.cell.getData()?.isBackground,
        magnetConnectable: (view) => !view.cell.getData()?.isBackground,
      },
      connecting: {
        router: { 
          name: 'manhattan', 
          args: { 
            padding: 20, 
            excludeNodes: ['SHEET_FRAME_A2'] 
          } 
        },
        connector: { name: 'rounded', args: { radius: 8 } },
        anchor: 'center', 
        connectionPoint: 'anchor', 
        snap: true, 
        allowBlank: false, 
        allowEdge: true,
        highlight: true,
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

          const isValidSource = sDir !== 'in'; 
          const isValidTarget = tDir !== 'out';

          return isValidSource && isValidTarget;
        },
        // ==================== [修改] 智能继承 createEdge 逻辑 ====================
        createEdge(args) {
          // 1. 定义默认值
          let data = { 
            type: 'Pipe', 
            material: 'CS', 
            fluid: 'Water', 
            dn: 'DN50', 
            pn: 'PN16', 
            insulation: 'None' 
          };

          // 2. 尝试从源节点继承属性
          if (args.sourceCell) {
            const cell = args.sourceCell;
            // 获取连接到该源节点的所有连线
            const connectedEdges = this.getConnectedEdges(cell);
            
            // 过滤出类型为 Pipe 的连线 (排除 Signal)
            const pipes = connectedEdges.filter(e => e.getData()?.type === 'Pipe');

            if (pipes.length > 0) {
              // 取最后一条连线作为参考 (通常是最近操作的)
              const lastPipe = pipes[pipes.length - 1];
              const lastData = lastPipe.getData() || {};

              // 继承关键规格参数
              data = {
                ...data,
                material: lastData.material || data.material,
                fluid: lastData.fluid || data.fluid,
                dn: lastData.dn || data.dn,
                pn: lastData.pn || data.pn,
                insulation: lastData.insulation || data.insulation
              };
            }
          }

          // 3. 根据当前(继承后)的介质，决定初始颜色
          const color = FLUID_COLORS[data.fluid] || '#5F95FF';

          return this.createEdge({
            shape: 'edge',
            attrs: { 
              line: { 
                stroke: color, // 立即应用正确的颜色
                strokeWidth: 2, 
                targetMarker: { name: 'classic', width: 8, height: 6 }
              } 
            },
            labels: [], 
            data: data
          });
        },
        // ==================== [修改结束] ====================
      },
    });
    graphRef.current = graph;
    // ==================== [新增] 管线交互工具逻辑 ====================
    
    

    

    // ==================== [新增结束] ====================


    // === 新增：监听节点旋转，保持标签始终在视觉下方 ===
    graph.on('node:change:angle', ({ node }) => updateNodeLabel(node as Node));

    // 阀门打断逻辑 (清理冗余变量版)
    // 阀门打断逻辑 (修复 getClosestPoint 类型错误)
    // 阀门打断逻辑 (视图路径采样版 - 终极修复)
    // 阀门打断逻辑 (修复类型错误 + 高性能版)
    // 阀门打断逻辑 (手动旋转 + 严格方向匹配版)
    // 阀门打断逻辑 (精确对齐 + 全角度适配版)
    // 阀门打断逻辑 (智能避让版：忽略阀门自身，避让其他设备)
    // 阀门打断逻辑 (终极修复：双向动态排除，支持连续阀门)
    // 阀门打断逻辑 (智能分类避让版)
    const handlePipeSplit = (node: Node) => {
      const nodeType = node.getData()?.type;
      if (nodeType !== 'ControlValve' && nodeType !== 'Valve') return;
      
      const connectedEdges = graph.getConnectedEdges(node);
      if (connectedEdges.length > 0) return; 

      const nodeBBox = node.getBBox();
      const center = nodeBBox.center;
      const allEdges = graph.getEdges();

      // 1. 寻找相交的管线
      const targetEdge = allEdges.find(edge => {
        if (edge.getData()?.type === 'Signal') return false;
        return edge.getBBox().intersectsWithRect(nodeBBox);
      });

      if (targetEdge) {
        // 2. 获取视图与路由点
        const targetView = graph.findViewByCell(targetEdge);
        if (!targetView) return;

        // @ts-ignore
        const closestPoint = targetView.getClosestPoint(center);
        // @ts-ignore
        const routePoints = targetView.routePoints || [];
        
        const points = [
          targetEdge.getSourcePoint(),
          ...routePoints,
          targetEdge.getTargetPoint()
        ];
        
        // 3. 判断管线分段的方向
        let isPipeHorizontal = true; 
        let foundSegment = false;

        for (let i = 0; i < points.length - 1; i++) {
          const p1 = points[i];
          const p2 = points[i + 1];
          
          const minX = Math.min(p1.x, p2.x) - 2;
          const maxX = Math.max(p1.x, p2.x) + 2;
          const minY = Math.min(p1.y, p2.y) - 2;
          const maxY = Math.max(p1.y, p2.y) + 2;

          if (closestPoint.x >= minX && closestPoint.x <= maxX &&
              closestPoint.y >= minY && closestPoint.y <= maxY) {
            
            if (Math.abs(p1.y - p2.y) < 1) {
              isPipeHorizontal = true; 
            } else {
              isPipeHorizontal = false; 
            }
            foundSegment = true;
            break; 
          }
        }

        if (!foundSegment) {
           const src = targetEdge.getSourcePoint();
           const tgt = targetEdge.getTargetPoint();
           isPipeHorizontal = Math.abs(src.x - tgt.x) > Math.abs(src.y - tgt.y);
        }

        // 4. 校验阀门角度
        const angle = node.getAngle();
        const normalizedAngle = (angle % 360 + 360) % 360;
        const isValveHorizontal = (normalizedAngle < 10 || normalizedAngle > 350) || (normalizedAngle > 170 && normalizedAngle < 190);

        if (isValveHorizontal !== isPipeHorizontal) {
          return; 
        }

        // 5. 几何修正
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

        // 6. 端口分配
        const srcPoint = targetEdge.getSourcePoint();
        const tgtPoint = targetEdge.getTargetPoint();
        
        let portForSource = 'in';  
        let portForTarget = 'out'; 

        if (isPipeHorizontal) {
          if (srcPoint.x < tgtPoint.x) { 
            portForSource = 'in'; portForTarget = 'out';
          } else { 
            portForSource = 'out'; portForTarget = 'in';
          }
        } else {
          if (srcPoint.y < tgtPoint.y) { 
            portForSource = 'in'; portForTarget = 'out';
          } else { 
            portForSource = 'out'; portForTarget = 'in';
          }
        }

        // 7. 执行打断
        const source = targetEdge.getSource();
        const target = targetEdge.getTarget();
        const edgeData = targetEdge.getData();
        const edgeAttrs = targetEdge.getAttrs(); 

        const sourceCellId = (source as any).cell;
        const targetCellId = (target as any).cell;

        graph.removeCell(targetEdge);

        // === 关键修改：定义“在线元件”类型列表 ===
        // 只有这些类型的设备，才会被路由算法忽略体积，允许直线穿过
        const INLINE_TYPES = ['ControlValve', 'Valve', 'Fitting', 'TappingPoint'];

        // 辅助函数：判断某个 ID 对应的节点是否为在线元件
        const isInlineComponent = (id: string) => {
          if (!id) return false;
          const cell = graph.getCellById(id);
          if (!cell || !cell.isNode()) return false;
          const type = cell.getData()?.type;
          return INLINE_TYPES.includes(type);
        };

        // 构建排除列表 1 (Source -> Valve)
        const exclude1 = ['SHEET_FRAME_A2', node.id];
        if (isInlineComponent(sourceCellId)) {
          exclude1.push(sourceCellId); // 如果上游是阀门/管件，排除它（允许直线）
        }

        // 构建排除列表 2 (Valve -> Target)
        const exclude2 = ['SHEET_FRAME_A2', node.id];
        if (isInlineComponent(targetCellId)) {
          exclude2.push(targetCellId); // 如果下游是阀门/管件，排除它（允许直线）
        }

        const router1 = { name: 'manhattan', args: { padding: 30, excludeNodes: exclude1 } };
        const router2 = { name: 'manhattan', args: { padding: 30, excludeNodes: exclude2 } };

        const edge1 = graph.createEdge({
          shape: 'edge', 
          source: source, 
          target: { cell: node.id, port: portForSource }, 
          data: { ...edgeData }, attrs: edgeAttrs, labels: [],
          router: router1 
        });

        const edge2 = graph.createEdge({
          shape: 'edge', 
          source: { cell: node.id, port: portForTarget }, 
          target: target,
          data: { ...edgeData }, attrs: edgeAttrs, labels: [],
          router: router2 
        });

        graph.addCell([edge1, edge2]);
        message.success('阀门已接入');
      }
    };
    // 智能测点
    // 智能测点 (修正方向 + 保留打断逻辑)
    const handleSignalDrop = (args: any) => {
      const { e, edge } = args;
      const sourceNode = edge.getSourceNode();
      
      // 1. 仅处理从仪表发出的连线
      if (sourceNode?.getData()?.type !== 'Instrument') return;

      let hitPipe: Edge | null = null;
      const point = graph.clientToLocal(e.clientX, e.clientY);

      // 2. 检测是否拖拽到了管线上
      const targetCell = edge.getTargetCell();
      if (targetCell && targetCell.isEdge()) {
        hitPipe = targetCell as Edge;
      } else {
        if (edge.getTargetNode()) return; // 如果连到了其他节点，不处理
        const views = graph.findViewsFromPoint(point);
        // 排除自身和已有的信号线
        const pipeView = views.find(v => v.isEdgeElement() && v.cell.id !== edge.id && v.cell.getData()?.type !== 'Signal');
        if (pipeView) {
          hitPipe = pipeView.cell as Edge;
        }
      }

      if (hitPipe) {
        // --- A. 计算测点位置 (保留原有逻辑，确保吸附在管线上) ---
        const src = hitPipe.getSourcePoint();
        const tgt = hitPipe.getTargetPoint();

        let tapX = point.x;
        let tapY = point.y;

        const isHorizontal = Math.abs(src.y - tgt.y) < 2;
        const isVertical = Math.abs(src.x - tgt.x) < 2;

        if (isHorizontal) {
          tapY = src.y; 
          tapX = Math.round(point.x / 10) * 10;
        } else if (isVertical) {
          tapX = src.x;
          tapY = Math.round(point.y / 10) * 10;
        } else {
          tapX = Math.round(point.x / 10) * 10;
          tapY = Math.round(point.y / 10) * 10;
        }

        // --- B. 创建测点节点 (保留原有逻辑) ---
        const tappingPoint = graph.createNode({
          shape: 'tapping-point',
          x: tapX - 6, y: tapY - 6, // 居中校正
          data: { type: 'TappingPoint' }
        });
        
        // --- C. 处理信号线 (修改逻辑：反转方向) ---
        // 1. 删除用户拖拽的那条临时线 (因为它方向是 仪表->空地)
        graph.removeCell(edge); 

        // 2. 创建新信号线：测点 -> 仪表
        const signalEdge = graph.createEdge({
          shape: 'signal-edge', // 使用注册好的虚线样式
          source: { cell: tappingPoint.id },
          target: { cell: sourceNode.id }, // 连回起始仪表
          data: { type: 'Signal', relationType: 'MEASURES' }
        });

        // --- D. 打断原有管线 (保留原有逻辑，确保测点嵌入管线) ---
        const source = hitPipe.getSource();
        const target = hitPipe.getTarget();
        const pipeData = hitPipe.getData();
        const pipeAttrs = hitPipe.getAttrs(); 

        // 删除旧管线
        graph.removeCell(hitPipe);

        // 创建两段新管线：Source -> 测点 -> Target
        const pipe1 = graph.createEdge({
          shape: 'edge', source: source, target: { cell: tappingPoint.id },
          data: pipeData, attrs: pipeAttrs, labels: []
        });
        const pipe2 = graph.createEdge({
          shape: 'edge', source: { cell: tappingPoint.id }, target: target,
          data: pipeData, attrs: pipeAttrs, labels: []
        });
        
        // --- E. 批量添加到画布 ---
        // 注意：先加节点，再加连线，顺序很重要
        graph.addCell([tappingPoint, pipe1, pipe2, signalEdge]);
        tappingPoint.toFront(); // 确保测点在最上层
        
        message.success('已生成测点 (信号流向: 测点 -> 仪表)');
      } else {
        // 如果没拖到管线上，且没连到任何东西，删除这条悬空的线
        if (!edge.getTargetCell()) {
          graph.removeCell(edge);
        }
      }
    };

    graph.on('node:added', ({ node }) => setTimeout(() => handlePipeSplit(node as Node), 50));
    graph.on('node:mouseup', ({ node }) => handlePipeSplit(node as Node));
    graph.on('edge:mouseup', handleSignalDrop); 

    // --- 核心修复：确保信号线逻辑存在 ---
    graph.on('edge:connected', ({ edge }) => {
      const sourceNode = edge.getSourceNode();
      const targetPortId = edge.getTargetPortId();

      const isSourceInstrument = sourceNode?.getData()?.type === 'Instrument';
      const isTargetActuator = targetPortId === 'actuator';

      if (isSourceInstrument || isTargetActuator) {
        edge.setAttrs({
          line: { 
            stroke: '#888', 
            strokeWidth: 1, 
            strokeDasharray: '4 4', 
            targetMarker: { name: 'classic', size: 3 } 
          } 
        });
        edge.setData({ 
          type: 'Signal', 
          fluid: 'Signal',
          relationType: isTargetActuator ? 'CONTROLS' : 'MEASURES' 
        });
        if (isTargetActuator) {
           edge.setRouter('manhattan', { padding: 10 });
        }
      }
    });

    graph.use(new Selection({
      enabled: true, multiple: true, rubberband: true, movable: true, showNodeSelectionBox: true,
      filter: (cell) => !cell.getData()?.isBackground
    }));
    graph.use(new Keyboard({ enabled: true }));
    graph.use(new Transform({ resizing: { enabled: true }, rotating: { enabled: true, grid: 15 } }));
    
    const history = new History({ enabled: true });
    graph.use(history);
    historyRef.current = history;
    graph.on('history:change', () => { setCanUndo(history.canUndo()); setCanRedo(history.canRedo()); });

    graph.bindKey(['meta+c', 'ctrl+c'], () => {
      performCopy();
      return false; // 阻止默认事件
    });

    graph.bindKey(['meta+v', 'ctrl+v'], () => {
      performPaste(); // 键盘粘贴不传坐标，使用默认偏移
      return false;
    });

    graph.bindKey(['backspace', 'delete'], () => {
      const cells = graph.getSelectedCells().filter(c => !c.getData()?.isBackground);
      if (cells.length) graph.removeCells(cells);
    });

    graph.on('cell:click', ({ cell }) => {
      // 1. 如果是背景图框，取消选中
      if (cell.getData()?.isBackground) { 
        setSelectedCell(null); 
        // 清除所有工具
        graph.getEdges().forEach(edge => edge.removeTools());
        return; 
      }

      // 2. 设置当前选中项 (用于属性面板)
      setSelectedCell(cell);

      // 3. 视觉反馈：加粗选中项，恢复其他项
      if (cell.isEdge()) {
        cell.attr('line/strokeWidth', 3);
      }
      graph.getEdges().forEach(edge => { 
        if (edge.id !== cell.id) {
          edge.attr('line/strokeWidth', 2);
          edge.removeTools(); // 移除其他管线的工具
        }
      });

      // 4. [核心修改] 如果选中了工艺管线，添加编辑工具
      if (cell.isEdge() && cell.getData()?.type === 'Pipe') {
        cell.addTools([
          {
            name: 'vertices', // 1. 显示拐点 (圆点)，允许拖拽拐角
            args: {
              attrs: { fill: '#666' }, // 拐点颜色
            },
          },
          {
            name: 'segments', // 2. 显示线段 (横杠)，允许拖拽平移
            args: {
              snapRadius: 20,
              attrs: {
                fill: '#444', // 手柄颜色
              },
            },
          },
        ]);
      }
    });
    
    graph.on('blank:click', () => {
      setSelectedCell(null);
      // 恢复所有管线样式并移除工具
      graph.getEdges().forEach(edge => {
        edge.attr('line/strokeWidth', 2);
        edge.removeTools(); // <--- 关键：点击空白处隐藏所有拖拽手柄
      });
    });

    graph.on('cell:contextmenu', ({ e, cell }) => {
      if (cell.getData()?.isBackground) return; 
      setMenu({ visible: true, x: e.clientX, y: e.clientY, type: cell.isNode() ? 'node' : 'edge', cellId: cell.id });
    });
    
    graph.on('blank:contextmenu', ({ e }) => {
      setMenu({ visible: true, x: e.clientX, y: e.clientY, type: 'blank' });
    });

    // --- Stencil ---
    const stencil = new Stencil({
      title: '组件库', target: graph, stencilGraphWidth: 240, stencilGraphHeight: 0, collapsable: true,
      search: { visible: true, placeholder: '搜索设备...' },
      groups: [
        { title: '主工艺设备', name: 'main_equip', layoutOptions: { columns: 1, columnWidth: 220, rowHeight: 160 } },
        { title: '泵类设备', name: 'pumps', layoutOptions: { columns: 2, columnWidth: 100, rowHeight: 100 } },
        { title: '仪表控制', name: 'instruments', layoutOptions: { columns: 3, columnWidth: 60, rowHeight: 70 } },
        { title: '管路附件', name: 'parts', layoutOptions: { columns: 2, columnWidth: 100, rowHeight: 120 } }
      ],
    });
    stencilRef.current.appendChild(stencil.container);

    const reactor = graph.createNode({ shape: 'p-reactor', label: '反应釜', data: { type: 'Reactor' } });
    const exchanger = graph.createNode({ shape: 'p-exchanger', label: '换热器', data: { type: 'Exchanger' } });
    const e13 = graph.createNode({ shape: 'p-naphthalene-evaporator', label: '萘蒸发器', data: { type: 'Evaporator' } });
    const teeNode = graph.createNode({ shape: 'p-tee' });
    const tankH = graph.createNode({ shape: 'p-tank-horizontal', label: '卧式储罐', data: { type: 'Tank' } });
    const gasCooler = graph.createNode({ shape: 'p-gas-cooler', label: '气体冷却器', data: { type: 'GasCooler' } });
    const d14 = graph.createNode({ shape: 'p-fixed-bed-reactor', label: '固定床反应器', data: { type: 'FixedBedReactor' } });
    const vExchanger = graph.createNode({ shape: 'p-exchanger-vertical', label: '立式换热器', data: { type: 'VerticalExchanger' } });
    const trapNode = graph.createNode({ shape: 'p-trap', label: '捕集器', data: { type: 'Trap' } });
    
    
    const pumpList = [
      graph.createNode({ shape: 'p-pump-liquid', label: '液体泵' }),
      graph.createNode({ shape: 'p-pump-centrifugal', label: '离心泵' }),
      graph.createNode({ shape: 'p-pump-diaphragm', label: '隔膜泵' }),
      graph.createNode({ shape: 'p-pump-piston', label: '活塞泵' }),
      graph.createNode({ shape: 'p-pump-compressor', label: '压缩机' }),
      graph.createNode({ shape: 'p-pump-gear', label: '齿轮泵' }),
      graph.createNode({ shape: 'p-pump-fan', label: '风扇' }),
      graph.createNode({ shape: 'p-pump-jet', label: '喷射泵' }),
    ];
    const valveList = [
      graph.createNode({ shape: 'p-cv-pneumatic', label: '气动阀' }),
      graph.createNode({ shape: 'p-cv-positioner', label: '定位器' }),
      graph.createNode({ shape: 'p-cv-electric', label: '电动阀' }),
      graph.createNode({ shape: 'p-cv-solenoid', label: '电磁阀' }),
      graph.createNode({ shape: 'p-cv-manual', label: '手动阀' }),
      graph.createNode({ shape: 'p-cv-piston', label: '气缸阀' }),
    ];
    const instList = [
      graph.createNode({ shape: 'p-inst-local', label: '就地' }),
      graph.createNode({ shape: 'p-inst-remote', label: '远传' }),
      graph.createNode({ shape: 'p-inst-panel', label: '盘装' }),
    ];

    stencil.load([reactor, exchanger, vExchanger, e13, tankH, gasCooler, d14,trapNode], 'main_equip');
    stencil.load(pumpList, 'pumps');
    stencil.load(instList, 'instruments');
    stencil.load([...valveList, teeNode], 'parts');

    const setupBackgroundFrame = () => {
      if (graph.getNodes().some(n => n.getData()?.isBackground)) return;
      graph.addNode({
        shape: 'drawing-frame-a2', id: 'SHEET_FRAME_A2', x: 0, y: 0, zIndex: -1,
        movable: false, selectable: false, data: { type: 'Frame', isBackground: true }
      });
    };

    const initCanvasData = async () => {
      setupBackgroundFrame();
      try {
        const data = await loadGraphData();
        if (data && data.nodes.length > 0) {
          graph.fromJSON(data as any);
          
          // === 新增部分：数据加载后的批量修复 ===
          graph.batchUpdate(() => {
            const nodes = graph.getNodes();
            const edges = graph.getEdges();

            nodes.forEach(node => {
              if (!node.getData()?.isBackground) {
                // 1. 修复旋转后的位号位置
                updateNodeLabel(node); 
                // 2. 确保设备在管线之上
                node.setZIndex(2);     
              }
            });

            edges.forEach(edge => {
              // 3. 确保管线在设备之下
              edge.setZIndex(1);       
            });
          });
          // ===================================

          setupBackgroundFrame();
          graph.centerContent();
          message.success('数据已恢复');
        }
      } catch (error) {
        console.error('Data Load Error:', error);
        message.error('数据加载失败，已重置');
      }
    };
    setTimeout(initCanvasData, 100);

    return () => { graph.dispose(); if (stencilRef.current) stencilRef.current.innerHTML = ''; };
  }, []);

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