// src/App.tsx
import { useRef, useState } from 'react';
import { Button, Layout, message, Radio, Modal } from 'antd';
import {
  SaveOutlined,
  DatabaseOutlined,
  ToolOutlined,
  ArrowLeftOutlined,
  FormOutlined,
  DeploymentUnitOutlined,
} from '@ant-design/icons';

import GraphCanvas from './components/Editor/Canvas';
import type { GraphCanvasRef } from './components/Editor/Canvas';
import ShapeDesigner from './components/DevTools/ShapeDesigner';
import AttributeDesigner from './components/DevTools/AttributeDesigner';
import OntologyDesigner from './components/DevTools/OntologyDesigner';
import DrawingManager from './components/Editor/DrawingManager';
import { useDrawingStore } from './store/drawingStore';

const { Header, Content } = Layout;

function App() {
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<'editor' | 'designer' | 'attributes' | 'ontology'>('editor');
  const graphRef = useRef<GraphCanvasRef>(null);

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
      if (!currentDrawingId) message.warning('未选择图纸');
    }
  };

  const handleSwitchDrawing = (targetId: string) => {
    if (isDirty && currentDrawingId) {
      Modal.confirm({
        title: '未保存的更改',
        content: '当前图纸有未保存的修改，是否保存？',
        okText: '保存并切换',
        cancelText: '不保存',
        footer: (_, { OkBtn }) => (
          <>
            <Button onClick={() => Modal.destroyAll()}>取消</Button>
            <Button
              danger
              onClick={() => {
                Modal.destroyAll();
                setCurrentDrawing(targetId);
              }}
            >
              不保存
            </Button>
            <OkBtn />
          </>
        ),
        onOk: async () => {
          if (graphRef.current) {
            try {
              setSaving(true);
              await graphRef.current.handleSave(currentDrawingId);
              setCurrentDrawing(targetId);
            } catch (e) {
              console.error('Save failed during switch', e);
            } finally {
              setSaving(false);
            }
          }
        },
      });
    } else {
      setCurrentDrawing(targetId);
    }
  };

  if (mode === 'designer' || mode === 'attributes' || mode === 'ontology') {
    return (
      <Layout style={{ height: '100vh' }}>
        <Header
          style={{
            display: 'flex',
            alignItems: 'center',
            color: 'white',
            height: '50px',
            padding: '0 20px',
            flexShrink: 0,
            justifyContent: 'space-between',
            background: '#001529',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 10 }}>
              <ToolOutlined /> 开发者工具箱
            </div>

            <Radio.Group value={mode} onChange={(e) => setMode(e.target.value)} buttonStyle="solid" size="small">
              <Radio.Button value="designer">
                <ToolOutlined /> 图形 (Shape)
              </Radio.Button>
              <Radio.Button value="attributes">
                <FormOutlined /> 属性 (Attr)
              </Radio.Button>
              <Radio.Button value="ontology">
                <DeploymentUnitOutlined /> 本体 (Ontology)
              </Radio.Button>
            </Radio.Group>
          </div>

          <Button type="primary" ghost icon={<ArrowLeftOutlined />} onClick={() => setMode('editor')}>
            返回编辑器
          </Button>
        </Header>
        <Content style={{ height: 'calc(100vh - 50px)', overflow: 'hidden' }}>
          {mode === 'designer' && <ShapeDesigner />}
          {mode === 'attributes' && <AttributeDesigner />}
          {mode === 'ontology' && <OntologyDesigner />}
        </Content>
      </Layout>
    );
  }

  return (
    <Layout style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          color: 'white',
          height: '50px',
          padding: '0 20px',
          flexShrink: 0,
          justifyContent: 'space-between',
        }}
      >
        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 10 }}>
          <DatabaseOutlined />
          <span>
            🧪 化工 P&ID 编辑器
            <span style={{ fontSize: '0.8em', fontWeight: 'normal', marginLeft: 10, opacity: 0.8 }}>
              {' '}
              - {currentDrawingName || 'Loading...'}
              {isDirty && <span style={{ color: '#ffec3d', marginLeft: 5 }}>*</span>}
            </span>
          </span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button type="dashed" ghost icon={<ToolOutlined />} onClick={() => setMode('designer')}>
            DevTools
          </Button>
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSaveClick}>
            保存图纸到 Neo4j
          </Button>
        </div>
      </Header>

      <Content style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <GraphCanvas ref={graphRef} drawingId={currentDrawingId} />
        </div>
        <div style={{ flexShrink: 0, zIndex: 100 }}>
          <DrawingManager onSwitch={handleSwitchDrawing} />
        </div>
      </Content>
    </Layout>
  );
}

export default App;
