import React, { useEffect, useRef, useState } from 'react';
import { Graph, Cell } from '@antv/x6'; // 引入 Cell 类型
import { Stencil } from '@antv/x6-plugin-stencil';
import Inspector from '../Inspector'; // 引入刚才写的组件
// import '@antv/x6-plugin-stencil/dist/style.css'; 
import './index.css';
import { registerCustomCells } from '../../../graph/cells/registry';

try { registerCustomCells(); } catch (e) { console.warn(e); }

const GraphCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stencilRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);

  // 新增状态：当前选中的节点
  const [selectedCell, setSelectedCell] = useState<Cell | null>(null);

  useEffect(() => {
    if (!containerRef.current || !stencilRef.current) return;

    // 1. 校验规则
    const validateConnection = ({ sourceMagnet, targetMagnet }: any) => {
      if (!sourceMagnet || !targetMagnet) return false;
      const sPort = sourceMagnet.getAttribute('port');
      const tPort = targetMagnet.getAttribute('port');
      if (sPort && tPort) {
        return sPort.includes('out') && tPort.includes('in');
      }
      return false;
    };

    // 2. 初始化画布
    const graph = new Graph({
      container: containerRef.current,
      autoResize: true,
      grid: { size: 10, visible: true, type: 'doubleMesh', args: [{ color: '#eee' }, { color: '#ddd', factor: 4 }] },
      panning: true,
      mousewheel: { enabled: true, modifiers: ['ctrl', 'meta'] },
      connecting: {
        router: 'manhattan',
        connector: { name: 'rounded', args: { radius: 8 } },
        anchor: 'center',
        connectionPoint: 'anchor',
        snap: true,
        allowBlank: false,
        validateConnection,
      },
    });
    graphRef.current = graph;

    // --- 新增：事件监听 ---
    // 选中节点时
    graph.on('node:click', ({ cell }) => {
      setSelectedCell(cell);
    });
    // 点击空白处时，取消选中
    graph.on('blank:click', () => {
      setSelectedCell(null);
    });
    // -------------------

    // 3. Stencil 初始化
    const stencil = new Stencil({
      title: '组件库',
      target: graph,
      stencilGraphWidth: 200,
      stencilGraphHeight: 180,
      collapsable: true,
      groups: [
        { title: '主设备', name: 'main_equip' },
        { title: '管路附件', name: 'parts' },
      ],
      layoutOptions: { columns: 1, columnWidth: 180, rowHeight: 100 },
    });
    stencilRef.current.appendChild(stencil.container);

    const r1 = graph.createNode({ shape: 'custom-reactor', label: '反应釜' });
    const p1 = graph.createNode({ shape: 'custom-pump', label: '离心泵' });
    const v1 = graph.createNode({ shape: 'custom-valve', label: '阀门' });

    stencil.load([r1, p1], 'main_equip');
    stencil.load([v1], 'parts');

    return () => {
      graph.dispose();
    };
  }, []);

  return (
    <div className="editor-container">
      {/* 左侧 */}
      <div ref={stencilRef} className="stencil-container" />
      
      {/* 中间 */}
      <div ref={containerRef} className="canvas-container" />
      
      {/* 右侧：属性面板 */}
      <div className="inspector-container">
        <Inspector cell={selectedCell} />
      </div>
    </div>
  );
};

export default GraphCanvas;