import { Layout } from 'antd';
import { ApartmentOutlined } from '@ant-design/icons';

import PidX6Workspace from './components/PidX6Workspace';

const { Header, Content } = Layout;

function App() {
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
          background: '#10251f',
        }}
      >
        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 10 }}>
          <ApartmentOutlined /> 分层 P&ID 语义工作台
        </div>
      </Header>
      <Content style={{ height: 'calc(100vh - 50px)', overflow: 'hidden' }}>
        <PidX6Workspace />
      </Content>
    </Layout>
  );
}

export default App;
