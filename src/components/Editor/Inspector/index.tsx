import React, { useEffect } from 'react';
import { Form, Input, Card, Empty, Tag } from 'antd';
import { Cell } from '@antv/x6';

interface InspectorProps {
  cell: Cell | null; // 当前选中的节点
}

const Inspector: React.FC<InspectorProps> = ({ cell }) => {
  const [form] = Form.useForm();

  // 当选中的节点变化时，重置表单并填入数据
  useEffect(() => {
    if (cell && cell.isNode()) {
      const data = cell.getData() || {};
      const attrs = cell.getAttrs() || {};
      // 兼容两种 label 写法 (简单文本 或 对象)
      const labelText = typeof attrs.label === 'string' 
        ? attrs.label 
        : (attrs.label?.text || '');
      
      form.setFieldsValue({
        label: labelText,
        type: data.type || 'Unknown',
        spec: data.spec || '',
      });
    }
  }, [cell, form]);

  // 表单值变化时，回写到节点
  const handleValuesChange = (changedValues: any, allValues: any) => {
    if (!cell || !cell.isNode()) return;

    // 1. 更新业务数据 (Data)
    cell.setData({
      ...cell.getData(),
      spec: allValues.spec,
    });

    // 2. 更新视觉显示 (Label)
    if (changedValues.label !== undefined) {
      cell.setAttrs({
        label: { text: changedValues.label },
      });
    }
  };

  if (!cell || !cell.isNode()) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: '#999' }}>
        <Empty description="请点击选择一个设备" />
      </div>
    );
  }

  return (
    <Card title="属性详情" bordered={false} style={{ height: '100%', overflowY: 'auto' }}>
      <Form
        form={form}
        layout="vertical"
        onValuesChange={handleValuesChange}
      >
        <Form.Item label="设备类型" name="type">
          <Input disabled />
        </Form.Item>

        <Form.Item label="位号 (Tag ID)" name="label" tooltip="显示在图纸上的名称">
          <Input placeholder="例如: R-101" />
        </Form.Item>

        <Form.Item label="规格型号" name="spec">
          <Input placeholder="例如: 2000L" />
        </Form.Item>
        
        <div style={{ marginTop: 20 }}>
           <Tag color="blue">ID: {cell.id.slice(0, 8)}...</Tag>
        </div>
      </Form>
    </Card>
  );
};

export default Inspector;