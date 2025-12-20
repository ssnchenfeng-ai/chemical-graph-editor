import { Graph } from '@antv/x6';

// --- SVG Imports (保留用于手动注册的 SVG) ---
import frameA2Svg from './svgs/frame-a2.svg?raw';

import cvPneumaticSvg from './svgs/cv-pneumatic.svg?raw';
import cvPositionerSvg from './svgs/cv-positioner.svg?raw';
import cvElectricSvg from './svgs/cv-electric.svg?raw';
import cvSolenoidSvg from './svgs/cv-solenoid.svg?raw';
import cvManualSvg from './svgs/cv-manual.svg?raw';
import cvPistonSvg from './svgs/cv-piston.svg?raw';

import instLocalSvg from './svgs/inst-local.svg?raw';
import instRemoteSvg from './svgs/inst-remote.svg?raw';
import instPanelSvg from './svgs/inst-panel.svg?raw';

// ============================================================
// [关键修改 1] 将 glob 移到顶层，确保 HMR 时能扫描所有文件
// ============================================================
const SVG_MODULES = import.meta.glob('./svgs/*.svg', { eager: true, query: '?raw', import: 'default' });
const JSON_MODULES = import.meta.glob('./data/*.json', { eager: true, import: 'default' });

// --- 全局变量与类型定义 ---

export const SHAPE_LIBRARY: Record<string, any> = {};

export type PortDir = 'in' | 'out' | 'bi';
export interface PortData {
  dir?: PortDir;
  [key: string]: any;
}

// JSON 配置文件结构接口
interface ShapeConfig {
  width: number;
  height: number;
  ports: any;
  attrs?: any;
  data: any;
}

// --- 工具函数 ---

// 确保使用 utf-8 编码
const svgToDataUrl = (svgStr: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgStr)}`;

// 内部注册函数：同时写入 X6 引擎和 SHAPE_LIBRARY 缓存
const registerNodeWithCache = (id: string, config: any) => {
  // 1. 注册到 X6
  Graph.registerNode(id, config);

  // 2. 存入缓存供设计器读取
  let rawSvg = '';
  // 尝试还原 SVG 源码供设计器回显
  if (config.imageUrl && typeof config.imageUrl === 'string') {
    try {
      const base64Data = config.imageUrl.split(',')[1];
      if (base64Data) {
        rawSvg = decodeURIComponent(base64Data);
      }
    } catch (e) {
      console.warn('Failed to decode SVG for designer:', id);
    }
  }

  SHAPE_LIBRARY[id] = {
    ...config,
    rawSvg, 
  };
};

// --- 通用样式常量 ---

const PORT_ATTRS = {
  circle: { r: 3, magnet: true, stroke: '#FFFFFF', strokeWidth: 1, fill: '#e3dedeff' },
};

const LABEL_ATTRS = {
  label: { refY: '100%', refY2: 8, textAnchor: 'middle', textVerticalAnchor: 'top', fontSize: 12, fill: '#333' }
};

// ============================================================
// 1. 自动化注册逻辑 (Auto Loader)
// ============================================================

const autoRegisterShapes = () => {
  // [关键修改 2] 使用顶层定义的 JSON_MODULES
  console.log(`[Registry] Found ${Object.keys(JSON_MODULES).length} custom shapes in /data folder.`);

  // 1.3 遍历 JSON 配置进行注册
  for (const path in JSON_MODULES) {
    try {
      const config = JSON_MODULES[path] as ShapeConfig;
      
      // 从文件名推导 ID: ./data/p-reactor.json -> p-reactor
      const fileName = path.split('/').pop()?.replace('.json', '');
      const shapeId = fileName || 'unknown';

      // 查找对应的 SVG
      const svgPath = `./svgs/${shapeId}.svg`;
      
      // [关键修改 3] 使用顶层定义的 SVG_MODULES
      const svgContent = SVG_MODULES[svgPath] as string;

      if (!svgContent) {
        console.warn(`[Registry] Missing SVG for ${shapeId} (expected at ${svgPath})`);
        continue;
      }

      // 注册
      registerNodeWithCache(shapeId, {
        inherit: 'image',
        width: config.width,
        height: config.height,
        imageUrl: svgToDataUrl(svgContent),
        ports: config.ports,
        attrs: config.attrs || LABEL_ATTRS,
        data: config.data
      });
      
    } catch (e) {
      console.error(`[Registry] Failed to register shape from ${path}`, e);
    }
  }
};

// ============================================================
// 2. 手动端口定义 (保留给尚未迁移的复杂图元)
// ============================================================

const VALVE_PORTS = {
  groups: { left: { position: 'absolute', attrs: PORT_ATTRS }, right: { position: 'absolute', attrs: PORT_ATTRS }, actuator: { position: 'absolute', attrs: PORT_ATTRS } },
  items: [
    { id: 'in', group: 'left', args: { x: '0%', y: '83.33%' }, data: { desc: '阀门入口', dir: 'bi' } as PortData },
    { id: 'out', group: 'right', args: { x: '100%', y: '83.33%' }, data: { desc: '阀门出口', dir: 'bi' } as PortData },
    { id: 'actuator', group: 'actuator', args: { x: '50%', y: '0%' }, attrs: { circle: { r: 4, magnet: true, stroke: '#fa8c16', strokeWidth: 1, fill: '#fff' } }, data: { desc: '执行机构', dir: 'in', type: 'signal' } as PortData },
  ],
};

const INSTRUMENT_PORTS = {
  groups: { all: { position: 'absolute', attrs: PORT_ATTRS } },
  items: [
    { id: 'top', group: 'all', args: { x: '50%', y: '0%' } },
    { id: 'bottom', group: 'all', args: { x: '50%', y: '100%' } },
    { id: 'left', group: 'all', args: { x: '0%', y: '50%' } },
    { id: 'right', group: 'all', args: { x: '100%', y: '50%' } },
  ],
};

// ============================================================
// 3. 主注册函数
// ============================================================

export const registerCustomCells = () => {
  // 1. 优先执行自动化注册 (加载 data/*.json)
  autoRegisterShapes();

  // 2. 注册基础元素
  Graph.registerEdge('signal-edge', {
    inherit: 'edge',
    attrs: { line: { stroke: '#888', strokeWidth: 1, strokeDasharray: '4 4', targetMarker: { name: 'classic', size: 3 } } },
    data: { type: 'Signal', fluid: 'Signal' },
  });

  registerNodeWithCache('tapping-point', {
    width: 12, height: 12,
    markup: [{ tagName: 'circle', selector: 'hitArea' }, { tagName: 'circle', selector: 'body' }],
    attrs: {
      hitArea: { r: 10, fill: 'transparent', stroke: 'none', magnet: false, cursor: 'move', pointerEvents: 'all' },
      body: { r: 3, fill: '#333', stroke: 'none', pointerEvents: 'none' },
    },
    ports: { items: [] },
    data: { type: 'TappingPoint', desc: '测量点' },
  });

  registerNodeWithCache('drawing-frame-a2', {
    inherit: 'image', width: 2245, height: 1587,
    imageUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(frameA2Svg)}`,
    ports: { items: [] }, attrs: { image: { style: { pointerEvents: 'none' } } },
    data: { type: 'Frame', isBackground: true }
  });

  // 3. 手动注册复杂图元 (尚未迁移到 JSON 的部分)
  
  const controlValves = [
    { key: 'p-cv-pneumatic', name: '气动调节阀', svg: cvPneumaticSvg, type: 'ControlValve' },
    { key: 'p-cv-positioner', name: '带定位器阀', svg: cvPositionerSvg, type: 'ControlValve' },
    { key: 'p-cv-electric', name: '电动调节阀', svg: cvElectricSvg, type: 'ControlValve' },
    { key: 'p-cv-solenoid', name: '带电磁阀', svg: cvSolenoidSvg, type: 'ControlValve' },
    { key: 'p-cv-manual', name: '手动调节阀', svg: cvManualSvg, type: 'ControlValve' },
    { key: 'p-cv-piston', name: '气缸调节阀', svg: cvPistonSvg, type: 'ControlValve' },
  ];

  controlValves.forEach(v => {
    registerNodeWithCache(v.key, {
      inherit: 'image', width: 40, height: 60, imageUrl: svgToDataUrl(v.svg),
      ports: VALVE_PORTS, attrs: LABEL_ATTRS,
      data: { type: v.type || 'ControlValve', tag: 'FV-101', size: 'DN50', valveClass: 'PN16', failPosition: 'FC' },
    });
  });

  const instruments = [
    { key: 'p-inst-local', name: '就地仪表', svg: instLocalSvg, type: 'Instrument' },
    { key: 'p-inst-remote', name: '远传仪表', svg: instRemoteSvg, type: 'Instrument' },
    { key: 'p-inst-panel', name: '就地盘仪表', svg: instPanelSvg, type: 'Instrument' },
  ];

  instruments.forEach(inst => {
    registerNodeWithCache(inst.key, {
      width: 40, height: 40,
      markup: [{ tagName: 'image', selector: 'body' }, { tagName: 'text', selector: 'topLabel' }, { tagName: 'text', selector: 'bottomLabel' }],
      attrs: {
        body: { refWidth: '100%', refHeight: '100%', xlinkHref: svgToDataUrl(inst.svg) },
        topLabel: { refX: 0.5, refY: 0.35, textAnchor: 'middle', textVerticalAnchor: 'middle', fontSize: 9, fontWeight: 'bold', fill: '#000', text: 'PI' },
        bottomLabel: { refX: 0.5, refY: 0.65, textAnchor: 'middle', textVerticalAnchor: 'middle', fontSize: 9, fontWeight: 'bold', fill: '#000', text: '101' },
      },
      ports: INSTRUMENT_PORTS, data: { type: inst.type, tagId: 'PI', loopNum: '101', range: '0-1.6', unit: 'MPa' },
    });
  });
};

// ============================================================
// [新增] 模块自启动与 HMR 处理
// ============================================================

// 1. 立即执行注册，填充 SHAPE_LIBRARY
try {
  registerCustomCells();
} catch (e) {
  console.warn('[Registry] Auto-init failed:', e);
}

// 2. 显式接受 HMR 更新，确保模块重新评估时状态正确
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    console.log('[Registry] HMR updated. Library refreshed.');
  });
}