import { useRef, useState } from 'react';
import { Button, Layout, message, Radio } from 'antd';
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

const { Header, Content } = Layout;

function App() {
  const [saving, setSaving] = useState(false);
  // mode 增加 'attributes' 状态
  const [mode, setMode] = useState<'editor' | 'designer' | 'attributes'>('editor');
  const graphRef = useRef<GraphCanvasRef>(null);

  const handleSaveClick = async () => {
    if (graphRef.current) {
      setSaving(true);
      try {
        await graphRef.current.handleSave();
      } catch (e) {
        console.error(e);
        message.error('保存操作异常');
      } finally {
        setSaving(false);
      }
    } else {
        console.warn("GraphRef is null");
    }
  };

  // --- 渲染开发者模式 (包含 图元设计 和 属性设计) ---
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
            
            {/* 顶部切换 Tab */}
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
          🧪 化工 P&ID 编辑器
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button 
              type="dashed" 
              ghost 
              icon={<ToolOutlined />} 
              onClick={() => setMode('designer')} // 默认进入图形设计
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
      
      <Content style={{ position: 'relative', flex: 1, overflow: 'hidden', display: 'flex' }}>
        <GraphCanvas ref={graphRef} />
      </Content>
    </Layout>
  );
}

export default App;