import { useRef, useState } from 'react';
import { Button, Layout, message } from 'antd';
// 1. 确保图标库已安装。如果此处报错，请运行 npm install @ant-design/icons
import { 
  SaveOutlined, 
  DatabaseOutlined, 
  ToolOutlined, 
  ArrowLeftOutlined 
} from '@ant-design/icons';

// 2. 分开导入组件和类型（这是修复白屏的关键）
import GraphCanvas from './components/Editor/Canvas';
import type { GraphCanvasRef } from './components/Editor/Canvas';
import ShapeDesigner from './components/DevTools/ShapeDesigner';

const { Header, Content } = Layout;

function App() {
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<'editor' | 'designer'>('editor');
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
  // --- 渲染设计器模式 ---
  if (mode === 'designer') {
    return (
      <Layout style={{ height: '100vh' }}>
        <Header style={{ 
          display: 'flex', alignItems: 'center', color: 'white', 
          height: '50px', padding: '0 20px', flexShrink: 0,
          justifyContent: 'space-between', background: '#001529'
        }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 10 }}>
            <ToolOutlined /> 📐 图元设计器 (DevMode)
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
          <ShapeDesigner />
        </Content>
      </Layout>
    );
  }

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
        <Button 
            type="dashed" 
            ghost 
            icon={<ToolOutlined />} 
            onClick={() => setMode('designer')}
          >
            设计图元
          </Button>
        <Button 
          type="primary" 
          icon={<SaveOutlined />} 
          loading={saving}
          onClick={handleSaveClick}
        >
          保存图纸到 Neo4j
        </Button>
      </Header>
      
      <Content style={{ position: 'relative', flex: 1, overflow: 'hidden', display: 'flex' }}>
        {/* 确保这里没有多余的 props 导致类型冲突 */}
        <GraphCanvas ref={graphRef} />
      </Content>
    </Layout>
  );
}

export default App;