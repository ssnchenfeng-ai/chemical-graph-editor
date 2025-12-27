// src/components/Editor/Inspector/index.tsx
import React, { useEffect, useState, useRef  } from 'react';
import { Form, Input, Card, Empty, Select, Divider, Collapse } from 'antd';
import { Cell } from '@antv/x6';
import { 
  InfoCircleOutlined, SettingOutlined, DashboardOutlined, ExperimentOutlined 
} from '@ant-design/icons';
import { FLUID_COLORS } from '../../../config/rules';
import { useDrawingStore } from '../../../store/drawingStore';

interface InspectorProps { cell: Cell | null; }

const { Option } = Select;
const { Panel } = Collapse;

const Inspector: React.FC<InspectorProps> = ({ cell }) => {
  const [form] = Form.useForm();
  const [, setTick] = useState(0);
  // [新增] 获取图纸列表和当前图纸ID
  const { drawings, currentDrawingId } = useDrawingStore();

  // 2. [新增] 定义一个锁，用于区分是“用户输入”还是“外部更新”
  const isUpdatingFromForm = useRef(false);

  // 1. 监听选中 cell 变化及数据变更
  useEffect(() => {
    if (!cell) return;

    const updateForm = () => {
      if (isUpdatingFromForm.current) return;
      const data = cell.getData() || {};
      const attrs = cell.getAttrs();
      
      const formData: any = {
        type: data.type || 'Unknown',
        tag: data.tag || attrs?.label?.text || '', 
        desc: data.desc || '',
      };

      if (cell.isNode()) {
        Object.assign(formData, {
          designPressure: data.designPressure,
          designTemp: data.designTemp,
          material: data.material,
          volume: data.volume,
          area: data.area,
          flow: data.flow,
          head: data.head,
          power: data.power,
          size: data.size,
          valveClass: data.valveClass,
          failPosition: data.failPosition,
          tagId: data.tagId,
          loopNum: data.loopNum,
          range: data.range,
          unit: data.unit,
          internals: data.internals, // 特定于分离器
          targetDrawingId: data.targetDrawingId,
          connectorLabel: data.connectorLabel
        });
      } else if (cell.isEdge()) {
        const labelObj = cell.getLabelAt(0);
        const labelText = typeof labelObj === 'string' ? labelObj : (labelObj?.attrs?.label?.text || '');
        Object.assign(formData, {
          tag: labelText,
          fluid: data.fluid || 'Water',
          material: data.material || 'CS',
          dn: data.dn || 'DN50',
          pn: data.pn || 'PN16',
          insulation: data.insulation || 'None',
        });
      }
      form.setFieldsValue(formData);
      setTick(t => t + 1);
    };

    updateForm();

    cell.on('change:data', updateForm);
    cell.on('change:attrs', updateForm);

    return () => {
      cell.off('change:data', updateForm);
      cell.off('change:attrs', updateForm);
    };
  }, [cell, form]);

  // 2. 表单变更处理
  const handleValuesChange = (changedValues: any, allValues: any) => {
    if (!cell) return;

    // 4. [新增] 上锁：标记当前操作源自表单
    isUpdatingFromForm.current = true;

    try {
      // --- 原有业务逻辑开始 ---
      const currentData = cell.getData() || {};
      cell.setData({ ...currentData, ...allValues });

      if (cell.isNode()) {
        if (currentData.type === 'Instrument') {
          if (changedValues.tagId !== undefined) cell.attr('topLabel/text', changedValues.tagId);
          if (changedValues.loopNum !== undefined) cell.attr('bottomLabel/text', changedValues.loopNum);
        } else {
          if (changedValues.tag !== undefined) {
            cell.setAttrs({ label: { text: changedValues.tag } });
          }
        }
      } else if (cell.isEdge()) {
        if (changedValues.tag !== undefined) {
          cell.setLabelAt(0, { attrs: { label: { text: changedValues.tag } }, position: { distance: 0.5,options: {
                keepGradient: true,
                ensureLegibility: true,
              } } });
        }
        if (changedValues.fluid !== undefined || changedValues.insulation !== undefined) {
          const fluid = allValues.fluid;
          const insulation = allValues.insulation;
          const color = FLUID_COLORS[fluid] || '#5F95FF';

          if (insulation && insulation.startsWith('Jacket')) {
            cell.setAttrs({ line: { strokeWidth: 4, stroke: '#fa8c16', strokeDasharray: null } });
          } else if (['ST', 'ET', 'OT'].includes(insulation)) {
            cell.setAttrs({ line: { strokeWidth: 2, stroke: color, strokeDasharray: '5 5' } });
          } else {
            cell.setAttrs({ line: { strokeWidth: 2, stroke: color, strokeDasharray: null } });
          }
        }
      }
      // --- 原有业务逻辑结束 ---
      
    } finally {
      // 5. [新增] 解锁：必须在 finally 中执行，确保无论逻辑是否报错都能解锁
      // 使用 setTimeout 将解锁推迟到当前事件循环结束，防止 X6 的同步事件立即触发更新
      setTimeout(() => {
        isUpdatingFromForm.current = false;
      }, 0);
    }
  };
  if (!cell) return <Empty description="请选择对象" style={{ marginTop: 100 }} />;

  const data = cell.getData() || {};
  const type = data.type;
  const isNode = cell.isNode();
  const isEdge = cell.isEdge();
  const isSignal = isEdge && type === 'Signal';

  const renderSpecificFields = () => {
    if (!isNode) return null;
    // [新增] 跨页连接符 (OffPageConnector) 配置
    if (type === 'OffPageConnector') {
      return (
        <>
          <Divider orientation={"left" as any}><SettingOutlined /> 跨页配置</Divider>
          
          <Form.Item label="目标图纸" name="targetDrawingId" help="双击图元可跳转">
            <Select placeholder="选择要连接的图纸" allowClear>
              {drawings
                .filter(d => d.id !== currentDrawingId) // 排除当前页
                .map(d => (
                  <Option key={d.id} value={d.id}>
                    {d.name}
                  </Option>
                ))}
            </Select>
          </Form.Item>

          <Form.Item label="配对编号 (Tag)" name="tag" help="两张图纸中此编号必须一致">
            <Input placeholder="例如: OPC-01" />
          </Form.Item>
          
          <div style={{ fontSize: '12px', color: '#999', marginTop: 8 }}>
            <InfoCircleOutlined /> 说明：<br/>
            1. 选择目标图纸建立逻辑连接。<br/>
            2. 确保两张图纸上的连接符 Tag 一致。<br/>
            3. 双击画布上的连接符可跳转。
          </div>
        </>
      );
    }
    // 1. 安全设施 (安全阀、爆破片、呼吸阀)
    if (['SafetyValve', 'RuptureDisc', 'BreatherValve'].includes(type)) {
      return (
        <>
          <Divider orientation={"left" as any}><SettingOutlined /> 设定参数</Divider>
          <div style={{ display: 'flex', gap: 8 }}>
            <Form.Item label="设定压力 (MPa)" name="setPressure" style={{ flex: 1 }}>
              <Input placeholder="1.0" />
            </Form.Item>
            <Form.Item label="泄放面积 (mm²)" name="area" style={{ flex: 1 }}>
              <Input placeholder="-" />
            </Form.Item>
          </div>
          <Form.Item label="进/出口尺寸" name="size">
             <Input placeholder="DN50 / DN80" />
          </Form.Item>
        </>
      );
    }

    // 2. 疏水阀 (Trap)
    if (type === 'Trap') {
      return (
        <>
          <Divider orientation={"left" as any}><SettingOutlined /> 疏水参数</Divider>
          <Form.Item label="类型" name="trapType">
            <Select>
              <Option value="Thermodynamic">热动力式 (圆盘)</Option>
              <Option value="BallFloat">浮球式</Option>
              <Option value="InvertedBucket">倒吊桶式</Option>
              <Option value="Bimetallic">双金属片</Option>
            </Select>
          </Form.Item>
          <div style={{ display: 'flex', gap: 8 }}>
            <Form.Item label="排量 (kg/h)" name="capacity" style={{ flex: 1 }}>
              <Input />
            </Form.Item>
            <Form.Item label="最大压差 (MPa)" name="maxDiffPress" style={{ flex: 1 }}>
              <Input />
            </Form.Item>
          </div>
        </>
      );
    }

    // 3. 过滤器 (Filter)
    if (type === 'Filter') {
      return (
        <>
          <Divider orientation={"left" as any}><SettingOutlined /> 过滤参数</Divider>
          <div style={{ display: 'flex', gap: 8 }}>
            <Form.Item label="滤网目数 (Mesh)" name="mesh" style={{ flex: 1 }}>
              <Input placeholder="40" />
            </Form.Item>
            <Form.Item label="形式" name="filterType" style={{ flex: 1 }}>
              <Select>
                <Option value="Y-Type">Y型</Option>
                <Option value="T-Type">T型</Option>
                <Option value="Basket">篮式</Option>
              </Select>
            </Form.Item>
          </div>
        </>
      );
    }
    
    if (['LiquidPump', 'CentrifugalPump', 'DiaphragmPump', 'PistonPump', 'GearPump', 'Compressor', 'Fan', 'JetPump'].includes(type)) {
      return (
        <>
          <Divider orientation={"left" as any}><DashboardOutlined /> 性能参数</Divider>
          <div style={{ display: 'flex', gap: 8 }}>
            <Form.Item label="流量 (m³/h)" name="flow" style={{ flex: 1 }}><Input placeholder="50" /></Form.Item>
            <Form.Item label="扬程 (m)" name="head" style={{ flex: 1 }}><Input placeholder="30" /></Form.Item>
          </div>
          <Form.Item label="电机功率 (kW)" name="power"><Input placeholder="15 kW" /></Form.Item>
          <Form.Item label="材质" name="material">
            <Select>
              <Option value="CS">铸钢 (CS)</Option>
              <Option value="SS304">不锈钢 (304)</Option>
              <Option value="SS316L">不锈钢 (316L)</Option>
              <Option value="CastIron">铸铁</Option>
            </Select>
          </Form.Item>
        </>
      );
    }
    if (['Reactor', 'Tank', 'Evaporator', 'Separator'].includes(type)) {
      return (
        <>
          <Divider orientation={"left" as any}><ExperimentOutlined /> 设备参数</Divider>
          {/* 针对分离器特有的属性 (可选) */}
          {type === 'Separator' && (
             <Form.Item label="内件类型" name="internals">
               <Select allowClear>
                 <Option value="Demister">丝网除沫器</Option>
                 <Option value="Vane">叶片式</Option>
                 <Option value="Cyclone">旋风式</Option>
                 <Option value="None">无 (重力沉降)</Option>
               </Select>
             </Form.Item>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <Form.Item label="容积 (m³)" name="volume" style={{ flex: 1 }}><Input placeholder="2000" /></Form.Item>
            <Form.Item label="材质" name="material" style={{ flex: 1 }}>
              <Select>
                <Option value="SS304">S30408</Option>
                <Option value="SS316L">S31603</Option>
                <Option value="CS">碳钢</Option>
                <Option value="Ti">钛材</Option>
              </Select>
            </Form.Item>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Form.Item label="设计压力(MPa)" name="designPressure" style={{ flex: 1 }}><Input placeholder="0.6" /></Form.Item>
            <Form.Item label="设计温度(℃)" name="designTemp" style={{ flex: 1 }}><Input placeholder="150" /></Form.Item>
          </div>
        </>
      );
    }
    if (['Exchanger'].includes(type)) {
      return (
        <>
          <Divider orientation={"left" as any}><ExperimentOutlined /> 换热参数</Divider>
          <Form.Item label="换热面积 (㎡)" name="area"><Input placeholder="10" /></Form.Item>
          <div style={{ display: 'flex', gap: 8 }}>
            <Form.Item label="壳程压力" name="designPressure" style={{ flex: 1 }}><Input placeholder="1.6" /></Form.Item>
            <Form.Item label="管程压力" name="tubePressure" style={{ flex: 1 }}><Input placeholder="1.0" /></Form.Item>
          </div>
          <Form.Item label="材质 (壳/管)" name="material"><Input placeholder="CS / SS304" /></Form.Item>
        </>
      );
    }
    if (['ControlValve', 'Valve'].includes(type)) {
      return (
        <>
          <Divider orientation={"left" as any}><SettingOutlined /> 阀门规格</Divider>
          <div style={{ display: 'flex', gap: 8 }}>
            <Form.Item label="尺寸" name="size" style={{ flex: 1 }}>
              <Select>
                <Option value="DN25">DN25</Option>
                <Option value="DN50">DN50</Option>
                <Option value="DN80">DN80</Option>
                <Option value="DN100">DN100</Option>
              </Select>
            </Form.Item>
            <Form.Item label="压力等级" name="valveClass" style={{ flex: 1 }}>
              <Select>
                <Option value="PN16">PN16</Option>
                <Option value="PN40">PN40</Option>
                <Option value="CL150">CL150</Option>
                <Option value="CL300">CL300</Option>
              </Select>
            </Form.Item>
          </div>
          {type === 'ControlValve' && (
            <Form.Item label="故障位置 (FC/FO)" name="failPosition">
              <Select>
                <Option value="FC">气开 (FC)</Option>
                <Option value="FO">气关 (FO)</Option>
                <Option value="FL">保位 (FL)</Option>
              </Select>
            </Form.Item>
          )}
        </>
      );
    }
    if (['Instrument'].includes(type)) {
      return (
        <>
          <Divider orientation={"left" as any}><DashboardOutlined /> 仪表定义</Divider>
          <div style={{ display: 'flex', gap: 8 }}>
            <Form.Item label="功能 (Tag)" name="tagId" style={{ flex: 1 }} help="如: PI, TT"><Input /></Form.Item>
            <Form.Item label="回路 (Loop)" name="loopNum" style={{ flex: 1 }} help="如: 101"><Input /></Form.Item>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Form.Item label="量程" name="range" style={{ flex: 2 }}><Input placeholder="0-1.6" /></Form.Item>
            <Form.Item label="单位" name="unit" style={{ flex: 1 }}><Input placeholder="MPa" /></Form.Item>
          </div>
        </>
      );
    }
    return <Empty description="无特定参数" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  };

  return (
    <Card 
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isNode ? <SettingOutlined /> : <InfoCircleOutlined />}
          <span>
            {isNode ? (data.type === 'Instrument' ? '仪表属性' : '设备属性') : (isSignal ? '信号线属性' : '管线属性')}
          </span>
        </div>
      } 
      bordered={false} 
      style={{ height: '100%', overflowY: 'auto' }}
      bodyStyle={{ padding: '12px 16px' }}
    >
      <Form form={form} layout="vertical" onValuesChange={handleValuesChange} size="small">
        <Collapse defaultActiveKey={['1']} ghost>
          <Panel header="基础信息" key="1">
            {type !== 'Instrument' && !isSignal && (
              <Form.Item label={isNode ? "位号 (Tag No.)" : "管段号 (Line No.)"} name="tag">
                <Input placeholder={isNode ? "R-101" : "PL-1001-50-CS"} />
              </Form.Item>
            )}
            <Form.Item label="描述" name="desc">
              <Input.TextArea rows={2} placeholder="设备或管线的功能描述" />
            </Form.Item>
          </Panel>
        </Collapse>

        {isNode && renderSpecificFields()}

        {isEdge && !isSignal && (
          <>
            <Divider orientation={"left" as any}>管道规格</Divider>
            <div style={{ display: 'flex', gap: 8 }}>
              <Form.Item label="介质" name="fluid" style={{ flex: 1 }}>
                <Select showSearch optionFilterProp="children">
                  {Object.keys(FLUID_COLORS).map(key => (
                    <Option key={key} value={key}>{key}</Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item label="材质" name="material" style={{ flex: 1 }}>
                <Select>
                  <Option value="CS">碳钢</Option>
                  <Option value="SS304">SS304</Option>
                  <Option value="SS316L">SS316L</Option>
                </Select>
              </Form.Item>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Form.Item label="管径" name="dn" style={{ flex: 1 }}>
                <Select showSearch>
                  {[
                    'DN15', 'DN20', 'DN25', 'DN32', 'DN40', 'DN50', 'DN65', 'DN80', 
                    'DN100', 'DN125', 'DN150', 'DN200', 'DN250', 'DN300', 'DN350', 
                    'DN400', 'DN450', 'DN500', 'DN600', 'DN700', 'DN800', 'DN900', 
                    'DN1000', 'DN1200', 'DN1400' // [新增] 大口径规格
                  ].map(d => <Option key={d} value={d}>{d}</Option>)}
                </Select>
              </Form.Item>
              <Form.Item label="等级" name="pn" style={{ flex: 1 }}>
                <Select showSearch>
                  <Option value="PN6">PN6</Option>
                  <Option value="PN10">PN10</Option>
                  <Option value="PN16">PN16</Option>
                  <Option value="PN25">PN25</Option>
                  <Option value="PN40">PN40</Option>
                  <Option value="PN63">PN63</Option>
                  <Option value="PN100">PN100</Option>
                  <Option value="CL150">CL150</Option>
                  <Option value="CL300">CL300</Option>
                  <Option value="CL600">CL600</Option>
                  <Option value="CL900">CL900</Option>
                  <Option value="CL1500">CL1500</Option>
                </Select>
              </Form.Item>
            </div>
            <Form.Item label="保温/伴热" name="insulation">
              <Select>
                <Option value="None">无</Option>
                <Option value="H">保温 (H)</Option>
                <Option value="C">保冷 (C)</Option>
                <Option value="ST">蒸汽伴热</Option>
                <Option value="ET">电伴热</Option>
                <Option value="Jacket-Steam">蒸汽夹套</Option>
              </Select>
            </Form.Item>
          </>
        )}

        {isSignal && (
           <div style={{ color: '#999', padding: '20px 0', textAlign: 'center' }}>
             <InfoCircleOutlined /> 信号连接 (Signal) <br/> 无需配置工艺参数
           </div>
        )}

        <div style={{ marginTop: 20, fontSize: 12, color: '#999', textAlign: 'center' }}>
          ID: {cell.id.slice(0, 8)}...
        </div>
      </Form>
    </Card>
  );
};

export default Inspector;