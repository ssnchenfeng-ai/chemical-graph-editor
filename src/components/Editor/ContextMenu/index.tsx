import React from 'react';
import { 
  DeleteOutlined, 
  CopyOutlined, 
  SnippetsOutlined, 
  InfoCircleOutlined, 
  ClearOutlined,
  RotateRightOutlined // <--- 新增图标
} from '@ant-design/icons';
import './index.css';

// ... (MenuState 接口保持不变)
export interface MenuState {
  visible: boolean;
  x: number;
  y: number;
  type: 'node' | 'edge' | 'blank' | null;
  cellId?: string;
}

// ... (Props 接口保持不变)
interface ContextMenuProps {
  visible: boolean;
  x: number;
  y: number;
  type: 'node' | 'edge' | 'blank' | null;
  onClose: () => void;
  onAction: (action: string) => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ visible, x, y, type, onClose, onAction }) => {
  if (!visible) return null;

  const handleItemClick = (action: string) => {
    onAction(action);
    onClose();
  };

  return (
    <>
      <div 
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9998 }} 
        onClick={(e) => { e.stopPropagation(); onClose(); }} 
        onContextMenu={(e) => { e.preventDefault(); onClose(); }}
      />
      
      <div 
        className="context-menu" 
        style={{ left: x, top: y }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* --- 选中节点/连线 --- */}
        {(type === 'node' || type === 'edge') && (
          <>
            {/* 仅节点显示旋转和复制 */}
            {type === 'node' && (
              <>
                <div className="context-menu-item" onClick={() => handleItemClick('copy')}>
                  <CopyOutlined /> 复制
                </div>
                <div className="context-menu-item" onClick={() => handleItemClick('rotate')}>
                  <RotateRightOutlined /> 旋转 90°
                </div>
                <div className="context-menu-divider" />
              </>
            )}
            
            <div className="context-menu-item" onClick={() => handleItemClick('property')}>
              <InfoCircleOutlined /> 属性详情
            </div>
            <div className="context-menu-divider" />
            <div className="context-menu-item danger" onClick={() => handleItemClick('delete')}>
              <DeleteOutlined /> 删除
            </div>
          </>
        )}

        {/* --- 空白处 --- */}
        {type === 'blank' && (
          <>
            <div className="context-menu-item" onClick={() => handleItemClick('paste')}>
              <SnippetsOutlined /> 粘贴
            </div>
            <div className="context-menu-divider" />
            <div className="context-menu-item" onClick={() => handleItemClick('fit')}>
              <InfoCircleOutlined /> 适应画布
            </div>
            <div className="context-menu-item danger" onClick={() => handleItemClick('clear')}>
              <ClearOutlined /> 清空所有
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default ContextMenu;