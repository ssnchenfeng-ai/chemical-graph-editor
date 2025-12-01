import React, { useEffect } from 'react';
import { Form, Input, Card, Empty, Tag, Select, Button, Modal } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { Cell } from '@antv/x6';

interface InspectorProps {
  cell: Cell | null;
}

const Inspector: React.FC<InspectorProps> = ({ cell }) => {
  const [form] = Form.useForm();

  // 监听选中 cell 变化，回显数据
  useEffect(() => {
    if (!cell) return;

    const data = cell.getData() || {};
    
    if (cell.isNode()) {
      // --- 设备节点回显 ---
      form.setFieldsValue({
        entity: 'node',
        label: cell.getAttrs()?.label?.text || '',
        type: data.type || 'Unknown',
        spec: data.spec || ''
      });
    } else if (cell.isEdge()) {
      // --- 管线连线回显 ---
      // 获取连线上的标签文字
      const labelObj = cell.getLabelAt(0);
      const labelText = typeof labelObj === 'string' ? labelObj : (labelObj?.attrs?.label?.text || '');
      
      form.setFieldsValue({
        entity: 'edge',
        label: labelText,
        material: data.material || 'CS',
        fluid: data.fluid || 'Water'
      });
    }
  }, [cell, form]);

  // 表单修改处理
  const handleValuesChange = (changedValues: any, allValues: any) => {
    if (!cell) return;

    if (cell.isNode()) {
      // 更新节点
      cell.setData({ ...cell.getData(), spec: allValues.spec });
      if (changedValues.label !== undefined) {
        cell.setAttrs({ label: { text: changedValues.label } });
      }
    } else if (cell.isEdge()) {
      // 更新管线
      cell.setData({ 
        ...cell.getData(), 
        material: allValues.material, 
        fluid: allValues.fluid 
      });

      // 更新管线文字标签
      if (changedValues.label !== undefined) {
        if (!changedValues.label) {
          cell.removeLabelAt(0);
        } else {
          cell.setLabelAt(0, {
            attrs: {
              label: { text: changedValues.label },
              body: { fill: '#fff', stroke: '#333', strokeWidth: 1, rx: 4, ry: 4 },
            },
            position: { distance: 0.5 },
          });
        }
      }
      
      // 更新管线颜色
      if (changedValues.fluid === 'Steam') cell.setAttrs({ line: { stroke: '#ff4d4f' } });
      else if (changedValues.fluid === 'Water') cell.setAttrs({ line: { stroke: '#5F95FF' } });
    }
  };

  // 删除按钮逻辑
  const handleDelete = () => {
    if (cell) {
      Modal.confirm({
        title: '确认删除',
        content: '确定要删除选中的对象吗？',
        okType: 'danger',
        onOk: () => {
          cell.remove();
          // 注意：这里删除后，App 层的 selectedCell 还没置空，
          // 但 X6 的 selection:changed 事件通常会处理它。
          // 更好的做法是通过 props 回调通知父组件，但这里直接操作 cell 也可以。
        }
      });
    }
  };

  if (!cell) return <Empty description="请点击选择对象" style={{ marginTop: 50 }} />;

  const isNode = cell.isNode();
  const title = isNode ? "设备属性" : "管线属性";

  return (
    <Card 
      title={title} 
      bordered={false} 
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
      bodyStyle={{ flex: 1, overflowY: 'auto' }} // 让表单区域可滚动
    >
      <Form form={form} layout="vertical" onValuesChange={handleValuesChange}>
        <Form.Item name="entity" hidden><Input /></Form.Item>

        {/* 动态渲染表单项 */}
        <Form.Item noStyle shouldUpdate={(prev, curr) => prev.entity !== curr.entity}>
          {({ getFieldValue }) => 
            getFieldValue('entity') === 'node' ? (
              <>
                <Form.Item label="设备类型" name="type"><Input disabled /></Form.Item>
                <Form.Item label="位号 (Tag ID)" name="label"><Input /></Form.Item>
                <Form.Item label="规格型号" name="spec"><Input /></Form.Item>
              </>
            ) : (
              <>
                <Form.Item label="管线号" name="label"><Input placeholder="如: PL-101" /></Form.Item>
                <Form.Item label="材质" name="material">
                  <Select>
                    <Select.Option value="CS">碳钢 (CS)</Select.Option>
                    <Select.Option value="SS304">不锈钢 (304)</Select.Option>
                    <Select.Option value="PVC">塑料 (PVC)</Select.Option>
                  </Select>
                </Form.Item>
                <Form.Item label="介质" name="fluid">
                  <Select>
                    <Select.Option value="Water">工艺水 (Water)</Select.Option>
                    <Select.Option value="Steam">蒸汽 (Steam)</Select.Option>
                    <Select.Option value="Oil">导热油 (Oil)</Select.Option>
                  </Select>
                </Form.Item>
              </>
            )
          }
        </Form.Item>

        <div style={{ marginTop: 20 }}>
          <Tag color={isNode ? "blue" : "orange"}>ID: {cell.id.slice(0, 8)}</Tag>
        </div>
      </Form>

      {/* 底部删除按钮 */}
      <div style={{ marginTop: 'auto', paddingTop: 20, borderTop: '1px solid #eee' }}>
        <Button danger block icon={<DeleteOutlined />} onClick={handleDelete}>
          删除{isNode ? '设备' : '管线'}
        </Button>
      </div>
    </Card>
  );
};

export default Inspector;