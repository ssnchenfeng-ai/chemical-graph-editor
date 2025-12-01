import { Graph } from '@antv/x6';
// 确保这里正确引入了三个 SVG
import { REACTOR_SVG, PUMP_SVG, VALVE_SVG } from './icons';

const PORT_ATTRS = {
  circle: {
    r: 4,
    magnet: true,
    stroke: '#31d0c6',
    strokeWidth: 2,
    fill: '#fff',
  },
};

export const registerCustomCells = () => {
  // 1. 注册反应釜
  Graph.registerNode('custom-reactor', {
    overwrite: true, // <--- 关键：允许覆盖同名节点
    inherit: 'image',
    width: 80,
    height: 120,
    imageUrl: `data:image/svg+xml;utf8,${encodeURIComponent(REACTOR_SVG)}`,
    ports: {
      groups: {
        top: { position: 'top', attrs: PORT_ATTRS },
        bottom: { position: 'bottom', attrs: PORT_ATTRS },
        left: { position: 'left', attrs: PORT_ATTRS },
        right: { position: 'right', attrs: PORT_ATTRS },
      },
      items: [
        { id: 'in_1', group: 'top', args: { x: '30%' } },
        { id: 'in_2', group: 'top', args: { x: '70%' } },
        { id: 'out_1', group: 'bottom' },
        { id: 'jacket_in', group: 'left', args: { y: '60%' } },
        { id: 'jacket_out', group: 'right', args: { y: '30%' } },
      ],
    },
    data: { type: 'Reactor', spec: 'CSTR-2000L' },
  });

  // 2. 注册离心泵
  Graph.registerNode('custom-pump', {
    overwrite: true, // <--- 关键
    inherit: 'image',
    width: 60,
    height: 60,
    imageUrl: `data:image/svg+xml;utf8,${encodeURIComponent(PUMP_SVG)}`,
    ports: {
      groups: {
        in: { position: 'left', attrs: PORT_ATTRS },
        out: { position: 'top', attrs: PORT_ATTRS },
      },
      items: [
        { id: 'in', group: 'in' },
        { id: 'out', group: 'out' },
      ],
    },
    data: { type: 'Pump', spec: 'P-101' },
  });

  // 3. 注册阀门
  Graph.registerNode('custom-valve', {
    overwrite: true, // <--- 关键
    inherit: 'image',
    width: 40,
    height: 40,
    imageUrl: `data:image/svg+xml;utf8,${encodeURIComponent(VALVE_SVG)}`,
    ports: {
      groups: {
        left: { position: 'left', attrs: PORT_ATTRS },
        right: { position: 'right', attrs: PORT_ATTRS },
      },
      items: [
        { id: 'in', group: 'left' },
        { id: 'out', group: 'right' },
      ],
    },
    data: { type: 'Valve', spec: 'DN50' },
  });
};