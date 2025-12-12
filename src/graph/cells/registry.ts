import { Graph } from '@antv/x6';
import frameA2Svg from './svgs/frame-a2.svg?raw';
import reactorSvg from './svgs/reactor.svg?raw';
import exchangerSvg from './svgs/exchanger.svg?raw';
import e13Svg from './svgs/E-13.svg?raw';

import pumpLiquidSvg from './svgs/pump-liquid.svg?raw';
import pumpCentrifugalSvg from './svgs/pump-centrifugal.svg?raw';
import pumpDiaphragmSvg from './svgs/pump-diaphragm.svg?raw';
import pumpPistonSvg from './svgs/pump-piston.svg?raw';
import pumpCompressorSvg from './svgs/pump-compressor.svg?raw';
import pumpGearSvg from './svgs/pump-gear.svg?raw';
import pumpFanSvg from './svgs/pump-fan.svg?raw';
import pumpJetSvg from './svgs/pump-jet.svg?raw';

import cvPneumaticSvg from './svgs/cv-pneumatic.svg?raw';
import cvPositionerSvg from './svgs/cv-positioner.svg?raw';
import cvElectricSvg from './svgs/cv-electric.svg?raw';
import cvSolenoidSvg from './svgs/cv-solenoid.svg?raw';
import cvManualSvg from './svgs/cv-manual.svg?raw';
import cvPistonSvg from './svgs/cv-piston.svg?raw';

import instLocalSvg from './svgs/inst-local.svg?raw';
import instRemoteSvg from './svgs/inst-remote.svg?raw';
import instPanelSvg from './svgs/inst-panel.svg?raw';

import teeSvg from './svgs/tee.svg?raw';
import tankHorizontalSvg from './svgs/tank-horizontal.svg?raw';
import gasCoolerSvg from './svgs/gas-cooler.svg?raw';
import reactorFixedBedSvg from './svgs/reactor-fixed-bed.svg?raw';
import exchangerVerticalSvg from './svgs/exchanger-vertical.svg?raw';






// 1. 定义端口类型枚举，方便管理
type PortDir = 'in' | 'out' | 'bi'; // bi 代表双向，如人孔、呼吸阀

const svgToDataUrl = (svgStr: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svgStr)}`;

// 1. 样式配置
const PORT_ATTRS = {
  circle: {
    r: 3,
    magnet: true,
    stroke: '#FFFFFF',
    strokeWidth: 1,
    fill: '#e3dedeff',
  },
};

// --- 改造 1: 通用泵端口 (明确 dir) ---
const COMMON_PUMP_PORTS = {
  groups: {
    in: { position: 'absolute', attrs: PORT_ATTRS },
    out: { position: 'absolute', attrs: PORT_ATTRS },
  },
  items: [
    { 
      id: 'in', group: 'in', args: { x: '50%', y: '100%' },
      attrs: { circle: { title: '入口 (Inlet)', cursor: 'help' } },
      // 增加 dir: 'in'
      data: { desc: '泵入口', dir: 'in' } 
    },
    { 
      id: 'out', group: 'out', args: { x: '50%', y: '0%' },
      attrs: { circle: { title: '出口 (Outlet)', cursor: 'help' } },
      // 增加 dir: 'out'
      data: { desc: '泵出口', dir: 'out' } 
    },
  ],
};


// 1. 定义阀门端口配置
const VALVE_PORTS = {
  groups: {
    left: { position: 'absolute', attrs: PORT_ATTRS },
    right: { position: 'absolute', attrs: PORT_ATTRS },
    actuator: { position: 'absolute', attrs: PORT_ATTRS }, // 专用执行机构组
  },
  items: [
    { id: 'in', group: 'left', args: { x: '0%', y: '83.33%' }, data: { desc: '阀门入口', dir: 'bi' } },
    { id: 'out', group: 'right', args: { x: '100%', y: '83.33%' }, data: { desc: '阀门出口', dir: 'bi' } },
    
    // --- 关键修改：明确执行机构端口 ---
    { 
      id: 'actuator', 
      group: 'actuator', 
      args: { x: '50%', y: '0%' }, // 位于阀门顶部中心
      attrs: { 
        circle: { 
          r: 4,
          magnet: true,
          stroke: '#fa8c16', // 橙色边框，提示这是信号接口
          strokeWidth: 1,
          fill: '#fff'
        } 
      },
      // 语义数据：类型为 signal，方向为 in (接收控制信号)
      data: { desc: '执行机构', dir: 'in', type: 'signal' } 
    },
  ],
  
};

const LABEL_ATTRS = {
  label: {
    refY: '100%',
    refY2: 8,
    textAnchor: 'middle',
    textVerticalAnchor: 'top',
    fontSize: 12,
    fill: '#333',
  }
};
const TEE_PORTS = {
  groups: {
    all: { position: 'absolute', attrs: PORT_ATTRS },
  },
  items: [
    // 左端口 (对应 SVG y=15, 15/40 = 37.5%)
    { 
      id: 'left', 
      group: 'all', 
      args: { x: '0%', y: '37.5%' }, 
      data: { desc: '三通接口', dir: 'bi' } 
    },
    // 右端口
    { 
      id: 'right', 
      group: 'all', 
      args: { x: '100%', y: '37.5%' }, 
      data: { desc: '三通接口', dir: 'bi' } 
    },
    // 下端口
    { 
      id: 'bottom', 
      group: 'all', 
      args: { x: '50%', y: '100%' }, 
      data: { desc: '三通接口', dir: 'bi' } 
    },
  ],
};
// 2. 修改 TANK_PORTS 定义
const TANK_PORTS = {
  groups: {
    top: { position: 'absolute', attrs: PORT_ATTRS },
    bottom: { position: 'absolute', attrs: PORT_ATTRS },
    left: { position: 'absolute', attrs: PORT_ATTRS },
    right: { position: 'absolute', attrs: PORT_ATTRS },
  },
  items: [
    // --- 顶部 5 个 (y: 0% 位于上边缘) ---
    { group: 'top', args: { x: '20%', y: '0%' }, data: { desc: 'N1' } },
    { group: 'top', args: { x: '35%', y: '0%' }, data: { desc: 'N2' } },
    { group: 'top', args: { x: '50%', y: '0%' }, data: { desc: 'N3' } },
    { group: 'top', args: { x: '65%', y: '0%' }, data: { desc: 'N4' } },
    { group: 'top', args: { x: '80%', y: '0%' }, data: { desc: 'N5' } },
    
    // --- 底部 2 个 (y: 100% 位于下边缘) ---
    { group: 'bottom', args: { x: '30%', y: '100%' }, data: { desc: 'N6' } },
    { group: 'bottom', args: { x: '70%', y: '100%' }, data: { desc: 'N7' } },

    // --- 左右各 1 个 ---
    { group: 'left', args: { x: '0%', y: '50%' }, data: { desc: 'N8' } },
    { group: 'right', args: { x: '100%', y: '50%' }, data: { desc: 'N9' } },
  ],
};
// 定义气体冷却器端口
// src/graph/cells/registry.ts

const GAS_COOLER_PORTS = {
  groups: {
    main: { position: 'absolute', attrs: PORT_ATTRS },
    burst: { position: 'absolute', attrs: PORT_ATTRS },
    top_in: { position: 'absolute', attrs: PORT_ATTRS },
    top_out: { position: 'absolute', attrs: PORT_ATTRS },
    bottom_in: { position: 'absolute', attrs: PORT_ATTRS },
    bottom_out: { position: 'absolute', attrs: PORT_ATTRS },
  },
  items: [
    // 1. 左右连接桩 (保持不变)
    { group: 'main', args: { x: '0%', y: '58%' }, data: { desc: '壳程入口', dir: 'in' } },
    { group: 'main', args: { x: '100%', y: '58%' }, data: { desc: '壳程出口', dir: 'out' } },

    // 2. 顶部爆破片法兰 (保持不变)
    { group: 'burst', args: { x: '8.75%', y: '19%' }, data: { desc: '爆破片接口(左)', dir: 'bi' } },
    { group: 'burst', args: { x: '91.25%', y: '19%' }, data: { desc: '爆破片接口(右)', dir: 'bi' } },

    // ============================================================
    // 3. 顶部管束接口 (Top Tubes) - 逻辑分组定义
    // ============================================================
    
    // --- 高温换热段 (High Temp Section): 第 1, 2 组 ---
    { 
      group: 'top_in', 
      args: { x: '21.25%', y: '15%' }, 
      data: { desc: '高温段', section: 'HighTemp', dir: 'in' } 
    },
    { 
      group: 'top_out', 
      args: { x: '31.25%', y: '15%' }, 
      data: { desc: '高温段', section: 'HighTemp', dir: 'out' } 
    },

    // --- 低温换热段 (Low Temp Section - Common Chamber): 第 3, 4, 5, 6, 7 组 ---
    // 注意：虽然物理上有多个口，但逻辑上它们属于同一个腔室 (section: 'LowTemp')
    { 
      group: 'top_out', 
      args: { x: '41.25%', y: '15%' }, 
      data: { desc: '低温段', section: 'LowTemp', dir: 'out' } 
    },
    
    { 
      group: 'top_in', 
      args: { x: '81.25%', y: '15%' }, 
      data: { desc: '低温段', section: 'LowTemp', dir: 'in' } 
    },

    // ============================================================
    // 4. 底部管束接口 (Bottom Tubes) - 逻辑分组定义
    // ============================================================

    // --- 高温换热段 ---
    { 
      group: 'bottom_in', 
      args: { x: '21.25%', y: '92%' }, 
      data: { desc: '高温段', section: 'HighTemp', dir: 'in' } 
    },
    { 
      group: 'bottom_out', 
      args: { x: '31.25%', y: '92%' }, 
      data: { desc: '高温段', section: 'HighTemp', dir: 'out' } 
    },

    // --- 低温换热段 (公共腔) ---
    { 
      group: 'bottom_out', 
      args: { x: '41.25%', y: '92%' }, 
      data: { desc: '低温段', section: 'LowTemp', dir: 'out' } 
    },
    
    { 
      group: 'bottom_in', 
      args: { x: '81.25%', y: '92%' }, 
      data: { desc: '低温段', section: 'LowTemp', dir: 'in' } 
    },
  ],
};



const INSTRUMENT_PORTS = {
  groups: {
    all: { position: 'absolute', attrs: PORT_ATTRS },
  },
  items: [
    { id: 'top', group: 'all', args: { x: '50%', y: '0%' } },
    { id: 'bottom', group: 'all', args: { x: '50%', y: '100%' } },
    { id: 'left', group: 'all', args: { x: '0%', y: '50%' } },
    { id: 'right', group: 'all', args: { x: '100%', y: '50%' } },
  ],
};
//注册固定床反应器端口
const FIXED_BED_REACTOR_PORTS = {
  groups: {
    gas: { position: 'absolute', attrs: PORT_ATTRS },
    upper_salt: { position: 'absolute', attrs: PORT_ATTRS },
    lower_salt: { position: 'absolute', attrs: PORT_ATTRS },
  },
  items: [
    // --- 气体端口 (增加 id) ---
    { 
      id: 'gas_in', // <--- 固定 ID
      group: 'gas', args: { x: '50%', y: '0%' }, 
      data: { desc: '工艺气入口', region: 'TubeSide', dir: 'in' } 
    },
    { 
      id: 'gas_out', // <--- 固定 ID
      group: 'gas', args: { x: '50%', y: '100%' }, 
      data: { desc: '气体出口', region: 'TubeSide', dir: 'out' } 
    },

    // ============================================================
    // 上盐道 (Upper Salt Ring) - 增加固定 ID
    // ============================================================
    
    // 左侧 (3个)
    { 
      id: 'upper_L1', // <--- 固定 ID
      group: 'upper_salt', args: { x: '7.7%', y: '21.6%' }, 
      data: { desc: '上盐道接口-L1', region: 'UpperSaltChannel', dir: 'in' } 
    },
    { 
      id: 'upper_L2', 
      group: 'upper_salt', args: { x: '7.7%', y: '24.1%' }, 
      data: { desc: '上盐道接口-L2', region: 'UpperSaltChannel', dir: 'in' } 
    },
    { 
      id: 'upper_L3', 
      group: 'upper_salt', args: { x: '7.7%', y: '26.6%' }, 
      data: { desc: '上盐道接口-L3', region: 'UpperSaltChannel', dir: 'out' } 
    },
    
    // 右侧 (2个)
    { 
      id: 'upper_R1', 
      group: 'upper_salt', args: { x: '92.3%', y: '22.6%' }, 
      data: { desc: '上盐道接口-R1', region: 'UpperSaltChannel', dir: 'in' } 
    },
    { 
      id: 'upper_R2', 
      group: 'upper_salt', args: { x: '92.3%', y: '25.6%' }, 
      data: { desc: '上盐道接口-R2', region: 'UpperSaltChannel', dir: 'out' } 
    },

    // ============================================================
    // 下盐道 (Lower Salt Ring) - 增加固定 ID
    // ============================================================

    // 左侧 (3个)
    { 
      id: 'lower_L1', 
      group: 'lower_salt', args: { x: '7.7%', y: '73.3%' }, 
      data: { desc: '下盐道接口-L1', region: 'LowerSaltChannel', dir: 'in' } 
    },
    { 
      id: 'lower_L2', 
      group: 'lower_salt', args: { x: '7.7%', y: '75.8%' }, 
      data: { desc: '下盐道接口-L2', region: 'LowerSaltChannel', dir: 'out' } 
    },
    { 
      id: 'lower_L3', 
      group: 'lower_salt', args: { x: '7.7%', y: '78.3%' }, 
      data: { desc: '下盐道接口-L3', region: 'LowerSaltChannel', dir: 'out' } 
    },

    // 右侧 (2个)
    { 
      id: 'lower_R1', 
      group: 'lower_salt', args: { x: '92.3%', y: '74.3%' }, 
      data: { desc: '下盐道接口-R1', region: 'LowerSaltChannel', dir: 'in' } 
    },
    { 
      id: 'lower_R2', 
      group: 'lower_salt', args: { x: '92.3%', y: '77.3%' }, 
      data: { desc: '下盐道接口-R2', region: 'LowerSaltChannel', dir: 'out' } 
    },
  ],
};

const VERTICAL_EXCHANGER_PORTS = {
  groups: {
    side: { position: 'absolute', attrs: PORT_ATTRS },
    head: { position: 'absolute', attrs: PORT_ATTRS },
  },
  items: [
    // --- 侧面接口 (增加固定 ID) ---
    // 左上
    { 
      id: 'side_left_top', // <--- 固定 ID
      group: 'side', args: { x: '0%', y: '20%' }, 
      data: { desc: '壳程接口(左上)', dir: 'bi' } 
    },
    // 左下
    { 
      id: 'side_left_bottom', 
      group: 'side', args: { x: '0%', y: '80%' }, 
      data: { desc: '壳程接口(左下)', dir: 'bi' } 
    },
    // 右上
    { 
      id: 'side_right_top', 
      group: 'side', args: { x: '100%', y: '15%' }, 
      data: { desc: '壳程接口(右上)', dir: 'bi' } 
    },
    // 右下
    { 
      id: 'side_right_bottom', 
      group: 'side', args: { x: '100%', y: '85%' }, 
      data: { desc: '壳程接口(右下)', dir: 'bi' } 
    },

    // --- 封头接口 (增加固定 ID) ---
    // 上封头左
    { 
      id: 'head_top_left', 
      group: 'head', args: { x: '30%', y: '2.5%' }, 
      data: { desc: '管程接口(上左)', dir: 'bi' } 
    },
    // 上封头右
    { 
      id: 'head_top_right', 
      group: 'head', args: { x: '70%', y: '2.5%' }, 
      data: { desc: '管程接口(上右)', dir: 'bi' } 
    },
    // 下封头左
    { 
      id: 'head_bottom_left', 
      group: 'head', args: { x: '30%', y: '97.5%' }, 
      data: { desc: '管程接口(下左)', dir: 'bi' } 
    },
    // 下封头右
    { 
      id: 'head_bottom_right', 
      group: 'head', args: { x: '70%', y: '97.5%' }, 
      data: { desc: '管程接口(下右)', dir: 'bi' } 
    },
  ],
};

export const registerCustomCells = () => {
  // 1. 注册仪表信号线
  Graph.registerEdge('signal-edge', {
    inherit: 'edge',
    attrs: {
      line: {
        stroke: '#888',
        strokeWidth: 1,
        strokeDasharray: '4 4',
        targetMarker: { name: 'classic', size: 3 },
      },
    },
    data: { type: 'Signal', fluid: 'Signal' },
  });

  // 2. 注册测点 (Tapping Point)
  Graph.registerNode('tapping-point', {
    width: 12, 
    height: 12,
    markup: [
      { tagName: 'circle', selector: 'hitArea' }, 
      { tagName: 'circle', selector: 'body' },    
    ],
    attrs: {
      hitArea: {
        r: 10, 
        fill: 'transparent',
        stroke: 'none',
        magnet: false, 
        cursor: 'move',
        pointerEvents: 'all', 
      },
      body: {
        r: 3,
        fill: '#333',
        stroke: 'none',
        pointerEvents: 'none', 
      },
    },
    ports: { items: [] },
    data: { type: 'TappingPoint', desc: '测量点' },
  });

  // 3. A2 图框 (恢复注册)
  Graph.registerNode('drawing-frame-a2', {
    inherit: 'image',
    width: 2245,
    height: 1587,
    imageUrl: `data:image/svg+xml;utf8,${encodeURIComponent(frameA2Svg)}`,
    ports: { items: [] }, 
    attrs: {
      image: { style: { pointerEvents: 'none' } },
    },
    data: { type: 'Frame', isBackground: true }
  });
  
  // 4. 反应釜
  Graph.registerNode('p-reactor', {
    inherit: 'image',
    width: 80, height: 120,
    imageUrl: svgToDataUrl(reactorSvg),
    ports: {
      groups: {
        feed:   { position: 'absolute', attrs: PORT_ATTRS },
        bottom: { position: 'absolute', attrs: PORT_ATTRS },
        jacket: { position: 'absolute', attrs: PORT_ATTRS },
      },
      items: [
        { id: 'in_1', group: 'feed', args: { x: '31.25%', y: '0%' } },
        { id: 'in_2', group: 'feed', args: { x: '68.75%', y: '0%' } },
        { id: 'out_1', group: 'bottom', args: { x: '50%', y: '100%' } }, 
        { id: 'j_in', group: 'jacket', args: { x: '0%', y: '41.6%' } },
        { id: 'j_out', group: 'jacket', args: { x: '100%', y: '66.6%' } },
      ],
    },
    attrs: LABEL_ATTRS,
    data: { 
      type: 'Reactor', 
      tag: 'R-101',
      spec: 'STD-2000L',
      volume: '2000',
      material: 'SS304',
      designPressure: '0.6',
      designTemp: '150'
    },
  });

  // --- 改造 3: 换热器 (关键修改) ---
  Graph.registerNode('p-exchanger', {
    inherit: 'image',
    width: 200, height: 80,
    imageUrl: svgToDataUrl(exchangerSvg),
    ports: {
      groups: {
        shell: { position: 'absolute', attrs: PORT_ATTRS },
        tube_left: { position: 'absolute', attrs: PORT_ATTRS },
        tube_right: { position: 'absolute', attrs: PORT_ATTRS },
      },
      items: [
        {
          id: 'n1', group: 'shell', args: { x: '35%', y: '0%' },
          attrs: { circle: { title: 'N1 (入口)', cursor: 'help' } },
          // N1 是壳程入口
          data: { desc: '壳程入口(N1)', dir: 'in' }
        },
        {
          id: 'n2', group: 'shell', args: { x: '75%', y: '100%' },
          attrs: { circle: { title: 'N2 (出口)', cursor: 'help' } },
          // N2 是壳程出口
          data: { desc: '壳程出口(N2)', dir: 'out' }
        },
        {
          id: 'n4', group: 'tube_left', args: { x: '0%', y: '32.5%' },
          attrs: { circle: { title: 'N4 (出口)', cursor: 'help' } },
          // N4 是管程出口
          data: { desc: '管程出口(N4)', dir: 'out' }
        },
        {
          id: 'n3', group: 'tube_left', args: { x: '0%', y: '67.5%' },
          attrs: { circle: { title: 'N3 (入口)', cursor: 'help' } },
          // N3 是管程入口
          data: { desc: '管程入口(N3)', dir: 'in' }
        },
        // 封头管口通常作为备用或排净，可设为 bi 或 out
        { id: 'n5', group: 'tube_right', args: { x: '98%', y: '12%' }, data: { desc: '放空(N5)', dir: 'out' } },
        { id: 'n6', group: 'tube_right', args: { x: '98%', y: '88%' }, data: { desc: '排净(N6)', dir: 'out' } },
      ],
    },
    attrs: LABEL_ATTRS,
    data: { 
      type: 'Exchanger', 
      tag: 'E-101',
      spec: 'BES-50',
      area: '50',
      material: 'CS/SS304',
      designPressure: '1.6'
    },
  });

  // 6. 萘蒸发器
  Graph.registerNode('p-naphthalene-evaporator', {
    inherit: 'image', width: 200, height: 120,
    imageUrl: svgToDataUrl(e13Svg),
    ports: {
      groups: { 
        shell: { position: 'absolute', attrs: PORT_ATTRS }, 
        tube: { position: 'absolute', attrs: PORT_ATTRS } 
      },
      items: [
        { id: 'nap_out', group: 'shell', args: { x: '61.5%', y: '0%' }, data: { desc: '萘蒸汽出口' } },
        { id: 'nap_in', group: 'shell', args: { x: '13.5%', y: '100%' }, data: { desc: '工业萘入口' } },
        { id: 'steam_in', group: 'tube', args: { x: '100%', y: '63%' }, data: { desc: '蒸汽入口' } },
        { id: 'cond_out', group: 'tube', args: { x: '100%', y: '78%' }, data: { desc: '冷凝液出口' } },
      ],
    },
    attrs: LABEL_ATTRS, data: { type: 'Evaporator', spec: 'E-13' },
  });

  // 7. 泵类
  const pumps = [
    { key: 'p-pump-liquid', name: '液体泵', svg: pumpLiquidSvg, type: 'LiquidPump' },
    { key: 'p-pump-centrifugal', name: '离心泵', svg: pumpCentrifugalSvg, type: 'CentrifugalPump' },
    { key: 'p-pump-diaphragm', name: '隔膜泵', svg: pumpDiaphragmSvg, type: 'DiaphragmPump' },
    { key: 'p-pump-piston', name: '活塞泵', svg: pumpPistonSvg, type: 'PistonPump' },
    { key: 'p-pump-compressor', name: '压缩机', svg: pumpCompressorSvg, type: 'Compressor' },
    { key: 'p-pump-gear', name: '齿轮泵', svg: pumpGearSvg, type: 'GearPump' },
    { key: 'p-pump-fan', name: '风扇', svg: pumpFanSvg, type: 'Fan' },
    { key: 'p-pump-jet', name: '喷射泵', svg: pumpJetSvg, type: 'JetPump' },
  ];

  pumps.forEach(item => {
    Graph.registerNode(item.key, {
      inherit: 'image',
      width: 60,
      height: 60,
      imageUrl: `data:image/svg+xml;utf8,${encodeURIComponent(item.svg)}`,
      ports: COMMON_PUMP_PORTS,
      attrs: LABEL_ATTRS,
      data: { 
        type: item.type,
        tag: 'P-101',
        spec: 'IH50-32-160',
        flow: '25',
        head: '30',
        power: '7.5',
        material: 'SS304'
      },
    });
  });

  // 8. 阀门 (高度修正为 60)
  const valves = [
    { key: 'p-cv-pneumatic', name: '气动调节阀', svg: cvPneumaticSvg, type: 'ControlValve' },
    { key: 'p-cv-positioner', name: '带定位器阀', svg: cvPositionerSvg, type: 'ControlValve' },
    { key: 'p-cv-electric', name: '电动调节阀', svg: cvElectricSvg, type: 'ControlValve' },
    { key: 'p-cv-solenoid', name: '带电磁阀', svg: cvSolenoidSvg, type: 'ControlValve' },
    { key: 'p-cv-manual', name: '手动调节阀', svg: cvManualSvg, type: 'ControlValve' },
    { key: 'p-cv-piston', name: '气缸调节阀', svg: cvPistonSvg, type: 'ControlValve' },
  ];

  valves.forEach(v => {
    Graph.registerNode(v.key, {
      inherit: 'image',
      width: 40,   
      height: 60,  // 修正高度
      imageUrl: `data:image/svg+xml;utf8,${encodeURIComponent(v.svg)}`,
      ports: VALVE_PORTS, 
      attrs: LABEL_ATTRS,
      data: { 
        type: v.type || 'ControlValve',
        tag: 'FV-101',
        size: 'DN50',
        valveClass: 'PN16',
        failPosition: 'FC'
      },
    });
  });

  // 9. 仪表
  const instruments = [
    { key: 'p-inst-local', name: '就地仪表', svg: instLocalSvg, type: 'Instrument' },
    { key: 'p-inst-remote', name: '远传仪表', svg: instRemoteSvg, type: 'Instrument' },
    { key: 'p-inst-panel', name: '就地盘仪表', svg: instPanelSvg, type: 'Instrument' },
  ];

  instruments.forEach(inst => {
    Graph.registerNode(inst.key, {
      width: 50,
      height: 50,
      markup: [
        { tagName: 'image', selector: 'body' },
        { tagName: 'text', selector: 'topLabel' },
        { tagName: 'text', selector: 'bottomLabel' }
      ],
      attrs: {
        body: {
          refWidth: '100%',
          refHeight: '100%',
          xlinkHref: `data:image/svg+xml;utf8,${encodeURIComponent(inst.svg)}`,
        },
        topLabel: {
          refX: 0.5, refY: 0.35, textAnchor: 'middle', textVerticalAnchor: 'middle',
          fontSize: 10, fontWeight: 'bold', fill: '#000', text: 'PI',
        },
        bottomLabel: {
          refX: 0.5, refY: 0.65, textAnchor: 'middle', textVerticalAnchor: 'middle',
          fontSize: 10, fontWeight: 'bold', fill: '#000', text: '101',
        },
      },
      ports: INSTRUMENT_PORTS,
      data: { 
        type: inst.type, 
        tagId: 'PI',    
        loopNum: '101',
        range: '0-1.6',
        unit: 'MPa'
      },
    });
  });
  // 10. 三通 (Tee) - 新增注册
  Graph.registerNode('p-tee', {
    inherit: 'image',
    width: 40,
    height: 40,
    imageUrl: svgToDataUrl(teeSvg),
    ports: TEE_PORTS,
    attrs: {
      label: {
        refY: '100%',
        refY2: 4,
        textAnchor: 'middle',
        textVerticalAnchor: 'top',
        fontSize: 12,
        fill: '#333',
      }
    },
    data: { 
      type: 'Fitting', // 类型设为管件
      spec: 'Tee',
      tag: 'TEE'
    },
  });
  Graph.registerNode('p-tank-horizontal', {
    inherit: 'image',
    width: 160,
    height: 80,
    imageUrl: svgToDataUrl(tankHorizontalSvg),
    ports: TANK_PORTS, // 这里现在使用的是标准圆点样式
    attrs: {
      label: {
        text: 'V-100',
        refY: '100%',
        refY2: 10,
      }
    },
    data: { 
      type: 'Tank', 
      spec: 'Horizontal',
      volume: '5000L'
    },
  });
  // 注册气体冷却器
  Graph.registerNode('p-gas-cooler', {
    inherit: 'image',
    width: 200, // 缩小一半显示，原图400
    height: 130,
    imageUrl: svgToDataUrl(gasCoolerSvg),
    ports: GAS_COOLER_PORTS,
    attrs: {
      label: {
        text: 'E-201',
        refY: '100%',
        refY2: 10,
      }
    },
    data: { 
      type: 'GasCooler', 
      spec: 'AirCooled',
      area: '200'
    },
  });
//注册固定床反应器
  Graph.registerNode('p-fixed-bed-reactor', {
    inherit: 'image',
    width: 130,
    height: 150,
    imageUrl: svgToDataUrl(reactorFixedBedSvg),
    ports: FIXED_BED_REACTOR_PORTS,
    attrs: {
      label: {
        text: 'D-14',
        refY: '100%',
        refY2: 10,
      }
    },
    data: { 
      type: 'FixedBedReactor', 
      spec: '20000 Tubes',
      catalyst: 'V2O5'
    },
  });
  // 注册立式换热器
  Graph.registerNode('p-exchanger-vertical', {
    inherit: 'image',
    width: 60,  // 较窄
    height: 200, // 较高
    imageUrl: svgToDataUrl(exchangerVerticalSvg),
    ports: VERTICAL_EXCHANGER_PORTS,
    attrs: {
      label: {
        text: 'E-102',
        refY: '100%',
        refY2: 10,
      }
    },
    data: { 
      type: 'VerticalExchanger', // <--- 修改这里，不再是 'Exchanger'
      spec: 'Vertical',
      area: '100'
    },
  });
};