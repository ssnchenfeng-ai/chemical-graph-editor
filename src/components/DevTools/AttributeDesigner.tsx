import React, { useState, useEffect } from 'react';
import { Layout, Form, Input, Select, InputNumber, Typography, Button, Card, Row, Col, Tabs, message, Divider } from 'antd';
import { CopyOutlined, CodeOutlined, SettingOutlined, ExperimentOutlined, ThunderboltOutlined, FilterOutlined } from '@ant-design/icons';

const { Content, Sider } = Layout;
const { Title, Paragraph } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;
const { TextArea } = Input; // 确保这一行存在

// ============================================================================
// 1. 属性模式定义 (Schema Definition)
//    定义不同设备类型拥有的特有属性字段
// ============================================================================

const COMMON_FIELDS = [
  { name: 'tag', label: '位号 (Tag)', type: 'string', default: 'New-Tag' },
  { name: 'desc', label: '描述 (Description)', type: 'string', default: '' },
  { name: 'spec', label: '规格型号 (Spec)', type: 'string', default: '' },
];

const EQUIPMENT_SCHEMAS: Record<string, any> = {
  'Pump': {
    label: '泵类设备 (Pump)',
    icon: <ThunderboltOutlined />,
    fields: [
      { name: 'flow', label: '流量 (Flow)', unit: 'm³/h', type: 'number', default: 50 },
      { name: 'head', label: '扬程 (Head)', unit: 'm', type: 'number', default: 30 },
      { name: 'power', label: '电机功率 (Power)', unit: 'kW', type: 'string', default: '15kW' },
      { name: 'material', label: '泵体材质', type: 'select', options: ['CastIron', 'CS', 'SS304', 'SS316L', 'Duplex'] },
      { name: 'sealType', label: '密封形式', type: 'select', options: ['Mechanical', 'Packing', 'Magnetic'] },
    ]
  },
  'Trap': {
    label: '疏水阀 (Steam Trap)',
    icon: <FilterOutlined />,
    fields: [
      { name: 'trapType', label: '疏水阀类型', type: 'select', options: [
        { val: 'Thermodynamic', label: '热动力式 (圆盘)' },
        { val: 'BallFloat', label: '浮球式' },
        { val: 'InvertedBucket', label: '倒吊桶式' },
        { val: 'Thermostatic', label: '热静力式 (波纹管)' },
        { val: 'Bimetallic', label: '双金属片式' }
      ]},
      { name: 'size', label: '接口尺寸', type: 'select', options: ['DN15', 'DN20', 'DN25', 'DN32', 'DN40', 'DN50'] },
      { name: 'maxPressure', label: '最大允许压力 (PMA)', unit: 'MPa', type: 'number', default: 1.6 },
      { name: 'dischargeCapacity', label: '排水量', unit: 'kg/h', type: 'number', default: 500 },
      { name: 'connection', label: '连接方式', type: 'select', options: ['Flange', 'Thread', 'SocketWeld'] },
    ]
  },
  'Vessel': {
    label: '容器/储罐 (Vessel)',
    icon: <ExperimentOutlined />,
    fields: [
      { name: 'volume', label: '容积 (Volume)', unit: 'm³', type: 'number', default: 10 },
      { name: 'designPressure', label: '设计压力', unit: 'MPa', type: 'number', default: 0.6 },
      { name: 'designTemp', label: '设计温度', unit: '℃', type: 'number', default: 150 },
      { name: 'material', label: '主体材质', type: 'select', options: ['Q235B', 'Q345R', 'S30408', 'S31603', 'Ti'] },
      { name: 'insulation', label: '保温类型', type: 'select', options: ['None', 'RockWool', 'Perlite', 'PU'] },
    ]
  },
  'Exchanger': {
    label: '换热器 (Exchanger)',
    icon: <ExperimentOutlined />,
    fields: [
      { name: 'area', label: '换热面积', unit: '㎡', type: 'number', default: 50 },
      { name: 'type', label: '结构类型', type: 'select', options: ['FixedTubeSheet', 'U-Tube', 'FloatingHead', 'Plate'] },
      { name: 'shellPress', label: '壳程压力', unit: 'MPa', type: 'number', default: 1.6 },
      { name: 'tubePress', label: '管程压力', unit: 'MPa', type: 'number', default: 1.0 },
      { name: 'material', label: '材质(壳/管)', type: 'string', default: 'CS/SS304' },
    ]
  },
  'ControlValve': {
    label: '控制阀 (Control Valve)',
    icon: <SettingOutlined />,
    fields: [
      { name: 'size', label: '阀门尺寸', type: 'select', options: ['DN25', 'DN40', 'DN50', 'DN80', 'DN100', 'DN150'] },
      { name: 'cv', label: '流量系数 (Cv/Kv)', type: 'number', default: 60 },
      { name: 'failPos', label: '故障位置', type: 'select', options: [
        { val: 'FC', label: '气开 (FC/Fail Close)' },
        { val: 'FO', label: '气关 (FO/Fail Open)' },
        { val: 'FL', label: '保位 (FL/Fail Last)' }
      ]},
      { name: 'class', label: '压力等级', type: 'select', options: ['PN16', 'PN40', 'PN63', 'CL150', 'CL300', 'CL600'] },
      { name: 'actuator', label: '执行机构', type: 'select', options: ['Diaphragm', 'Piston', 'Electric'] },
    ]
  },
  'ManualValve': {
    label: '手动阀 (Manual Valve)',
    icon: <SettingOutlined />,
    fields: [
      { name: 'valveType', label: '阀门类型', type: 'select', options: ['Gate', 'Globe', 'Ball', 'Butterfly', 'Check'] },
      { name: 'size', label: '尺寸', type: 'select', options: ['DN15', 'DN25', 'DN50', 'DN80', 'DN100'] },
      { name: 'class', label: '压力等级', type: 'select', options: ['PN16', 'PN25', 'PN40', 'CL150'] },
      { name: 'material', label: '阀体材质', type: 'select', options: ['WCB', 'CF8', 'CF8M', 'CastIron'] },
    ]
  }
};

const AttributeDesigner: React.FC = () => {
  const [selectedType, setSelectedType] = useState('Pump');
  const [form] = Form.useForm();
  const [formData, setFormData] = useState<any>({});

  // 初始化表单默认值
  useEffect(() => {
    const schema = EQUIPMENT_SCHEMAS[selectedType];
    const initialValues: any = { type: selectedType };
    
    COMMON_FIELDS.forEach(f => initialValues[f.name] = f.default);
    schema.fields.forEach((f: any) => initialValues[f.name] = f.default);
    
    form.setFieldsValue(initialValues);
    setFormData(initialValues);
  }, [selectedType, form]);

  const handleValuesChange = (_: any, allValues: any) => {
    setFormData(allValues);
  };

  // 生成注册用的 data 对象代码
  const generateDataCode = () => {
    const jsonString = JSON.stringify(formData, null, 2);
    // 去掉 key 的引号，使其更像 JS 代码
    const jsObj = jsonString.replace(/"([^"]+)":/g, '$1:');
    
    return `// 在 src/graph/cells/registry.ts 中注册节点时使用：
Graph.registerNode('custom-${selectedType.toLowerCase()}', {
  // ... 其他配置 (inherit, width, height, ports 等)
  data: ${jsObj},
});`;
  };

  // 生成 Inspector 组件的渲染代码
  const generateInspectorCode = () => {
    const schema = EQUIPMENT_SCHEMAS[selectedType];
    
    const fieldRenders = schema.fields.map((f: any) => {
      let inputComponent = `<Input />`;
      if (f.type === 'number') inputComponent = `<InputNumber style={{ width: '100%' }} />`;
      if (f.type === 'select') {
        const options = f.options.map((opt: any) => {
          const val = typeof opt === 'string' ? opt : opt.val;
          const label = typeof opt === 'string' ? opt : opt.label;
          return `<Option value="${val}">${label}</Option>`;
        }).join('\n              ');
        inputComponent = `<Select>\n              ${options}\n            </Select>`;
      }

      return `          <Form.Item label="${f.label}" name="${f.name}">
            ${inputComponent}
          </Form.Item>`;
    }).join('\n');

    return `// 在 src/components/Editor/Inspector/index.tsx 中：
// 1. 在 renderSpecificFields 函数中添加 case：

if (type === '${selectedType}') {
  return (
    <>
      <Divider orientation="left">${schema.label}</Divider>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
${fieldRenders}
      </div>
    </>
  );
}`;
  };

  return (
    <Layout style={{ height: '100vh', background: '#fff' }}>
      {/* 左侧：类型选择 */}
      <Sider width={250} style={{ background: '#f0f2f5', borderRight: '1px solid #eee', overflowY: 'auto' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid #e8e8e8' }}>
          <Title level={5}>设备类型库</Title>
        </div>
        <div style={{ padding: 8 }}>
          {Object.keys(EQUIPMENT_SCHEMAS).map(key => (
            <Button 
              key={key}
              type={selectedType === key ? 'primary' : 'text'}
              block
              style={{ textAlign: 'left', marginBottom: 4, height: 'auto', padding: '8px 12px' }}
              icon={EQUIPMENT_SCHEMAS[key].icon}
              onClick={() => setSelectedType(key)}
            >
              {EQUIPMENT_SCHEMAS[key].label}
            </Button>
          ))}
        </div>
      </Sider>

      {/* 中间：属性配置表单 */}
      <Content style={{ padding: '24px', overflowY: 'auto', background: '#fff' }}>
        <Title level={4}>属性配置预览</Title>
        <Paragraph type="secondary">
          在此处配置 {EQUIPMENT_SCHEMAS[selectedType].label} 的默认属性值和字段结构。
        </Paragraph>
        
        <Card title="基础属性 (Common)" size="small" style={{ marginBottom: 16 }}>
          <Form layout="vertical" form={form} onValuesChange={handleValuesChange}>
            <Row gutter={16}>
              {COMMON_FIELDS.map(f => (
                <Col span={8} key={f.name}>
                  <Form.Item label={f.label} name={f.name}>
                    <Input />
                  </Form.Item>
                </Col>
              ))}
            </Row>
          </Form>
        </Card>

        <Card title="业务属性 (Specific)" size="small" headStyle={{ background: '#fafafa' }}>
          <Form layout="vertical" form={form} onValuesChange={handleValuesChange}>
            <Row gutter={16}>
              {EQUIPMENT_SCHEMAS[selectedType].fields.map((f: any) => (
                <Col span={12} key={f.name}>
                  <Form.Item label={f.label} name={f.name}>
                    {f.type === 'select' ? (
                      <Select>
                        {f.options.map((opt: any) => {
                          const val = typeof opt === 'string' ? opt : opt.val;
                          const label = typeof opt === 'string' ? opt : opt.label;
                          return <Option key={val} value={val}>{label}</Option>;
                        })}
                      </Select>
                    ) : f.type === 'number' ? (
                      <InputNumber style={{ width: '100%' }} addonAfter={f.unit} />
                    ) : (
                      <Input />
                    )}
                  </Form.Item>
                </Col>
              ))}
            </Row>
          </Form>
        </Card>
      </Content>

      {/* 右侧：代码生成 */}
      <Sider width={450} style={{ background: '#fff', borderLeft: '1px solid #eee', padding: '0' }}>
        <Tabs defaultActiveKey="1" tabBarStyle={{ paddingLeft: 16 }}>
          <TabPane tab={<span><CodeOutlined /> 注册数据 (Data)</span>} key="1">
            <div style={{ padding: 16, height: 'calc(100vh - 60px)', overflowY: 'auto' }}>
              <Paragraph type="secondary" style={{ fontSize: 12 }}>
                此代码用于 `src/graph/cells/registry.ts` 中的 `data` 字段。
              </Paragraph>
              <TextArea 
                value={generateDataCode()} 
                autoSize={{ minRows: 15 }} 
                style={{ fontFamily: 'monospace', fontSize: 12, background: '#f5f5f5', color: '#333' }} 
                readOnly
              />
              <Button type="primary" icon={<CopyOutlined />} block style={{ marginTop: 16 }} onClick={() => {
                navigator.clipboard.writeText(generateDataCode());
                message.success('Data 代码已复制');
              }}>
                复制 Data 代码
              </Button>
            </div>
          </TabPane>
          
          <TabPane tab={<span><SettingOutlined /> 属性面板 (Inspector)</span>} key="2">
            <div style={{ padding: 16, height: 'calc(100vh - 60px)', overflowY: 'auto' }}>
              <Paragraph type="secondary" style={{ fontSize: 12 }}>
                此代码用于 `src/components/Editor/Inspector/index.tsx`，用于在右侧面板渲染这些属性。
              </Paragraph>
              <TextArea 
                value={generateInspectorCode()} 
                autoSize={{ minRows: 20 }} 
                style={{ fontFamily: 'monospace', fontSize: 12, background: '#f5f5f5', color: '#333' }} 
                readOnly
              />
              <Button type="primary" icon={<CopyOutlined />} block style={{ marginTop: 16 }} onClick={() => {
                navigator.clipboard.writeText(generateInspectorCode());
                message.success('Inspector 代码已复制');
              }}>
                复制 Inspector 代码
              </Button>
            </div>
          </TabPane>
        </Tabs>
      </Sider>
    </Layout>
  );
};

export default AttributeDesigner;