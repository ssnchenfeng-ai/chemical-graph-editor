// src/App.tsx
import { useRef, useState } from 'react';
import { Button, Layout, message, Radio, Modal } from 'antd'; // [新增] Modal
import { 
  SaveOutlined, 
  DatabaseOutlined, 
  ToolOutlined, 
  ArrowLeftOutlined,
  FormOutlined 
} from '@ant-design/icons';

import GraphCanvas from './components/Editor/Canvas';
import type { GraphCanvasRef } from './components/Editor/Canvas';
import ShapeDesigner from './components/DevTools/ShapeDesigner';
import AttributeDesigner from './components/DevTools/AttributeDesigner';
import DrawingManager from './components/Editor/DrawingManager';
import { useDrawingStore } from './store/drawingStore';

const { Header, Content } = Layout;

function App() {
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<'editor' | 'designer' | 'attributes'>('editor');
  const graphRef = useRef<GraphCanvasRef>(null);
  
  // [修改] 获取 isDirty 和 setCurrentDrawing
  const { currentDrawingId, currentDrawingName, isDirty, setCurrentDrawing } = useDrawingStore();

  const handleSaveClick = async () => {
    if (graphRef.current && currentDrawingId) {
      setSaving(true);
      try {
        await graphRef.current.handleSave(currentDrawingId);
      } catch (e) {
        console.error(e);
        message.error('保存操作异常');
      } finally {
        setSaving(false);
      }
    } else {
        if(!currentDrawingId) message.warning("未选择图纸");
    }
  };

  // [新增] 切换图纸前的拦截逻辑
  const handleSwitchDrawing = (targetId: string) => {
    // 如果当前有未保存的修改，且当前有选中的图纸
    if (isDirty && currentDrawingId) {
      Modal.confirm({
        title: '未保存的更改',
        content: '当前图纸有未保存的修改，是否保存？',
        okText: '保存并切换',
        cancelText: '不保存',
        // 自定义底部按钮以区分 "取消操作" 和 "不保存直接切换"
        footer: (_, { OkBtn }) => (
          <>
            <Button onClick={() => Modal.destroyAll()}>取消</Button>
            <Button danger onClick={() => {
              Modal.destroyAll();
              setCurrentDrawing(targetId); // 不保存，直接切换
            }}>
              不保存
            </Button>
            <OkBtn />
          </>
        ),
        onOk: async () => {
          if (graphRef.current) {
            try {
              setSaving(true);
              // 先保存当前图纸
              await graphRef.current.handleSave(currentDrawingId);
              // 保存成功后切换
              setCurrentDrawing(targetId);
            } catch (e) {
              // 保存失败，停留在当前页，不切换
              console.error("Save failed during switch", e);
            } finally {
              setSaving(false);
            }
          }
        }
      });
    } else {
      // 没有修改，直接切换
      setCurrentDrawing(targetId);
    }
  };

  // --- 渲染开发者模式 ---
  if (mode === 'designer' || mode === 'attributes') {
    return (
      <Layout style={{ height: '100vh' }}>
        <Header style={{ 
          display: 'flex', alignItems: 'center', color: 'white', 
          height: '50px', padding: '0 20px', flexShrink: 0,
          justifyContent: 'space-between', background: '#001529'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 10 }}>
              <ToolOutlined /> 开发者工具箱
            </div>
            
            <Radio.Group 
              value={mode} 
              onChange={e => setMode(e.target.value)} 
              buttonStyle="solid"
              size="small"
            >
              <Radio.Button value="designer"><ToolOutlined /> 图形设计 (Shape)</Radio.Button>
              <Radio.Button value="attributes"><FormOutlined /> 属性定义 (Attribute)</Radio.Button>
            </Radio.Group>
          </div>

          <Button 
            type="primary" 
            ghost 
            icon={<ArrowLeftOutlined />} 
            onClick={() => setMode('editor')}
          >
            返回编辑器
          </Button>
        </Header>
        <Content style={{ height: 'calc(100vh - 50px)', overflow: 'hidden' }}>
          {mode === 'designer' ? <ShapeDesigner /> : <AttributeDesigner />}
        </Content>
      </Layout>
    );
  }

  // --- 渲染主编辑器 ---
  return (
    <Layout style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header style={{ 
        display: 'flex', alignItems: 'center', color: 'white', 
        height: '50px', padding: '0 20px', flexShrink: 0,
        justifyContent: 'space-between' 
      }}>
        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 10 }}>
          <DatabaseOutlined />
          {/* 显示当前图纸名称 */}
          <span>
            🧪 化工 P&ID 编辑器 
            <span style={{ fontSize: '0.8em', fontWeight: 'normal', marginLeft: 10, opacity: 0.8 }}>
               - {currentDrawingName || 'Loading...'}
               {isDirty && <span style={{ color: '#ffec3d', marginLeft: 5 }}>*</span>} {/* 显示未保存标记 */}
            </span>
          </span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button 
              type="dashed" 
              ghost 
              icon={<ToolOutlined />} 
              onClick={() => setMode('designer')} 
            >
              DevTools
            </Button>
          <Button 
            type="primary" 
            icon={<SaveOutlined />} 
            loading={saving}
            onClick={handleSaveClick}
          >
            保存图纸到 Neo4j
          </Button>
        </div>
      </Header>
      
      <Content style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        
        {/* 1. 画布区域 (flex: 1 占据剩余空间) */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
           <GraphCanvas ref={graphRef} drawingId={currentDrawingId} />
        </div>

        {/* 2. 底部图纸栏 (固定高度) */}
        <div style={{ flexShrink: 0, zIndex: 100 }}>
          {/* [修改] 传入 onSwitch 处理函数 */}
          <DrawingManager onSwitch={handleSwitchDrawing} />
        </div>

      </Content>
    </Layout>
  );
}

export default App;