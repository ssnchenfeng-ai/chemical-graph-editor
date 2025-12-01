import { useState } from 'react';
import { Button, message, Layout } from 'antd';
import GraphCanvas from './components/Editor/Canvas'; 
import { runCypher } from './services/neo4j';

const { Header, Content } = Layout;

function App() {
  const [status, setStatus] = useState<string>('未连接');

  const testConnection = async () => {
    try {
      const res = await runCypher('CALL dbms.components() YIELD name, versions, edition');
      setStatus(`连接成功`);
      message.success('Neo4j 连接成功！');
    } catch (err) {
      console.error(err);
      setStatus('连接失败');
      message.error('连接失败，请确保 Neo4j 已启动且密码正确');
    }
  };

  return (
    <Layout style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header style={{ 
        display: 'flex', alignItems: 'center', color: 'white', 
        height: '50px', padding: '0 20px', flexShrink: 0 
      }}>
        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', marginRight: 20 }}>
          🧪 化工 P&ID 编辑器
        </div>
        <Button ghost size="small" onClick={testConnection}>DB测试</Button>
        <span style={{ marginLeft: 15, fontSize: '0.8rem', color: '#aaa' }}>{status}</span>
      </Header>
      
      {/* 
         Content 使用 flex: 1 占满剩余高度
         display: flex 确保内部子元素 (GraphCanvas) 能撑满宽度
      */}
      <Content style={{ position: 'relative', flex: 1, overflow: 'hidden', display: 'flex' }}>
        <GraphCanvas />
      </Content>
    </Layout>
  );
}

export default App;