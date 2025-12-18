import React, { useEffect, useState } from 'react';
import { Button, Tooltip } from 'antd';
import { 
  ZoomInOutlined, 
  ZoomOutOutlined, 
  UndoOutlined, 
  RedoOutlined, 
  ExpandOutlined, 
  CompressOutlined, 
  DeleteOutlined
} from '@ant-design/icons';
import { Graph } from '@antv/x6';

import './index.css';

interface ToolbarProps {
  graph: Graph | null;
}

const Toolbar: React.FC<ToolbarProps> = ({ graph }) => {
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [designerVisible, setDesignerVisible] = useState(false);

  useEffect(() => {
    if (!graph) return;

    // [修复类型报错]
    // X6 的 Graph 类型定义中不包含 history 属性，需要断言为 any 才能访问插件实例
    const history = (graph as any).history;
    
    // 防御性检查：确保插件已加载
    if (!history) return;

    const updateState = () => {
      setCanUndo(history.canUndo());
      setCanRedo(history.canRedo());
    };

    history.on('change', updateState);
    history.on('undo', updateState);
    history.on('redo', updateState);
    
    // 初始化状态
    updateState();
    
    return () => {
      history.off('change', updateState);
      history.off('undo', updateState);
      history.off('redo', updateState);
    };
  }, [graph]);

  if (!graph) return null;

  // 辅助函数：安全调用 history
  const getHistory = () => (graph as any).history;

  return (
    <>
      <div className="toolbar-container">
        <Tooltip title="撤销 (Cmd+Z)">
          <Button 
            type="text" 
            icon={<UndoOutlined />} 
            disabled={!canUndo} 
            onClick={() => getHistory()?.undo()} 
          />
        </Tooltip>
        <Tooltip title="重做 (Cmd+Shift+Z)">
          <Button 
            type="text" 
            icon={<RedoOutlined />} 
            disabled={!canRedo} 
            onClick={() => getHistory()?.redo()} 
          />
        </Tooltip>
        
        <span style={{ width: 1, height: 16, background: '#eee', margin: '0 4px' }} />
        
        <Tooltip title="放大">
          <Button type="text" icon={<ZoomInOutlined />} onClick={() => graph.zoom(0.1)} />
        </Tooltip>
        <Tooltip title="缩小">
          <Button type="text" icon={<ZoomOutOutlined />} onClick={() => graph.zoom(-0.1)} />
        </Tooltip>
        <Tooltip title="适应画布">
          <Button type="text" icon={<CompressOutlined />} onClick={() => graph.zoomToFit({ padding: 20 })} />
        </Tooltip>
        <Tooltip title="1:1">
          <Button type="text" icon={<ExpandOutlined />} onClick={() => graph.zoomTo(1)} />
        </Tooltip>

        <span style={{ width: 1, height: 16, background: '#eee', margin: '0 4px' }} />

        <Tooltip title="删除选中 (Delete)">
          <Button 
            type="text" 
            danger
            icon={<DeleteOutlined />} 
            onClick={() => {
              const cells = graph.getSelectedCells();
              if(cells.length) graph.removeCells(cells);
            }} 
          />
        </Tooltip>

        
      </div>

     
    </>
  );
};

export default Toolbar;