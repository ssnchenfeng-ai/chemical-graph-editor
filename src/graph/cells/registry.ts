// src/graph/cells/registry.ts
import { Graph } from '@antv/x6';

// --- SVG Imports (保留用于手动注册的基础元素 SVG) ---
import frameA2Svg from './svgs/frame-a2.svg?raw';

// ============================================================
// 1. 自动化扫描配置
// ============================================================
// 自动扫描 ./svgs 下的所有 .svg 文件 (作为字符串加载)
const SVG_MODULES = import.meta.glob('./svgs/*.svg', { eager: true, query: '?raw', import: 'default' });
// 自动扫描 ./data 下的所有 .json 文件 (作为对象加载)
const JSON_MODULES = import.meta.glob('./data/*.json', { eager: true, import: 'default' });

// --- 全局变量与类型定义 ---

// 图元库缓存，供 ShapeDesigner 等工具回显使用
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
  markup?: any[]; // 支持自定义 markup (如仪表)
  data: any;
  imageUrl?: string; // 兼容性字段
}

// --- 工具函数 ---

// 确保使用 utf-8 编码构建 Data URL
const svgToDataUrl = (svgStr: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgStr)}`;

// 通用样式常量
const LABEL_ATTRS = {
  label: { refY: '100%', refY2: 8, textAnchor: 'middle', textVerticalAnchor: 'top', fontSize: 12, fill: '#333' }
};

// 内部注册函数：同时写入 X6 引擎和 SHAPE_LIBRARY 缓存
const registerNodeWithCache = (id: string, config: any) => {
  // [修改点 1] 使用 try-catch 捕获重复注册错误
  try {
    Graph.registerNode(id, config);
  } catch (e) {
    // 忽略 "already registered" 错误，继续执行以更新缓存
  }

  // 2. 存入缓存供设计器读取
  let rawSvg = '';
  // 尝试还原 SVG 源码供设计器回显
  // 情况 A: 简单图元，SVG 在 imageUrl 中
  if (config.imageUrl && typeof config.imageUrl === 'string') {
    try {
      const base64Data = config.imageUrl.split(',')[1];
      if (base64Data) rawSvg = decodeURIComponent(base64Data);
    } catch (e) { console.warn('Failed to decode SVG:', id); }
  }
  // 情况 B: 复杂图元 (仪表)，SVG 在 attrs.body.xlinkHref 中
  else if (config.attrs?.body?.xlinkHref) {
    try {
      const base64Data = config.attrs.body.xlinkHref.split(',')[1];
      if (base64Data) rawSvg = decodeURIComponent(base64Data);
    } catch (e) { console.warn('Failed to decode SVG:', id); }
  }

  SHAPE_LIBRARY[id] = {
    ...config,
    rawSvg, 
  };
};

// ============================================================
// 2. 自动化注册逻辑 (Auto Loader)
// ============================================================

const autoRegisterShapes = () => {
  console.log(`[Registry] Found ${Object.keys(JSON_MODULES).length} custom shapes in /data folder.`);

  for (const path in JSON_MODULES) {
    try {
      // 深拷贝配置，防止修改原始模块导致 HMR 问题
      const config = JSON.parse(JSON.stringify(JSON_MODULES[path])) as ShapeConfig;
      
      // 从文件名推导 ID: ./data/p-reactor.json -> p-reactor
      const fileName = path.split('/').pop()?.replace('.json', '');
      const shapeId = fileName || 'unknown';

      // [新增] 端口 ID 去重清洗逻辑 (防止 Duplicated port id 错误)
      if (config.ports && Array.isArray(config.ports.items)) {
        const seenIds = new Set<string>();
        const uniqueItems: any[] = [];
        
        config.ports.items.forEach((item: any) => {
          if (seenIds.has(item.id)) {
            console.warn(`[Registry] ⚠️ Duplicate port ID '${item.id}' detected in ${shapeId}. Skipping duplicate.`);
          } else {
            seenIds.add(item.id);
            uniqueItems.push(item);
          }
        });
        config.ports.items = uniqueItems;
      }

      // 查找对应的 SVG (要求 SVG 文件名与 JSON 文件名一致)
      const svgPath = `./svgs/${shapeId}.svg`;
      const svgContent = SVG_MODULES[svgPath] as string;

      if (!svgContent) {
        console.warn(`[Registry] Missing SVG for ${shapeId} (expected at ${svgPath})`);
        continue;
      }

      const svgDataUrl = svgToDataUrl(svgContent);

      // [核心逻辑] 区分简单图元和复杂图元
      if (config.markup) {
        // === 复杂图元 (如仪表) ===
        // 必须将 SVG 注入到 attrs.body.xlinkHref 中
        if (!config.attrs) config.attrs = {};
        if (!config.attrs.body) config.attrs.body = {};
        
        // 动态注入 SVG
        config.attrs.body.xlinkHref = svgDataUrl;

        registerNodeWithCache(shapeId, {
          // 不继承 image，完全使用自定义 markup
          width: config.width,
          height: config.height,
          markup: config.markup,
          attrs: config.attrs,
          ports: config.ports,
          data: config.data
        });

      } else {
        // === 简单图元 (如设备) ===
        // 继承 image，使用 imageUrl
        registerNodeWithCache(shapeId, {
          inherit: 'image',
          width: config.width,
          height: config.height,
          imageUrl: svgDataUrl,
          ports: config.ports,
          attrs: config.attrs || LABEL_ATTRS,
          data: config.data
        });
      }
      
    } catch (e) {
      console.error(`[Registry] Failed to register shape from ${path}`, e);
    }
  }
};

// ============================================================
// 3. 注册入口函数
// ============================================================

export const registerCustomCells = () => {
  // 1. 执行自动化注册 (扫描 JSON + SVG)
  autoRegisterShapes();

  // 2. 注册基础元素 (非业务图元)
  
  // 信号线 [修改点 2] 使用 try-catch
  try {
    Graph.registerEdge('signal-edge', {
      inherit: 'edge',
      attrs: { line: { stroke: '#888', strokeWidth: 1, strokeDasharray: '4 4', targetMarker: { name: 'classic', size: 3 } } },
      data: { type: 'Signal', fluid: 'Signal' },
    });
  } catch (e) { /* ignore */ }

  // 测点 (Tapping Point)
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

  // A2 图框背景
  registerNodeWithCache('drawing-frame-a2', {
    inherit: 'image', width: 2245, height: 1587,
    imageUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(frameA2Svg)}`,
    ports: { items: [] }, attrs: { image: { style: { pointerEvents: 'none' } } },
    data: { type: 'Frame', isBackground: true }
  });
};

// ============================================================
// 模块自启动与 HMR 处理
// ============================================================

try {
  registerCustomCells();
} catch (e) {
  console.warn('[Registry] Auto-init failed:', e);
}

if (import.meta.hot) {
  import.meta.hot.accept(() => {
    console.log('[Registry] HMR updated. Library refreshed.');
  });
}