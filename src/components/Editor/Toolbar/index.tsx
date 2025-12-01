import React, { useEffect, useState } from 'react';
import { Button, Tooltip, Divider } from 'antd';
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

  useEffect(() => {
    // 1. 基础检查
    if (!graph) return;

    // 2. 防御性检查：确保 history 插件已加载
    // 如果 graph.history 是 undefined，说明插件还没初始化好，直接返回，避免崩溃
    const { history } = graph;
    if (!history) {
      return;
    }

    const updateState = () => {
      setCanUndo(history.canUndo());
      setCanRedo(history.canRedo());
    };

    // 3. 安全订阅事件
    history.on('change', updateState);
    history.on('undo', updateState);
    history.on('redo', updateState);
        // 初始化时先执行一次
    updateState();
    
    return () => {
      history.off('change', updateState);
      history.off('undo', updateState);
      history.off('redo', updateState);
    };
  }, [graph]);

  if (!graph) return null;

  return (
    <div className="toolbar-container">
      <Tooltip title="撤销 (Cmd+Z)">
        <Button type="text" icon={<UndoOutlined />} disabled={!canUndo} onClick={() => graph?.history?.undo()} />
      </Tooltip>
      <Tooltip title="重做 (Cmd+Shift+Z)">
        <Button type="text" icon={<RedoOutlined />} disabled={!canRedo} onClick={() => graph?.history?.redo()} />
      </Tooltip>
      
      {/* 修复 Antd Divider 警告，去掉 type="vertical"，使用 CSS 或默认即可，这里用 style 模拟 */}
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
  );
};

export default Toolbar;