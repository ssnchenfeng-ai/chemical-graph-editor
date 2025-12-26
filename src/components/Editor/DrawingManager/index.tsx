// src/components/Editor/DrawingManager/index.tsx
import React, { useEffect, useState } from 'react';
import { Button, Input, Modal, Dropdown, message } from 'antd';
import type { MenuProps } from 'antd'; // 单独导入类型
import { PlusOutlined, EditOutlined, DeleteOutlined, FileOutlined } from '@ant-design/icons';
import { useDrawingStore } from '../../../store/drawingStore';

// [新增] Props 定义
interface DrawingManagerProps {
  onSwitch?: (targetId: string) => void;
}

const DrawingManager: React.FC<DrawingManagerProps> = ({ onSwitch }) => {
  const { drawings, currentDrawingId, init, addDrawing, removeDrawing, setCurrentDrawing, updateDrawingName } = useDrawingStore();
  
  // Modal 状态
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [newDrawingName, setNewDrawingName] = useState('');
  const [isRenameModalVisible, setIsRenameModalVisible] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{id: string, name: string} | null>(null);
  const [renameValue, setRenameValue] = useState('');

  useEffect(() => { init(); }, []);

  // --- 动作处理 ---
  const handleCreate = async () => {
    if (!newDrawingName.trim()) return;
    await addDrawing(newDrawingName);
    setIsCreateModalVisible(false);
    setNewDrawingName('');
  };

  const handleRename = async () => {
    if (!renameTarget || !renameValue.trim()) return;
    await updateDrawingName(renameTarget.id, renameValue);
    setIsRenameModalVisible(false);
    setRenameTarget(null);
  };

  const triggerRename = (drawing: {id: string, name: string}) => {
    setRenameTarget(drawing);
    setRenameValue(drawing.name);
    setIsRenameModalVisible(true);
  };

  const handleDelete = (id: string) => {
    if (drawings.length <= 1) {
      message.warning("至少保留一张图纸");
      return;
    }
    Modal.confirm({
      title: '删除图纸',
      content: '确定要删除这张图纸及其所有内容吗？此操作不可恢复。',
      okType: 'danger',
      onOk: () => removeDrawing(id)
    });
  };

  // [修改] 点击处理：优先使用 onSwitch
  const handleTabClick = (id: string) => {
    if (id === currentDrawingId) return;
    if (onSwitch) {
      onSwitch(id);
    } else {
      setCurrentDrawing(id);
    }
  };

  // --- 渲染 ---
  return (
    <div style={{ 
      height: '36px', 
      background: '#f0f0f0', 
      borderTop: '1px solid #d9d9d9', 
      display: 'flex', 
      alignItems: 'flex-end', // 让 Tab 底部对齐
      paddingLeft: '10px',
      userSelect: 'none'
    }}>
      {/* 1. Tab 列表区域 */}
      <div style={{ display: 'flex', overflowX: 'auto', maxWidth: 'calc(100% - 40px)' }}>
        {drawings.map(drawing => {
          const isActive = drawing.id === currentDrawingId;
          
          // 右键菜单配置
          const menuItems: MenuProps['items'] = [
            { key: 'rename', label: '重命名', icon: <EditOutlined />, onClick: () => triggerRename(drawing) },
            { key: 'delete', label: '删除', icon: <DeleteOutlined />, danger: true, onClick: () => handleDelete(drawing.id), disabled: drawings.length <= 1 },
          ];

          return (
            <Dropdown key={drawing.id} menu={{ items: menuItems }} trigger={['contextMenu']}>
              <div
                onClick={() => handleTabClick(drawing.id)} // [修改] 使用新的 handler
                onDoubleClick={() => triggerRename(drawing)} // 双击重命名
                style={{
                  padding: '0 15px',
                  height: '30px',
                  lineHeight: '30px',
                  background: isActive ? '#fff' : '#e0e0e0',
                  borderRight: '1px solid #ccc',
                  borderTop: isActive ? '2px solid #1890ff' : '1px solid transparent', // 激活时顶部有蓝条
                  borderBottom: isActive ? 'none' : '1px solid #ccc', // 激活时底部与画布连通
                  color: isActive ? '#1890ff' : '#666',
                  fontWeight: isActive ? 600 : 400,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  minWidth: '80px',
                  maxWidth: '150px',
                  transition: 'all 0.1s'
                }}
              >
                <FileOutlined style={{ fontSize: 12 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {drawing.name}
                </span>
              </div>
            </Dropdown>
          );
        })}
      </div>

      {/* 2. 新建按钮 */}
      <div 
        onClick={() => setIsCreateModalVisible(true)}
        style={{
          width: '30px',
          height: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          marginLeft: '5px',
          marginBottom: '3px',
          borderRadius: '4px',
          color: '#666'
        }}
        className="hover:bg-gray-200" 
      >
        <PlusOutlined />
      </div>

      {/* Modals */}
      <Modal title="新建图纸" open={isCreateModalVisible} onOk={handleCreate} onCancel={() => setIsCreateModalVisible(false)} width={400}>
        <Input placeholder="图纸名称 (如: Page-002)" value={newDrawingName} onChange={e => setNewDrawingName(e.target.value)} onPressEnter={handleCreate} autoFocus />
      </Modal>

      <Modal title="重命名图纸" open={isRenameModalVisible} onOk={handleRename} onCancel={() => setIsRenameModalVisible(false)} width={400}>
        <Input placeholder="新名称" value={renameValue} onChange={e => setRenameValue(e.target.value)} onPressEnter={handleRename} autoFocus />
      </Modal>
    </div>
  );
};

export default DrawingManager;