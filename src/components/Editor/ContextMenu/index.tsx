import React from 'react';
import { 
  DeleteOutlined, 
  CopyOutlined, 
  SnippetsOutlined, 
  InfoCircleOutlined, 
  ClearOutlined,
  RotateRightOutlined ,
  ArrowUpOutlined,
  ArrowDownOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  AlignCenterOutlined
} from '@ant-design/icons';
import './index.css';

export interface MenuState {
  visible: boolean;
  x: number;
  y: number;
  type: 'node' | 'edge' | 'blank' | null;
  cellId?: string;
}

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
    // 使用 try-catch 包裹 action 执行，防止报错阻止菜单关闭
    try {
      onAction(action);
    } catch (e) {
      console.error('Menu action failed:', e);
    } finally {
      // 无论成功失败，都延迟关闭菜单
      setTimeout(() => {
        onClose();
      }, 100);
    }
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
            <div className="context-menu-item" onClick={() => handleItemClick('copy')}>
              <CopyOutlined /> 复制
            </div>

            {/* 仅节点显示粘贴和旋转 */}
            {type === 'node' && (
              <>
                <div className="context-menu-item" onClick={() => handleItemClick('paste')}>
                  <SnippetsOutlined /> 粘贴
                </div>
                <div className="context-menu-item" onClick={() => handleItemClick('rotate')}>
                  <RotateRightOutlined /> 旋转 90°
                </div>
                {/* ================= [新增开始] ================= */}
                <div className="context-menu-divider" />
                
                <div style={{ padding: '4px 12px', fontSize: '12px', color: '#999', cursor: 'default' }}>
                  位号位置
                </div>
                <div className="context-menu-item" onClick={() => handleItemClick('label:top')}>
                  <ArrowUpOutlined /> 上方
                </div>
                <div className="context-menu-item" onClick={() => handleItemClick('label:bottom')}>
                  <ArrowDownOutlined /> 下方
                </div>
                <div className="context-menu-item" onClick={() => handleItemClick('label:left')}>
                  <ArrowLeftOutlined /> 左侧
                </div>
                <div className="context-menu-item" onClick={() => handleItemClick('label:right')}>
                  <ArrowRightOutlined /> 右侧
                </div>
                <div className="context-menu-item" onClick={() => handleItemClick('label:center')}>
                  <AlignCenterOutlined /> 居中
                </div>
                {/* ================= [新增结束] ================= */}
              </>
            )}
            
            <div className="context-menu-divider" />
            
            <div className="context-menu-item" onClick={() => handleItemClick('property')}>
              <InfoCircleOutlined /> 属性详情
            </div>
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