import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { Graph, Cell } from '@antv/x6';
import { Stencil } from '@antv/x6-plugin-stencil';
import { Keyboard } from '@antv/x6-plugin-keyboard';
import { Selection } from '@antv/x6-plugin-selection';
import { History } from '@antv/x6-plugin-history';
import { Button, Tooltip, message, Modal } from 'antd';
import { 
  ZoomInOutlined, ZoomOutOutlined, OneToOneOutlined, CompressOutlined, 
  UndoOutlined, RedoOutlined, ClearOutlined 
} from '@ant-design/icons';

// 自定义组件与服务
import Inspector from '../Inspector';
import ContextMenu, { type MenuState } from '../ContextMenu'; // 引入右键菜单
import './index.css';
import { registerCustomCells } from '../../../graph/cells/registry';
import { saveGraphData, loadGraphData } from '../../../services/neo4j'; 

// 注册自定义图元
try { registerCustomCells(); } catch (e) { console.warn(e); }

export interface GraphCanvasRef {
  handleSave: () => Promise<void>;
}

const GraphCanvas = forwardRef<GraphCanvasRef, {}>((_, ref) => {
  // --- Refs ---
  const containerRef = useRef<HTMLDivElement>(null);
  const stencilRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);
  const historyRef = useRef<History | null>(null);
    // 1. 新增一个 Ref 用于剪贴板
const clipboardRef = useRef<any>(null); // 存储被复制的节点数据

  // --- State ---
  const [selectedCell, setSelectedCell] = useState<Cell | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  
  // 右键菜单状态
  const [menu, setMenu] = useState<MenuState>({ visible: false, x: 0, y: 0, type: null });



  // --- 暴露给父组件的方法 (如保存) ---
  useImperativeHandle(ref, () => ({
    handleSave: async () => {
      if (!graphRef.current) return;
      const graph = graphRef.current;
      
      // 1. 提取节点数据
      const nodes = graph.getNodes().map(node => {
        const data = node.getData() || {};
        const pos = node.getPosition();
        return {
          id: node.id,
          label: node.getAttrs()?.label?.text || '',
          type: data.type || 'Unknown',
          spec: data.spec || '',
          x: pos.x, y: pos.y
        };
      });

      // 2. 提取连线数据 (包含管线属性)
      const edges = graph.getEdges().map(edge => {
        const data = edge.getData() || {};
        // 获取连线 Label 文字
        const labelObj = edge.getLabelAt(0);
        const labelText = typeof labelObj === 'string' ? labelObj : (labelObj?.attrs?.label?.text || '');

        return {
          source: edge.getSourceCell()?.id,
          target: edge.getTargetCell()?.id,
          sourcePort: edge.getSourcePortId(),
          targetPort: edge.getTargetPortId(),
          // 持久化管线属性
          material: data.material || 'CS',
          fluid: data.fluid || 'Water',
          label: labelText
        };
      });

      try {
        await saveGraphData(nodes, edges);
        message.success(`保存成功！存档: ${nodes.length} 设备, ${edges.length} 管线`);
      } catch (error) {
        console.error(error);
        message.error('保存失败，请检查数据库连接');
      }
    }
  }));

  // --- 工具栏动作 ---
  const onUndo = () => historyRef.current?.undo();
  const onRedo = () => historyRef.current?.redo();
  const onZoom = (f: number) => graphRef.current?.zoom(f);
  const onZoomToFit = () => graphRef.current?.zoomToFit({ padding: 20 });
  const onZoomReset = () => graphRef.current?.zoomTo(1);
  const onClear = () => {
    Modal.confirm({
      title: '清空画布',
      content: '确定要清空吗？此操作无法撤销。',
      okType: 'danger',
      onOk: () => {
        graphRef.current?.clearCells();
        setSelectedCell(null);
      },
    });
  };

  // --- 右键菜单动作处理 ---
const handleMenuAction = (action: string) => {
  const { cellId, x, y } = menu; // 注意：这里需要确保 menu 状态里存了点击时的 x, y
  const graph = graphRef.current;
  if (!graph) return;

  switch (action) {
    case 'delete':
      if (cellId) {
        const cell = graph.getCellById(cellId);
        if (cell) {
          graph.removeCell(cell);
          setSelectedCell(null); // 删除后清空选中
        }
      }
      break;

    case 'copy':
      if (cellId) {
        const cell = graph.getCellById(cellId);
        if (cell && cell.isNode()) {
          // 简单的克隆数据
          clipboardRef.current = cell.toJSON();
          message.success('已复制');
        }
      }
      break;

    case 'paste':
      if (clipboardRef.current) {
        // 1. 反序列化
        const nodeData = clipboardRef.current;
        // 2. 将点击屏幕的坐标 (Screen Coords) 转换为画布坐标 (Graph Coords)
        const point = graph.clientToLocal({ x: menu.x, y: menu.y });
        
        // 3. 创建新节点
        const newNode = graph.createNode({
          ...nodeData,
          x: point.x,
          y: point.y,
          id: undefined, // 必须清除 ID，让 X6 生成新的
          zIndex: 10,
        });
        
        graph.addNode(newNode);
        // 粘贴后自动选中它
        graph.cleanSelection();
        graph.select(newNode);
        setSelectedCell(newNode);
      } else {
        message.warning('剪贴板为空');
      }
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
    default:
      break;
  }
};

  // --- 核心初始化逻辑 ---
  useEffect(() => {
    if (!containerRef.current || !stencilRef.current) return;

    // 🛑 React 18 严格模式补丁：强制清空容器防止重复渲染
    stencilRef.current.innerHTML = '';

    // 1. 初始化 Graph
    const graph = new Graph({
      container: containerRef.current,
      autoResize: true,
      grid: { size: 10, visible: true, type: 'doubleMesh', args: [{ color: '#eee' }, { color: '#ddd', factor: 4 }] },
      panning: { enabled: true, eventTypes: ['rightMouseDown'] }, // 右键平移
      mousewheel: {
        enabled: true,
        zoomAtMousePosition: true,
        modifiers: null, // 直接滚轮缩放
        factor: 1.1,
        maxScale: 3,
        minScale: 0.5,
      },
      connecting: {
        router: 'manhattan',
        connector: { name: 'rounded', args: { radius: 8 } },
        anchor: 'center',
        connectionPoint: 'anchor',
        snap: true,
        allowBlank: false,
        highlight: true,
        // 连线校验：Out -> In
        validateConnection: ({ sourceMagnet, targetMagnet }: any) => {
          if (!sourceMagnet || !targetMagnet) return false;
          const sPort = sourceMagnet.getAttribute('port');
          const tPort = targetMagnet.getAttribute('port');
          if (sPort && tPort) return sPort.includes('out') && tPort.includes('in');
          return false;
        },
        // 创建连线时的默认样式与数据
        createEdge() {
          return this.createEdge({
            shape: 'edge',
            attrs: {
              line: { 
                stroke: '#5F95FF', 
                strokeWidth: 2, 
                targetMarker: { name: 'block', width: 12, height: 8 } 
              },
            },
            data: { material: 'CS', fluid: 'Water' } // 默认数据
          });
        },
      },
    });
    graphRef.current = graph;

    // 2. 插件注册
    graph.use(new Selection({
      enabled: true, multiple: true, rubberband: true, movable: true, showNodeSelectionBox: true,
    }));
    graph.use(new Keyboard({ enabled: true }));
    
    const historyInstance = new History({ 
      enabled: true, ignoreAdd: false, ignoreRemove: false, ignoreChange: false,
    });
    graph.use(historyInstance);
    historyRef.current = historyInstance;

    // 3. 事件监听
    graph.on('history:change', () => {
      setCanUndo(historyInstance.canUndo());
      setCanRedo(historyInstance.canRedo());
    });

    // 快捷键删除
    graph.bindKey(['backspace', 'delete'], () => {
      const cells = graph.getSelectedCells();
      if (cells.length) {
        graph.removeCells(cells);
        setSelectedCell(null);
      }
    });

    // 选中事件 (处理视觉反馈)
    graph.on('cell:click', ({ cell }) => {
      setSelectedCell(cell);
      // 简单的视觉高亮：如果是连线，加粗
      if (cell.isEdge()) {
        cell.attr('line/strokeWidth', 3);
      }
      // 重置其他连线
      graph.getEdges().forEach(edge => {
        if (edge.id !== cell.id) edge.attr('line/strokeWidth', 2);
      });
    });

    graph.on('blank:click', () => {
      setSelectedCell(null);
      // 重置所有连线样式
      graph.getEdges().forEach(edge => edge.attr('line/strokeWidth', 2));
    });

    // --- 右键菜单事件拦截 ---
    graph.on('cell:contextmenu', ({ e, x, y, cell }) => {
      setSelectedCell(cell); // 右键同时也选中
      setMenu({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        type: cell.isNode() ? 'node' : 'edge',
        cellId: cell.id
      });
    });

    graph.on('blank:contextmenu', ({ e }) => {
      setMenu({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        type: 'blank'
      });
    });

    // 4. Stencil (组件库)
    const stencil = new Stencil({
      title: '组件库',
      target: graph,
      stencilGraphWidth: 240,
      stencilGraphHeight: 0,
      collapsable: true,
      search: { visible: true, placeholder: '搜索设备...' },
      groups: [
        { 
          title: '主工艺设备', 
          name: 'main_equip',
          layoutOptions: { columns: 1, columnWidth: 220, rowHeight: 170 } 
        }, 
        { 
          title: '管路附件', 
          name: 'parts',
          layoutOptions: { columns: 2, columnWidth: 100, rowHeight: 110 } 
        }
      ],
    });
    stencilRef.current.appendChild(stencil.container);

    // 5. 生成预设组件
    const reactors = ['500L', '1000L', '2000L', '5000L', 'Glass-Lined'].map(spec => 
      graph.createNode({
        shape: 'custom-reactor',
        label: `反应釜\n${spec}`,
        data: { type: 'Reactor', spec: spec },
      })
    );
    const pumps = ['P-101', 'P-102'].map(p => 
      graph.createNode({
        shape: 'custom-pump',
        label: `泵 ${p}`,
        data: { type: 'Pump', spec: p },
      })
    );
    const valves = Array.from({length: 12}, (_, i) => 
      graph.createNode({
        shape: 'custom-valve',
        label: `阀门-${i+1}`,
        data: { type: 'Valve', spec: `DN${(i+1)*10}` },
      })
    );
    
    stencil.load([...reactors, ...pumps], 'main_equip');
    stencil.load(valves, 'parts');

    // 6. 数据加载 (Demo or DB)
    const initCanvasData = async () => {
      try {
        const data = await loadGraphData();
        if (data && data.nodes.length > 0) {
          graph.fromJSON(data);
          graph.centerContent();
        } else {
          // 如果数据库为空，加载演示数据
          const demoReactor = graph.createNode({ 
            shape: 'custom-reactor', label: 'R-101', x: 200, y: 150, 
            data: { type: 'Reactor', spec: 'Demo' } 
          });
          const demoPump = graph.createNode({ 
            shape: 'custom-pump', label: 'P-201', x: 500, y: 300, 
            data: { type: 'Pump', spec: 'Demo' } 
          });
          graph.addCell([demoReactor, demoPump]);
        }
      } catch (error) {
        console.error('加载数据失败:', error);
      }
    };
    // 延迟执行以确保容器渲染完毕
    setTimeout(initCanvasData, 100);

    // 7. 清理函数
    return () => {
      graph.dispose();
      if (stencilRef.current) stencilRef.current.innerHTML = '';
    };
  }, []);

  return (
    <div className="editor-container">
      {/* 左侧组件库 */}
      <div ref={stencilRef} className="stencil-container" />
      
      {/* 顶部悬浮工具栏 */}
      <div className="toolbar-container">
        <div className="toolbar-group">
          <Tooltip title="撤销"><Button type="text" icon={<UndoOutlined />} disabled={!canUndo} onClick={onUndo} /></Tooltip>
          <Tooltip title="重做"><Button type="text" icon={<RedoOutlined />} disabled={!canRedo} onClick={onRedo} /></Tooltip>
        </div>
        <div className="toolbar-group">
          <Tooltip title="放大"><Button type="text" icon={<ZoomInOutlined />} onClick={() => onZoom(0.1)} /></Tooltip>
          <Tooltip title="缩小"><Button type="text" icon={<ZoomOutOutlined />} onClick={() => onZoom(-0.1)} /></Tooltip>
          <Tooltip title="适应"><Button type="text" icon={<CompressOutlined />} onClick={onZoomToFit} /></Tooltip>
          <Tooltip title="1:1"><Button type="text" icon={<OneToOneOutlined />} onClick={onZoomReset} /></Tooltip>
        </div>
        <div className="toolbar-group">
           <Tooltip title="清空"><Button type="text" danger icon={<ClearOutlined />} onClick={onClear} /></Tooltip>
        </div>
      </div>

      {/* 中心画布 */}
      <div ref={containerRef} className="canvas-container" />
      
      {/* 右侧属性面板 */}
      <div className="inspector-container">
        <Inspector cell={selectedCell} />
      </div>

      {/* 右键菜单 (全局层级) */}
      <ContextMenu 
        visible={menu.visible}
        x={menu.x}
        y={menu.y}
        type={menu.type}
        onClose={() => setMenu({ ...menu, visible: false })}
        onAction={handleMenuAction}
      />
    </div>
  );
});

export default GraphCanvas;