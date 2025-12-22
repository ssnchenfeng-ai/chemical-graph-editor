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
//import { registerCustomCells } from '../../../graph/cells/registry';
import { saveGraphData, loadGraphData } from '../../../services/neo4j';
import { FLUID_COLORS, INLINE_TYPES } from '../../../config/rules';
import { registerCustomCells, SHAPE_LIBRARY } from '../../../graph/cells/registry';

// 确保注册自定义图形
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
          const angle = node.getAngle(); // 获取角度
          const type = data.type || 'Unknown';

          // Tag 处理逻辑
          let Tag = data.tag || node.getAttrs()?.label?.text || '';
          if (type === 'Instrument') {
            const func = data.tagId || '';
            const loop = data.loopNum || '';
            if (func || loop) Tag = `${func}${loop ? '-' + loop : ''}`;
          }

          // [核心修改] 将 x, y, w, h, a 打包成 layout JSON 字符串
          // 使用 Math.round 取整，减少存储体积
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
            // [新增] 存入 layout 字段
            layout: JSON.stringify(layoutData),
            // [移除] x, y, width, height, angle 不再直接作为顶层属性
            // [新增] 保存位号位置配置
            labelPosition: data.labelPosition || 'bottom' 
          };

          // 业务属性提取逻辑 (保持不变)
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
        
        // [核心修改] 提取端口元数据逻辑
        const getPortMeta = (node: Cell | null, portId: string | undefined) => {
          if (!node || !node.isNode() || !portId) return { group: 'default', desc: 'unknown' };
          
          const port = node.getPort(portId);
          if (!port) return { group: 'default', desc: 'unknown' };

          // 优先级逻辑：
          // 1. 优先使用语义化的 region (如 "ShellSide:Liquid", "TubeSide")
          // 2. 其次使用 section (如 "HighTemp")
          // 3. 最后降级使用视觉 group (如 "top", "left")
          let region = port.data?.region || port.group || 'default';
          
          // 如果有 section (如气体冷却器的高温段)，可以拼接到 region 中，或者单独存储
          // 这里为了简化，如果存在 section，我们将其追加到 region 描述中，例如 "TubeSide:HighTemp"
          if (port.data?.region && port.data?.section) {
            region = `${port.data.region}:${port.data.section}`;
          }

          return {
            group: region, // 这里将语义 region 赋值给 group 字段，后续会存入 Neo4j 的 fromRegion/toRegion
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
          
          // 这里 srcMeta.group 现在携带的是 "ShellSide:Liquid" 等高价值语义
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
        await saveGraphData(nodes, edges);
        message.success(`保存成功！节点: ${nodes.length}, 连线: ${edges.length}`);
      } catch (error) {
        console.error(error);
        message.error('保存失败，请检查数据库连接');
      }
    }
  }));

   const updateNodeLabel = (node: Node) => {
    const data = node.getData() || {};
    const position = data.labelPosition || 'bottom'; // 默认为下方
    const angle = node.getAngle();
    const size = node.getSize();
    
    // 基础偏移量 (文字距离设备的间距)
    const PADDING = 15;

    // 1. 计算视觉上的包围盒尺寸 (旋转后的投影尺寸)
    const rad = (angle * Math.PI) / 180;
    const sin = Math.abs(Math.sin(rad));
    const cos = Math.abs(Math.cos(rad));
    
    // 旋转后的视觉宽度和高度的一半
    const visualHalfW = (size.width * cos + size.height * sin) / 2;
    const visualHalfH = (size.width * sin + size.height * cos) / 2;

    // 2. 确定视觉上的目标偏移向量 (相对于中心点)
    let visualOffsetX = 0;
    let visualOffsetY = 0;

    switch (position) {
      case 'top':
        visualOffsetY = -(visualHalfH + PADDING);
        break;
      case 'bottom':
        visualOffsetY = (visualHalfH + PADDING);
        break;
      case 'left':
        visualOffsetX = -(visualHalfW + PADDING);
        break;
      case 'right':
        visualOffsetX = (visualHalfW + PADDING);
        break;
      case 'center':
        visualOffsetX = 0;
        visualOffsetY = 0;
        break;
    }

    // 3. 将视觉偏移向量逆旋转回节点的局部坐标系
    // 屏幕向量 V_screen 转为局部向量 V_local，需要旋转 -A 度
    const localRad = (-angle * Math.PI) / 180;
    const localX = visualOffsetX * Math.cos(localRad) - visualOffsetY * Math.sin(localRad);
    const localY = visualOffsetX * Math.sin(localRad) + visualOffsetY * Math.cos(localRad);

    // 4. 设置属性
    // refX/refY = 0.5 表示从中心点开始计算偏移
    node.setAttrs({
      label: {
        refX: 0.5,
        refY: 0.5,
        refX2: localX,
        refY2: localY,
        textAnchor: 'middle',
        textVerticalAnchor: 'middle',
        // 关键：抵消节点的旋转，使文字始终保持水平
        transform: `rotate(${-angle})`,
      }
    });
  };

  // ============================================================
  // [修复] 复制粘贴逻辑 (手动序列化，解决管线报错问题)
  // ============================================================
  const performCopy = (targetCell?: Cell) => {
    const graph = graphRef.current;
    if (!graph) return;
    
    try {
      let cells = graph.getSelectedCells();
      
      // 如果当前没有选中任何东西，但传入了目标对象（右键菜单触发），则使用目标对象
      if (cells.length === 0 && targetCell) {
        cells = [targetCell];
        graph.select(targetCell);
      }

      if (cells.length === 0) {
        message.info('请先选中要复制的对象');
        return;
      }

      // [核心修改] 过滤掉背景图框 AND 过滤掉管线 (只复制设备节点)
      const cellsToCopy = cells.filter(cell => 
        !cell.getData()?.isBackground && cell.isNode()
      );

      if (cellsToCopy.length === 0) {
        message.warning('没有可复制的设备对象 (管线已忽略)');
        return;
      }

      // 手动序列化
      const jsonList = cellsToCopy.map(cell => {
        try {
          // 尝试深拷贝 data，防止引用问题
          const safeData = cell.getData() ? JSON.parse(JSON.stringify(cell.getData())) : {};
          
          // 只处理 Node，因为上面已经 filter 过了
          if (cell.isNode()) {
            return {
              id: cell.id,
              shape: cell.shape,
              position: cell.getPosition(),
              size: cell.getSize(),
              angle: cell.getAngle(),
              zIndex: cell.getZIndex(),
              attrs: cell.getAttrs(),
              data: safeData,
              ports: cell.getPorts(), // 必须保留端口信息
            };
          }
          return null;
        } catch (err) {
          console.error(`Failed to serialize cell ${cell.id}:`, err);
          return null;
        }
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

  // ============================================================
  // [修复] 粘贴逻辑 (增加数据清洗，防止 History 报错)
  // ============================================================
  const performPaste = (offsetPoint?: { x: number, y: number }) => {
    const graph = graphRef.current;
    if (!graph || !clipboardRef.current || clipboardRef.current.length === 0) return;

    try {
      const cellsJSON = clipboardRef.current;
      console.log('Paste Start. Clipboard items:', cellsJSON.length);

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

      // 辅助函数：深度清洗对象，移除 undefined/null
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

      // 1. 粘贴节点
      cellsJSON.forEach((cellData: any) => {
        if (!cellData.position) return;
        
        try {
          const oldId = cellData.id;
          const { id, zIndex, ...otherData } = cellData;
          
          // 确保 data 和 attrs 是纯净对象
          const safeData = cleanData(otherData.data || {});
          const safeAttrs = cleanData(otherData.attrs || {});
          
          const newNode = graph.createNode({
            ...otherData,
            data: safeData,
            attrs: safeAttrs,
            x: (otherData.position.x) + dx,
            y: (otherData.position.y) + dy,
            zIndex: (zIndex || 2) + 1
          });
          
          idMap[oldId] = newNode.id;
          newCells.push(newNode);
        } catch (nodeErr) {
          console.error('Failed to create node:', nodeErr);
        }
      });

      // (已移除连线粘贴逻辑，因为复制时已经过滤掉了)

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
    // [新增] 处理位号位置选择
    if (action.startsWith('label:')) {
      if (cell && cell.isNode()) {
        const position = action.split(':')[1];
        // 更新数据，这将触发 'node:change:data' 事件，进而调用 updateNodeLabel
        cell.setData({ labelPosition: position });
        message.success(`位号位置已更新`);
      }
      return;
    }
    
    switch (action) {
      case 'copy': 
        if (cell && !graph.isSelected(cell)) {
          graph.resetSelection(cell); 
        }
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
        if (selected.length > 0) {
          graph.removeCells(selected);
        } else if (cell) {
          graph.removeCell(cell);
        }
        break;
      case 'rotate': 
        if (cell && cell.isNode() && !cell.getData()?.isBackground) { cell.rotate(90); } break;
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

    // ============================================================
    // [优化] 辅助函数：计算节点上距离某点最近的端口 ID
    // ============================================================
    const getClosestPortId = (node: Node, point: { x: number; y: number }) => {
      const ports = node.getPorts();
      if (!ports.length) return undefined;

      const pos = node.getPosition(); // 获取未旋转时的左上角坐标
      const size = node.getSize();
      const angle = node.getAngle();
      
      // 计算旋转中心
      const cx = pos.x + size.width / 2;
      const cy = pos.y + size.height / 2;
      const rad = (angle * Math.PI) / 180;

      let minDistance = Infinity;
      let closestPortId = ports[0].id;

      ports.forEach((port) => {
        // 1. 解析端口相对坐标 (支持百分比和绝对数值)
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

        // 2. 计算未旋转时的绝对坐标
        const absoluteX = pos.x + relX;
        const absoluteY = pos.y + relY;

        // 3. 应用旋转变换 (绕中心点旋转)
        // x' = (x - cx) * cos - (y - cy) * sin + cx
        // y' = (x - cx) * sin + (y - cy) * cos + cy
        const rotatedX = (absoluteX - cx) * Math.cos(rad) - (absoluteY - cy) * Math.sin(rad) + cx;
        const rotatedY = (absoluteX - cx) * Math.sin(rad) + (absoluteY - cy) * Math.cos(rad) + cy;

        // 4. 计算欧几里得距离
        const dist = Math.sqrt(Math.pow(rotatedX - point.x, 2) + Math.pow(rotatedY - point.y, 2));

        if (dist < minDistance) {
          minDistance = dist;
          closestPortId = port.id;
        }
      });

      return closestPortId;
    };

    // ============================================================
    // [修复] 阀门/管件打断逻辑 (支持任意端口 + 线段级邻近匹配)
    // ============================================================
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
        
        // [新增] 记录被打断的线段的起点和终点，用于计算最近端口
        let segmentStart = targetEdge.getSourcePoint();
        let segmentEnd = targetEdge.getTargetPoint();

        for (let i = 0; i < points.length - 1; i++) {
          const p1 = points[i];
          const p2 = points[i + 1];
          
          const minX = Math.min(p1.x, p2.x) - 5;
          const maxX = Math.max(p1.x, p2.x) + 5;
          const minY = Math.min(p1.y, p2.y) - 5;
          const maxY = Math.max(p1.y, p2.y) + 5;

          if (closestPoint.x >= minX && closestPoint.x <= maxX &&
              closestPoint.y >= minY && closestPoint.y <= maxY) {
            
            if (Math.abs(p1.y - p2.y) < 5) { 
              isPipeHorizontal = true; 
            } else {
              isPipeHorizontal = false; 
            }
            foundSegment = true;
            
            // [核心修改] 捕获当前线段的端点
            segmentStart = p1;
            segmentEnd = p2;
            
            break; 
          }
        }

        if (!foundSegment) {
           const src = targetEdge.getSourcePoint();
           const tgt = targetEdge.getTargetPoint();
           isPipeHorizontal = Math.abs(src.x - tgt.x) > Math.abs(src.y - tgt.y);
           // 如果没找到特定线段（极少情况），保持默认使用整条线的起终点
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

        // [核心修改] 使用线段端点 (segmentStart/End) 而不是整条管线的端点 (srcPoint/tgtPoint)
        // 这样可以确保连接到物理上最近的端口，解决 L 型或 U 型管路的连接错乱问题
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

    // ============================================================
    // [修复] 智能测点 (Z-Index 修复)
    // ============================================================
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
            type: 'Signal', 
            relationType: 'MEASURES',
            fluid: 'Signal',
            // 显式清除工艺属性
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

    // --- Stencil (动态加载逻辑) ---
    const stencil = new Stencil({
      title: '组件库', 
      target: graph, 
      stencilGraphWidth: 240, 
      stencilGraphHeight: 0, 
      collapsable: true,
      search: { visible: true, placeholder: '搜索设备...' },
      groups: [
        { title: '主工艺设备', name: 'main_equip', layoutOptions: { columns: 2, columnWidth: 105, rowHeight: 100 } }, // 改为2列，更紧凑
        { title: '泵类设备', name: 'pumps', layoutOptions: { columns: 2, columnWidth: 100, rowHeight: 100 } },
        { title: '仪表控制', name: 'instruments', layoutOptions: { columns: 3, columnWidth: 60, rowHeight: 70 } },
        { title: '管路附件', name: 'parts', layoutOptions: { columns: 2, columnWidth: 100, rowHeight: 80 } }
      ],
      // [新增] 核心逻辑：拖拽放置时恢复原始尺寸
      getDropNode(node) {
        const clone = node.clone();
        const data = clone.getData();
        
        // 如果有原始尺寸记录，则恢复
        if (data?.originalSize) {
          clone.setSize(data.originalSize.width, data.originalSize.height);
          // 清理掉临时数据，不让它带入画布
          const { originalSize, ...rest } = data;
          clone.setData(rest);
        }
        return clone;
      }
    });
    stencilRef.current.appendChild(stencil.container);

    // ============================================================
    // 动态分拣算法：根据 Type 自动归类
    // ============================================================
    
    // 1. 定义类型到分组的映射表
    const TYPE_TO_GROUP: Record<string, string> = {
      // 主设备
      'Reactor': 'main_equip',
      'FixedBedReactor': 'main_equip',
      'Exchanger': 'main_equip',
      'VerticalExchanger': 'main_equip',
      'Evaporator': 'main_equip',
      'Tank': 'main_equip',
      'GasCooler': 'main_equip',
      'Trap': 'main_equip', 
      
      // 泵类
      'Pump': 'pumps',
      'LiquidPump': 'pumps',
      'CentrifugalPump': 'pumps',
      'DiaphragmPump': 'pumps',
      'PistonPump': 'pumps',
      'GearPump': 'pumps',
      'Compressor': 'pumps',
      'Fan': 'pumps',
      'JetPump': 'pumps',
      
      // 仪表
      'Instrument': 'instruments',
      
      // 附件
      'Valve': 'parts',
      'ControlValve': 'parts',
      'ManualValve': 'parts', // 确保包含
      'Fitting': 'parts',
      'TappingPoint': 'ignore', 
      'Frame': 'ignore'         
    };

    // 2. 初始化分组容器
    const stencilNodes: Record<string, Node[]> = {
      main_equip: [],
      pumps: [],
      instruments: [],
      parts: []
    };
    // [新增] 预计算每个 Type 的数量，用于决定是否显示后缀
    const typeCounts: Record<string, number> = {};
    Object.values(SHAPE_LIBRARY).forEach((config: any) => {
      const t = config.data?.type || 'Unknown';
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    });

    // [新增] 用于同名 Type 的计数器
    const typeIterators: Record<string, number> = {};

    // 3. 遍历注册表，自动创建节点实例
    Object.keys(SHAPE_LIBRARY).forEach(shapeId => {
      const config = SHAPE_LIBRARY[shapeId];
      const type = config.data?.type || 'Unknown';
      
      // 获取目标分组，默认为 'parts'
      let groupName = TYPE_TO_GROUP[type];
      
      if (!groupName) {
        if (type.includes('Pump')) groupName = 'pumps';
        else if (type.includes('Valve')) groupName = 'parts';
        else groupName = 'parts'; 
      }

      if (groupName === 'ignore') return;

      // [新增] 尺寸自适应计算
      const MAX_W = 70; // 侧边栏图标最大宽度
      const MAX_H = 70; // 侧边栏图标最大高度
      
      const originalW = config.width || 80;
      const originalH = config.height || 80;
      
      let displayW = originalW;
      let displayH = originalH;

      // 如果原始尺寸超过限制，按比例缩放
      if (originalW > MAX_W || originalH > MAX_H) {
        const ratio = originalW / originalH;
        if (ratio > 1) {
          // 宽 > 高
          displayW = MAX_W;
          displayH = displayW / ratio;
        } else {
          // 高 > 宽
          displayH = MAX_H;
          displayW = displayH * ratio;
        }
      }

      // [新增] 标签优化逻辑
      // 侧边栏显示 Type (如 "Reactor") 或 Tag (如 "R-101")，而不是 Spec
      // 如果有中文别名映射更好，这里暂时用 Type
      let displayLabel = type;
      // 特殊处理：如果是仪表，显示简短的 PI/TI
      if (type === 'Instrument') {
         displayLabel = config.data?.tagId || 'Inst';
      }
      // 如果该类型有多个图元，则添加后缀
      else if (typeCounts[type] > 1) {
         // 尝试从 ID 中提取后缀 (例如 p-cv-electric -> electric)
         const parts = shapeId.split('-');
         let suffix = parts[parts.length - 1]; // 取最后一段

         // 如果后缀就是类型本身 (例如 p-reactor -> reactor)，则使用数字编号
         if (type.toLowerCase().includes(suffix.toLowerCase())) {
            typeIterators[type] = (typeIterators[type] || 0) + 1;
            suffix = `${typeIterators[type]}`;
         } else {
            // 首字母大写
            suffix = suffix.charAt(0).toUpperCase() + suffix.slice(1);
         }
         
         displayLabel = `${type} ${suffix}`;
      }

      // 创建用于 Stencil 显示的节点
      const node = graph.createNode({
        shape: shapeId,
        width: displayW,   // 使用缩放后的尺寸
        height: displayH,
        label: displayLabel, // 使用优化后的标签
        attrs: {
          // 强制调整 label 位置，防止在缩略图中跑偏
          label: { 
            fontSize: 10, 
            refY: '100%', 
            refY2: 4,
            textWrap: { width: 90, ellipsis: true } // 防止文字过长
          }
        },
        data: { 
          ...config.data,
          // [关键] 记录原始尺寸，供 getDropNode 恢复
          originalSize: { width: originalW, height: originalH } 
        } 
      });

      if (stencilNodes[groupName]) {
        stencilNodes[groupName].push(node);
      }
    });

    // 4. 一次性加载所有分组
    stencil.load(stencilNodes.main_equip, 'main_equip');
    stencil.load(stencilNodes.pumps, 'pumps');
    stencil.load(stencilNodes.instruments, 'instruments');
    stencil.load(stencilNodes.parts, 'parts');

    const setupBackgroundFrame = () => {
      if (graph.getNodes().some(n => n.getData()?.isBackground)) return;
      graph.addNode({ shape: 'drawing-frame-a2', id: 'SHEET_FRAME_A2', x: 0, y: 0, zIndex: -1, movable: false, selectable: false, data: { type: 'Frame', isBackground: true } });
    };

    const initCanvasData = async () => {
      setupBackgroundFrame();
      try {
        const data = await loadGraphData();
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