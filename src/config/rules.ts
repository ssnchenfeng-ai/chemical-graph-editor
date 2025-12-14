// src/config/rules.ts
// ============================================================================
// 全局业务规则配置
// ============================================================================

// 1. 当前图纸 ID (为多页系统做准备，目前暂定为 Draft_V1)
export const CURRENT_DRAWING_ID = 'Draft_V1';

// 2. 介质颜色定义
export const FLUID_COLORS: Record<string, string> = {
  Water: '#1890ff',       // 工艺水 - 蓝
  Steam: '#ff4d4f',       // 蒸汽 - 红
  Air: '#52c41a',         // 空气 - 绿
  N2: '#13c2c2',          // 氮气 - 青
  Oil: '#fa8c16',         // 导热油 - 橙
  Salt: '#722ed1',        // 熔盐 - 紫
  Naphthalene: '#8c8c8c', // 萘 - 深灰
  PA: '#eb2f96',          // 苯酐 - 洋红
  CrudePA: '#f759ab',     // 粗苯酐 - 浅洋红
  ProductGas: '#faad14',  // 产物气 - 金黄
  TailGas: '#bfbfbf',     // 尾气 - 浅灰
  Signal: '#888888',      // 信号线 - 灰
};

// 3. 在线元件列表
// 这些设备被视为"管线的一部分"，路由算法会忽略它们的体积，允许直线穿过
export const INLINE_TYPES = [
  'ControlValve', 
  'Valve', 
  'Fitting', 
  'TappingPoint'
];

// 4. 路由默认配置
export const DEFAULT_ROUTER = {
  name: 'manhattan',
  args: {
    padding: 20,
    excludeNodes: ['SHEET_FRAME_A2'], // 默认排除背景框
  },
};