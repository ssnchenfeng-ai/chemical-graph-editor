import { Graph } from '@antv/x6';
// 恢复正常的引用
import { REACTOR_SVG, PUMP_SVG, VALVE_SVG, TEE_SVG } from './icons';

const PORT_ATTRS = {
  circle: { r: 4, magnet: true, stroke: '#31d0c6', strokeWidth: 2, fill: '#fff' },
};

export const registerCustomCells = () => {
  // 1. 反应釜
  Graph.registerNode('custom-reactor', {
    overwrite: true,
    inherit: 'image',
    width: 80, height: 120,
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

  // 2. 泵
  Graph.registerNode('custom-pump', {
    overwrite: true,
    inherit: 'image',
    width: 60, height: 60,
    imageUrl: `data:image/svg+xml;utf8,${encodeURIComponent(PUMP_SVG)}`,
    ports: {
      groups: { in: { position: 'left', attrs: PORT_ATTRS }, out: { position: 'top', attrs: PORT_ATTRS } },
      items: [ { id: 'in', group: 'in' }, { id: 'out', group: 'out' } ],
    },
    data: { type: 'Pump', spec: 'P-101' },
  });

  // 3. 阀门
  Graph.registerNode('custom-valve', {
    overwrite: true,
    inherit: 'image',
    width: 40, height: 40,
    imageUrl: `data:image/svg+xml;utf8,${encodeURIComponent(VALVE_SVG)}`,
    ports: {
      groups: { left: { position: 'left', attrs: PORT_ATTRS }, right: { position: 'right', attrs: PORT_ATTRS } },
      items: [ { id: 'in', group: 'left' }, { id: 'out', group: 'right' } ],
    },
    data: { type: 'Valve', spec: 'DN50' },
  });

  // 4. 三通
  Graph.registerNode('custom-tee', {
    overwrite: true,
    inherit: 'image',
    width: 30, height: 30,
    imageUrl: `data:image/svg+xml;utf8,${encodeURIComponent(TEE_SVG)}`,
    ports: {
      groups: {
        left: { position: 'left', attrs: PORT_ATTRS },
        right: { position: 'right', attrs: PORT_ATTRS },
        bottom: { position: 'bottom', attrs: PORT_ATTRS },
      },
      items: [
        { id: 'p1', group: 'left' },
        { id: 'p2', group: 'right' },
        { id: 'p3', group: 'bottom' },
      ],
    },
    data: { type: 'Fitting', spec: 'Tee' },
  });
};