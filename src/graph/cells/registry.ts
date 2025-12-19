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
import tankVerticalSvg from './svgs/tank-vertical.svg?raw'; 
import gasCoolerSvg from './svgs/gas-cooler.svg?raw';
import reactorFixedBedSvg from './svgs/reactor-fixed-bed.svg?raw';
import exchangerVerticalSvg from './svgs/exchanger-vertical.svg?raw';
import trapSvg from './svgs/trap.svg?raw';
import tvtrapSvg from './svgs/tv-Trap.svg?raw';

export type PortDir = 'in' | 'out' | 'bi';
export interface PortData {
  dir?: PortDir;
  [key: string]: any;
}

// 确保使用 utf-8 编码，防止中文乱码或 SVG 解析失败
const svgToDataUrl = (svgStr: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgStr)}`;

const PORT_ATTRS = {
  circle: { r: 3, magnet: true, stroke: '#FFFFFF', strokeWidth: 1, fill: '#e3dedeff' },
};

const LABEL_ATTRS = {
  label: { refY: '100%', refY2: 8, textAnchor: 'middle', textVerticalAnchor: 'top', fontSize: 12, fill: '#333' }
};
// [优化] E-13 端口定义：引入气液分相语义
const E13_PORTS = {
  groups: { 
    top: { position: 'absolute', attrs: PORT_ATTRS }, 
    bottom: { position: 'absolute', attrs: PORT_ATTRS }, 
    left: { position: 'absolute', attrs: PORT_ATTRS }, 
    heater: { position: 'absolute', attrs: PORT_ATTRS } 
  },
  items: [
    // ========================================================================
    // 1. 壳程-气相区 (ShellSide:Vapor)
    //    位于设备上半部分，用于排出萘蒸汽、连接安全阀或液位计上法兰
    // ========================================================================
    
    // 顶部接口 (必然是气相)
    { id: 't1', group: 'top', args: { x: '22%', y: '1.1%' }, data: { desc: '顶部接口-1', region: 'ShellSide:Vapor', phase: 'Gas', dir: 'bi' } as PortData },
    { id: 't2', group: 'top', args: { x: '34%', y: '1.1%' }, data: { desc: '顶部接口-2', region: 'ShellSide:Vapor', phase: 'Gas', dir: 'bi' } as PortData },
    { id: 't3', group: 'top', args: { x: '46%', y: '1.1%' }, data: { desc: '顶部接口-3', region: 'ShellSide:Vapor', phase: 'Gas', dir: 'bi' } as PortData },
    { id: 't4', group: 'top', args: { x: '58%', y: '1.1%' }, data: { desc: '顶部接口-4', region: 'ShellSide:Vapor', phase: 'Gas', dir: 'bi' } as PortData },

    // 左侧上半部接口 (气相空间)
    { id: 'l1', group: 'left', args: { x: '3%', y: '17.7%' }, data: { desc: '左侧接口-1(上)', region: 'ShellSide:Vapor', phase: 'Gas', dir: 'in' } as PortData }, // y=80
    { id: 'l2', group: 'left', args: { x: '3%', y: '31.1%' }, data: { desc: '左侧接口-2(上)', region: 'ShellSide:Vapor', phase: 'Gas', dir: 'in' } as PortData }, // y=140
    { id: 'l3', group: 'left', args: { x: '3%', y: '44.4%' }, data: { desc: '左侧接口-3(中上)', region: 'ShellSide:Vapor', phase: 'Gas', dir: 'in' } as PortData }, // y=200

    // ========================================================================
    // 2. 壳程-液相区 (ShellSide:Liquid)
    //    位于设备下半部分，加热器浸没于此，用于进料、排污或液位计下法兰
    // ========================================================================

    // 底部接口 (必然是液相)
    { id: 'b1', group: 'bottom', args: { x: '22%', y: '98.9%' }, data: { desc: '底部接口-1', region: 'ShellSide:Liquid', phase: 'Liquid', dir: 'bi' } as PortData },
    { id: 'b2', group: 'bottom', args: { x: '34%', y: '98.9%' }, data: { desc: '底部接口-2', region: 'ShellSide:Liquid', phase: 'Liquid', dir: 'bi' } as PortData },
    { id: 'b3', group: 'bottom', args: { x: '46%', y: '98.9%' }, data: { desc: '底部接口-3', region: 'ShellSide:Liquid', phase: 'Liquid', dir: 'bi' } as PortData },
    { id: 'b4', group: 'bottom', args: { x: '58%', y: '98.9%' }, data: { desc: '底部接口-4', region: 'ShellSide:Liquid', phase: 'Liquid', dir: 'bi' } as PortData },

    // 左侧下半部接口 (液相空间)
    { id: 'l4', group: 'left', args: { x: '3%', y: '57.7%' }, data: { desc: '左侧接口-4(中下)', region: 'ShellSide:Liquid', phase: 'Liquid', dir: 'in' } as PortData }, // y=260
    { id: 'l5', group: 'left', args: { x: '3%', y: '71.1%' }, data: { desc: '左侧接口-5(下)', region: 'ShellSide:Liquid', phase: 'Liquid', dir: 'in' } as PortData }, // y=320
    { id: 'l6', group: 'left', args: { x: '3%', y: '84.4%' }, data: { desc: '左侧接口-6(下)', region: 'ShellSide:Liquid', phase: 'Liquid', dir: 'in' } as PortData }, // y=380

    // ========================================================================
    // 3. 管程 (TubeSide)
    //    独立的加热回路，与壳程物理隔离
    // ========================================================================
    
    { id: 'h_in', group: 'heater', args: { x: '83%', y: '51.1%' }, data: { desc: '蒸汽入口', region: 'TubeSide', phase: 'Gas', dir: 'in' } as PortData },
    { id: 'h_out', group: 'heater', args: { x: '83%', y: '93.3%' }, data: { desc: '冷凝水出口', region: 'TubeSide', phase: 'Liquid', dir: 'out' } as PortData },
  ],
};
// ... (端口定义保持不变，此处省略以节省篇幅) ...
// 如果您需要完整的端口定义代码，请告知，通常这部分不会导致图标丢失。
// 关键是下面的 registerCustomCells 函数
const REACTOR_PORTS = {
  groups: { 
    top: { position: 'absolute', attrs: PORT_ATTRS }, 
    left_side: { position: 'absolute', attrs: PORT_ATTRS }, 
    right_side: { position: 'absolute', attrs: PORT_ATTRS }, 
    jacket: { position: 'absolute', attrs: PORT_ATTRS },
    bottom: { position: 'absolute', attrs: PORT_ATTRS } 
  },
  items: [
    // ========================================================================
    // 1. 釜顶区域 (Top) - 气相空间 (Gas Phase)
    //    分布四个连接桩，用于搅拌、放空、备用等
    // ========================================================================
    { id: 'n1', group: 'top', args: { x: '15%', y: '0%' }, data: { desc: '釜顶接口N1', region: 'InnerVessel', phase: 'Gas', dir: 'bi' } as PortData },
    { id: 'n2', group: 'top', args: { x: '30%', y: '0%' }, data: { desc: '釜顶接口N2', region: 'InnerVessel', phase: 'Gas', dir: 'bi' } as PortData },
    { id: 'n3', group: 'top', args: { x: '70%', y: '0%' }, data: { desc: '釜顶接口N3', region: 'InnerVessel', phase: 'Gas', dir: 'bi' } as PortData },
    { id: 'n4', group: 'top', args: { x: '85%', y: '0%' }, data: { desc: '釜顶接口N4', region: 'InnerVessel', phase: 'Gas', dir: 'bi' } as PortData },

    // ========================================================================
    // 2. 进料口 (Feed) - 左侧上部
    //    位于液面之上，属于气相空间
    // ========================================================================
    { 
      id: 'feed_in', 
      group: 'left_side', 
      args: { x: '0%', y: '30%' }, // 较高位置
      data: { desc: '进料口', region: 'InnerVessel', phase: 'Gas', dir: 'in' } as PortData 
    },

    // ========================================================================
    // 3. 溢流口 (Overflow) - 右侧略低于进料口
    //    定义液位高度，溢流口本身及流出物料视为液相
    // ========================================================================
    { 
      id: 'overflow', 
      group: 'right_side', 
      args: { x: '100%', y: '30%' }, // y=30% 略低于进料口的 20%
      data: { desc: '溢流口', region: 'InnerVessel', phase: 'Liquid', dir: 'out' } as PortData 
    },

    // ========================================================================
    // 4. 半管夹套 (Half-Pipe Jacket)
    //    独立的热交换区域
    // ========================================================================
    { 
      id: 'j_in', 
      group: 'jacket', 
      args: { x: '0%', y: '45%' }, // 左侧中部进入
      data: { desc: '半管夹套入口', region: 'Jacket', dir: 'in' } as PortData 
    },
    { 
      id: 'j_out', 
      group: 'jacket', 
      args: { x: '100%', y: '75%' }, // 右侧下部流出
      data: { desc: '半管夹套出口', region: 'Jacket', dir: 'out' } as PortData 
    },

    // ========================================================================
    // 5. 釜底区域 (Bottom) - 液相空间 (Liquid Phase)
    //    包含出料口和温度测点
    // ========================================================================
    { 
      id: 'discharge', 
      group: 'bottom', 
      args: { x: '50%', y: '100%' }, // 正底
      data: { desc: '釜底出料口', region: 'InnerVessel', phase: 'Liquid', dir: 'out' } as PortData 
    },
    { 
      id: 'temp_point', 
      group: 'bottom', 
      args: { x: '25%', y: '92%' }, // 底部偏左，用于插入热电阻
      attrs: { circle: { r: 3, fill: '#faad14', stroke: '#333' } }, // 视觉上区分一下测点
      data: { desc: '釜底温度口', region: 'InnerVessel', phase: 'Liquid', type: 'Instrument' } as PortData 
    },
  ],
};
const COMMON_PUMP_PORTS = {
  groups: { in: { position: 'absolute', attrs: PORT_ATTRS }, out: { position: 'absolute', attrs: PORT_ATTRS } },
  items: [
    { id: 'in', group: 'in', args: { x: '50%', y: '100%' }, attrs: { circle: { title: '入口', cursor: 'help' } }, data: { desc: '泵入口', dir: 'in' } as PortData },
    { id: 'out', group: 'out', args: { x: '50%', y: '0%' }, attrs: { circle: { title: '出口', cursor: 'help' } }, data: { desc: '泵出口', dir: 'out' } as PortData },
  ],
};

const VALVE_PORTS = {
  groups: { left: { position: 'absolute', attrs: PORT_ATTRS }, right: { position: 'absolute', attrs: PORT_ATTRS }, actuator: { position: 'absolute', attrs: PORT_ATTRS } },
  items: [
    { id: 'in', group: 'left', args: { x: '0%', y: '83.33%' }, data: { desc: '阀门入口', dir: 'bi' } as PortData },
    { id: 'out', group: 'right', args: { x: '100%', y: '83.33%' }, data: { desc: '阀门出口', dir: 'bi' } as PortData },
    { id: 'actuator', group: 'actuator', args: { x: '50%', y: '0%' }, attrs: { circle: { r: 4, magnet: true, stroke: '#fa8c16', strokeWidth: 1, fill: '#fff' } }, data: { desc: '执行机构', dir: 'in', type: 'signal' } as PortData },
  ],
};

const TEE_PORTS = {
  groups: { all: { position: 'absolute', attrs: PORT_ATTRS } },
  items: [
    { id: 'p1', group: 'all', args: { x: '0%', y: '50%' }, data: { desc: '三通接口-1', dir: 'bi' } as PortData },
    { id: 'p2', group: 'all', args: { x: '100%', y: '50%' }, data: { desc: '三通接口-2', dir: 'bi' } as PortData },
    { id: 'p3', group: 'all', args: { x: '50%', y: '100%' }, data: { desc: '三通接口-3', dir: 'bi' } as PortData },
  ],
};

const TANK_HORIZONTAL_PORTS = {
  groups: { 
    top: { position: 'absolute', attrs: PORT_ATTRS }, 
    bottom: { position: 'absolute', attrs: PORT_ATTRS }, 
    left: { position: 'absolute', attrs: PORT_ATTRS }, 
    right: { position: 'absolute', attrs: PORT_ATTRS } 
  },
  items: [
    // ========================================================================
    // 1. 顶部端口 - 气相空间 (Gas Phase)
    //    用于：放空、呼吸阀、氮封、气相进料
    // ========================================================================
    { id: 'n1', group: 'top', args: { x: '20%', y: '0%' }, data: { desc: '顶部口N1', region: 'InnerVessel', phase: 'Gas', dir: 'bi' } as PortData },
    { id: 'n2', group: 'top', args: { x: '35%', y: '0%' }, data: { desc: '顶部口N2', region: 'InnerVessel', phase: 'Gas', dir: 'bi' } as PortData },
    { id: 'n3', group: 'top', args: { x: '50%', y: '0%' }, data: { desc: '顶部口N3', region: 'InnerVessel', phase: 'Gas', dir: 'bi' } as PortData },
    { id: 'n4', group: 'top', args: { x: '65%', y: '0%' }, data: { desc: '顶部口N4', region: 'InnerVessel', phase: 'Gas', dir: 'bi' } as PortData },
    { id: 'n5', group: 'top', args: { x: '80%', y: '0%' }, data: { desc: '顶部口N5', region: 'InnerVessel', phase: 'Gas', dir: 'bi' } as PortData },
    
    // ========================================================================
    // 2. 底部端口 - 液相空间 (Liquid Phase)
    //    用于：排净、出料泵吸入口
    // ========================================================================
    { id: 'n6', group: 'bottom', args: { x: '20%', y: '100%' }, data: { desc: '底部口N6', region: 'InnerVessel', phase: 'Liquid', dir: 'out' } as PortData },
    { id: 'n7', group: 'bottom', args: { x: '35%', y: '100%' }, data: { desc: '底部口N7', region: 'InnerVessel', phase: 'Liquid', dir: 'out' } as PortData },
    { id: 'n8', group: 'bottom', args: { x: '50%', y: '100%' }, data: { desc: '底部口N8', region: 'InnerVessel', phase: 'Liquid', dir: 'out' } as PortData },
    { id: 'n9', group: 'bottom', args: { x: '65%', y: '100%' }, data: { desc: '底部口N9', region: 'InnerVessel', phase: 'Liquid', dir: 'out' } as PortData },
    { id: 'n10', group: 'bottom', args: { x: '80%', y: '100%' }, data: { desc: '底部口N10', region: 'InnerVessel', phase: 'Liquid', dir: 'out' } as PortData },
    
    // ========================================================================
    // 3. 侧面/端部端口 - 通常为液相 (Liquid Phase)
    //    用于：人孔、液位计接口、进料
    // ========================================================================
    { id: 'n11', group: 'left', args: { x: '0%', y: '50%' }, data: { desc: '左侧口N11', region: 'InnerVessel', phase: 'Liquid', dir: 'bi' } as PortData },
    { id: 'n14', group: 'right', args: { x: '100%', y: '50%' }, data: { desc: '右侧口N14', region: 'InnerVessel', phase: 'Liquid', dir: 'bi' } as PortData },
  ],
};

const TANK_VERTICAL_PORTS = {
  groups: { 
    top: { position: 'absolute', attrs: PORT_ATTRS }, 
    bottom: { position: 'absolute', attrs: PORT_ATTRS }, 
    left_upper: { position: 'absolute', attrs: PORT_ATTRS }, 
    left_lower: { position: 'absolute', attrs: PORT_ATTRS },
    right_upper: { position: 'absolute', attrs: PORT_ATTRS },
    right_lower: { position: 'absolute', attrs: PORT_ATTRS }
  },
  items: [
    // --- 顶部封头 (气相) ---
    // y=10% 对应 SVG 中的 y=20 (封头顶点)
    { id: 't1', group: 'top', args: { x: '50%', y: '10%' }, data: { desc: '顶部放空', region: 'InnerVessel', phase: 'Gas', dir: 'out' } as PortData },
    
    // --- 底部封头 (液相) ---
    // y=90% 对应 SVG 中的 y=180 (封头底点)
    { id: 'b1', group: 'bottom', args: { x: '50%', y: '90%' }, data: { desc: '底部出料', region: 'InnerVessel', phase: 'Liquid', dir: 'out' } as PortData },

    // --- 侧壁上部 (气相) ---
    // y=30% 位于直边上部
    { id: 'l_up', group: 'left_upper', args: { x: '10%', y: '30%' }, data: { desc: '上部侧口(左)', region: 'InnerVessel', phase: 'Gas', dir: 'in' } as PortData },
    { id: 'r_up', group: 'right_upper', args: { x: '90%', y: '30%' }, data: { desc: '上部侧口(右)', region: 'InnerVessel', phase: 'Gas', dir: 'in' } as PortData },

    // --- 侧壁下部 (液相) ---
    // y=70% 位于直边下部
    { id: 'l_low', group: 'left_lower', args: { x: '10%', y: '70%' }, data: { desc: '下部侧口(左)', region: 'InnerVessel', phase: 'Liquid', dir: 'in' } as PortData },
    { id: 'r_low', group: 'right_lower', args: { x: '90%', y: '70%' }, data: { desc: '下部侧口(右)', region: 'InnerVessel', phase: 'Liquid', dir: 'in' } as PortData },
  ],
};

const GAS_COOLER_PORTS = {
  groups: { 
    main: { position: 'absolute', attrs: PORT_ATTRS }, 
    burst: { position: 'absolute', attrs: PORT_ATTRS }, 
    top_in: { position: 'absolute', attrs: PORT_ATTRS }, 
    top_out: { position: 'absolute', attrs: PORT_ATTRS }, 
    bottom_in: { position: 'absolute', attrs: PORT_ATTRS }, 
    bottom_out: { position: 'absolute', attrs: PORT_ATTRS } 
  },
  items: [
    // ========================================================================
    // 1. 壳程 (Shell Side) - 走产物气 (Process Gas)
    // ========================================================================
    { 
      id: 'shell_in', group: 'main', args: { x: '0%', y: '58%' }, 
      data: { desc: '壳程入口(产物气)', region: 'ShellSide', phase: 'Gas', dir: 'in' } as PortData 
    },
    { 
      id: 'shell_out', group: 'main', args: { x: '100%', y: '58%' }, 
      data: { desc: '壳程出口(产物气)', region: 'ShellSide', phase: 'Gas', dir: 'out' } as PortData 
    },

    // ========================================================================
    // 2. 爆破片接口 (Burst Disc)
    //    物理位置在管箱上，归属管程侧
    // ========================================================================
    { 
      id: 'burst_left', group: 'burst', args: { x: '8.75%', y: '19%' }, 
      data: { desc: '爆破片接口(左)', region: 'TubeSide', dir: 'out' } as PortData 
    },
    { 
      id: 'burst_right', group: 'burst', args: { x: '91.25%', y: '19%' }, 
      data: { desc: '爆破片接口(右)', region: 'TubeSide', dir: 'out' } as PortData 
    },

    // ========================================================================
    // 3. 管程 (Tube Side) - 走冷却水 (Water)
    //    分为高温段 (HighTemp) 和 低温段 (LowTemp)
    // ========================================================================
    
    // --- 顶部接口 ---
    { 
      id: 'tube_top_in_1', group: 'top_in', args: { x: '21.25%', y: '15%' }, 
      data: { desc: '高温段水入口', region: 'TubeSide', section: 'HighTemp', phase: 'Liquid', dir: 'in' } as PortData 
    },
    { 
      id: 'tube_top_out_1', group: 'top_out', args: { x: '31.25%', y: '15%' }, 
      data: { desc: '高温段水出口', region: 'TubeSide', section: 'HighTemp', phase: 'Liquid', dir: 'out' } as PortData 
    },
    { 
      id: 'tube_top_out_2', group: 'top_out', args: { x: '41.25%', y: '15%' }, 
      data: { desc: '低温段水出口', region: 'TubeSide', section: 'LowTemp', phase: 'Liquid', dir: 'out' } as PortData 
    },
    { 
      id: 'tube_top_in_2', group: 'top_in', args: { x: '81.25%', y: '15%' }, 
      data: { desc: '低温段水入口', region: 'TubeSide', section: 'LowTemp', phase: 'Liquid', dir: 'in' } as PortData 
    },

    // --- 底部接口 ---
    { 
      id: 'tube_bot_in_1', group: 'bottom_in', args: { x: '21.25%', y: '92%' }, 
      data: { desc: '高温段水入口(下)', region: 'TubeSide', section: 'HighTemp', phase: 'Liquid', dir: 'in' } as PortData 
    },
    { 
      id: 'tube_bot_out_1', group: 'bottom_out', args: { x: '31.25%', y: '92%' }, 
      data: { desc: '高温段水出口(下)', region: 'TubeSide', section: 'HighTemp', phase: 'Liquid', dir: 'out' } as PortData 
    },
    { 
      id: 'tube_bot_out_2', group: 'bottom_out', args: { x: '41.25%', y: '92%' }, 
      data: { desc: '低温段水出口(下)', region: 'TubeSide', section: 'LowTemp', phase: 'Liquid', dir: 'out' } as PortData 
    },
    { 
      id: 'tube_bot_in_2', group: 'bottom_in', args: { x: '81.25%', y: '92%' }, 
      data: { desc: '低温段水入口(下)', region: 'TubeSide', section: 'LowTemp', phase: 'Liquid', dir: 'in' } as PortData 
    },
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

const FIXED_BED_REACTOR_PORTS = {
  groups: { gas: { position: 'absolute', attrs: PORT_ATTRS }, upper_salt: { position: 'absolute', attrs: PORT_ATTRS }, lower_salt: { position: 'absolute', attrs: PORT_ATTRS } },
  items: [
    { id: 'gas_in', group: 'gas', args: { x: '50%', y: '0%' }, data: { desc: '工艺气入口', region: 'TubeSide', dir: 'in' } as PortData },
    { id: 'gas_out', group: 'gas', args: { x: '50%', y: '100%' }, data: { desc: '气体出口', region: 'TubeSide', dir: 'out' } as PortData },
    { id: 'upper_L1', group: 'upper_salt', args: { x: '7.7%', y: '21.6%' }, data: { desc: '上盐道接口-L1', region: 'UpperSaltChannel', dir: 'in' } as PortData },
    { id: 'upper_L2', group: 'upper_salt', args: { x: '7.7%', y: '24.1%' }, data: { desc: '上盐道接口-L2', region: 'UpperSaltChannel', dir: 'in' } as PortData },
    { id: 'upper_L3', group: 'upper_salt', args: { x: '7.7%', y: '26.6%' }, data: { desc: '上盐道接口-L3', region: 'UpperSaltChannel', dir: 'out' } as PortData },
    { id: 'upper_R1', group: 'upper_salt', args: { x: '92.3%', y: '22.6%' }, data: { desc: '上盐道接口-R1', region: 'UpperSaltChannel', dir: 'in' } as PortData },
    { id: 'upper_R2', group: 'upper_salt', args: { x: '92.3%', y: '25.6%' }, data: { desc: '上盐道接口-R2', region: 'UpperSaltChannel', dir: 'out' } as PortData },
    { id: 'lower_L1', group: 'lower_salt', args: { x: '7.7%', y: '73.3%' }, data: { desc: '下盐道接口-L1', region: 'LowerSaltChannel', dir: 'in' } as PortData },
    { id: 'lower_L2', group: 'lower_salt', args: { x: '7.7%', y: '75.8%' }, data: { desc: '下盐道接口-L2', region: 'LowerSaltChannel', dir: 'out' } as PortData },
    { id: 'lower_L3', group: 'lower_salt', args: { x: '7.7%', y: '78.3%' }, data: { desc: '下盐道接口-L3', region: 'LowerSaltChannel', dir: 'out' } as PortData },
    { id: 'lower_R1', group: 'lower_salt', args: { x: '92.3%', y: '74.3%' }, data: { desc: '下盐道接口-R1', region: 'LowerSaltChannel', dir: 'in' } as PortData },
    { id: 'lower_R2', group: 'lower_salt', args: { x: '92.3%', y: '77.3%' }, data: { desc: '下盐道接口-R2', region: 'LowerSaltChannel', dir: 'out' } as PortData },
  ],
};

const VERTICAL_EXCHANGER_PORTS = {
  groups: { 
    side: { position: 'absolute', attrs: PORT_ATTRS }, 
    head: { position: 'absolute', attrs: PORT_ATTRS } 
  },
  items: [
    // ========================================================================
    // 1. 壳程 (Shell Side) - 侧面接口
    // ========================================================================
    { 
      id: 'side_left_top', group: 'side', args: { x: '0%', y: '20%' }, 
      data: { desc: '壳程接口(左上)', region: 'ShellSide', dir: 'bi' } as PortData 
    },
    { 
      id: 'side_left_bottom', group: 'side', args: { x: '0%', y: '80%' }, 
      data: { desc: '壳程接口(左下)', region: 'ShellSide', dir: 'bi' } as PortData 
    },
    { 
      id: 'side_right_top', group: 'side', args: { x: '100%', y: '15%' }, 
      data: { desc: '壳程接口(右上)', region: 'ShellSide', dir: 'bi' } as PortData 
    },
    { 
      id: 'side_right_bottom', group: 'side', args: { x: '100%', y: '85%' }, 
      data: { desc: '壳程接口(右下)', region: 'ShellSide', dir: 'bi' } as PortData 
    },

    // ========================================================================
    // 2. 管程 (Tube Side) - 上下封头接口
    // ========================================================================
    { 
      id: 'head_top_left', group: 'head', args: { x: '30%', y: '2.5%' }, 
      data: { desc: '管程接口(上左)', region: 'TubeSide', dir: 'bi' } as PortData 
    },
    { 
      id: 'head_top_right', group: 'head', args: { x: '70%', y: '2.5%' }, 
      data: { desc: '管程接口(上右)', region: 'TubeSide', dir: 'bi' } as PortData 
    },
    { 
      id: 'head_bottom_left', group: 'head', args: { x: '30%', y: '97.5%' }, 
      data: { desc: '管程接口(下左)', region: 'TubeSide', dir: 'bi' } as PortData 
    },
    { 
      id: 'head_bottom_right', group: 'head', args: { x: '70%', y: '97.5%' }, 
      data: { desc: '管程接口(下右)', region: 'TubeSide', dir: 'bi' } as PortData 
    },
  ],
};

const TRAP_PORTS = {
  groups: { top_in: { position: 'absolute', attrs: PORT_ATTRS }, top_out: { position: 'absolute', attrs: PORT_ATTRS }, side: { position: 'absolute', attrs: PORT_ATTRS } },
  items: [
    { id: 'n1', group: 'top_in', args: { x: '73.3%', y: '10%' }, data: { desc: '入口(N1)', dir: 'in' } as PortData },
    { id: 'n2', group: 'top_out', args: { x: '31.6%', y: '10%' }, data: { desc: '出口(N2)', dir: 'out' } as PortData },
    { id: 'm1', group: 'side', args: { x: '8.3%', y: '56%' }, data: { desc: '排净/人孔(M1)', dir: 'bi' } as PortData },
  ],
};

export const registerCustomCells = () => {
  Graph.registerEdge('signal-edge', {
    inherit: 'edge',
    attrs: { line: { stroke: '#888', strokeWidth: 1, strokeDasharray: '4 4', targetMarker: { name: 'classic', size: 3 } } },
    data: { type: 'Signal', fluid: 'Signal' },
  });

  Graph.registerNode('tapping-point', {
    width: 12, height: 12,
    markup: [{ tagName: 'circle', selector: 'hitArea' }, { tagName: 'circle', selector: 'body' }],
    attrs: {
      hitArea: { r: 10, fill: 'transparent', stroke: 'none', magnet: false, cursor: 'move', pointerEvents: 'all' },
      body: { r: 3, fill: '#333', stroke: 'none', pointerEvents: 'none' },
    },
    ports: { items: [] },
    data: { type: 'TappingPoint', desc: '测量点' },
  });

  Graph.registerNode('drawing-frame-a2', {
    inherit: 'image', width: 2245, height: 1587,
    imageUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(frameA2Svg)}`,
    ports: { items: [] }, attrs: { image: { style: { pointerEvents: 'none' } } },
    data: { type: 'Frame', isBackground: true }
  });
  
  Graph.registerNode('p-reactor', {
    inherit: 'image', 
    width: 80, 
    height: 120, 
    imageUrl: svgToDataUrl(reactorSvg),
    ports: REACTOR_PORTS, // <--- 引用新定义的常量
    attrs: LABEL_ATTRS, 
    data: { 
      type: 'Reactor', 
      tag: 'R-101', 
      spec: 'HalfPipe-2000L', // 更新规格描述
      volume: '2.0', 
      material: 'SS304', 
      designPressure: '0.6', 
      designTemp: '150' 
    },
  });

  Graph.registerNode('p-exchanger', {
    inherit: 'image', 
    width: 200, 
    height: 80, 
    imageUrl: svgToDataUrl(exchangerSvg),
    ports: {
      groups: { 
        shell: { position: 'absolute', attrs: PORT_ATTRS }, 
        tube_left: { position: 'absolute', attrs: PORT_ATTRS }, 
        tube_right: { position: 'absolute', attrs: PORT_ATTRS } 
      },
      items: [
        // ====================================================================
        // 1. 壳程 (Shell Side) - 筒体侧
        //    通常走蒸汽、冷却水或工艺介质
        // ====================================================================
        { 
          id: 'n1', 
          group: 'shell', 
          args: { x: '35%', y: '0%' }, 
          attrs: { circle: { title: 'N1 (壳程入口)', cursor: 'help' } }, 
          // [语义增强] 明确属于壳程，流向为入
          data: { desc: '壳程入口(N1)', region: 'ShellSide', dir: 'in' } as PortData 
        },
        { 
          id: 'n2', 
          group: 'shell', 
          args: { x: '75%', y: '100%' }, 
          attrs: { circle: { title: 'N2 (壳程出口)', cursor: 'help' } }, 
          // [语义增强] 明确属于壳程，流向为出
          data: { desc: '壳程出口(N2)', region: 'ShellSide', dir: 'out' } as PortData 
        },

        // ====================================================================
        // 2. 管程 (Tube Side) - 管束侧
        //    通常走需要被加热/冷却的物料
        // ====================================================================
        { 
          id: 'n3', 
          group: 'tube_left', 
          args: { x: '0%', y: '67.5%' }, 
          attrs: { circle: { title: 'N3 (管程入口)', cursor: 'help' } }, 
          // [语义增强] 明确属于管程，位于左下
          data: { desc: '管程入口(N3)', region: 'TubeSide', dir: 'in' } as PortData 
        },
        { 
          id: 'n4', 
          group: 'tube_left', 
          args: { x: '0%', y: '32.5%' }, 
          attrs: { circle: { title: 'N4 (管程出口)', cursor: 'help' } }, 
          // [语义增强] 明确属于管程，位于左上
          data: { desc: '管程出口(N4)', region: 'TubeSide', dir: 'out' } as PortData 
        },

        // ====================================================================
        // 3. 辅助接口 (Auxiliary)
        //    放空与排净，物理上通常位于壳体
        // ====================================================================
        { 
          id: 'n5', 
          group: 'tube_right', 
          args: { x: '98%', y: '12%' }, 
          // [语义增强] 归属壳程，类型为放空
          data: { desc: '放空(N5)', region: 'ShellSide', type: 'Vent', dir: 'out' } as PortData 
        },
        { 
          id: 'n6', 
          group: 'tube_right', 
          args: { x: '98%', y: '88%' }, 
          // [语义增强] 归属壳程，类型为排净
          data: { desc: '排净(N6)', region: 'ShellSide', type: 'Drain', dir: 'out' } as PortData 
        },
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

  Graph.registerNode('p-naphthalene-evaporator', {
    inherit: 'image', 
    width: 200, 
    height: 90, // 调整高度以匹配 1000:450 的比例 (200 * 0.45 = 90)
    imageUrl: svgToDataUrl(e13Svg),
    ports: E13_PORTS,
    attrs: LABEL_ATTRS, 
    data: { type: 'Evaporator', spec: '蒸发器', tag: 'E-13' },
  });

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
      inherit: 'image', width: 60, height: 60, imageUrl: svgToDataUrl(item.svg),
      ports: COMMON_PUMP_PORTS, attrs: LABEL_ATTRS,
      data: { type: item.type, tag: 'P-101', spec: 'IH50-32-160', flow: '25', head: '30', power: '7.5', material: 'SS304' },
    });
  });

  const controlValves = [
    { key: 'p-cv-pneumatic', name: '气动调节阀', svg: cvPneumaticSvg, type: 'ControlValve' },
    { key: 'p-cv-positioner', name: '带定位器阀', svg: cvPositionerSvg, type: 'ControlValve' },
    { key: 'p-cv-electric', name: '电动调节阀', svg: cvElectricSvg, type: 'ControlValve' },
    { key: 'p-cv-solenoid', name: '带电磁阀', svg: cvSolenoidSvg, type: 'ControlValve' },
    { key: 'p-cv-manual', name: '手动调节阀', svg: cvManualSvg, type: 'ControlValve' },
    { key: 'p-cv-piston', name: '气缸调节阀', svg: cvPistonSvg, type: 'ControlValve' },
  ];

  controlValves.forEach(v => {
    Graph.registerNode(v.key, {
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
    Graph.registerNode(inst.key, {
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

  Graph.registerNode('p-tee', {
    inherit: 'image', 
    width: 20, 
    height: 20, 
    imageUrl: svgToDataUrl(teeSvg),
    ports: TEE_PORTS,
    attrs: { 
      label: { 
        display: 'none', 
        text: '' 
      } 
    },
    data: { type: 'Fitting', spec: 'Tee', tag: 'TEE' },
  });

  Graph.registerNode('p-tank-horizontal', {
    inherit: 'image', width: 160, height: 80, imageUrl: svgToDataUrl(tankHorizontalSvg),
    ports: TANK_HORIZONTAL_PORTS, attrs: { label: { text: 'V-100', refY: '100%', refY2: 10 } },
    data: { type: 'Tank', spec: 'Horizontal', volume: '5.0' },
  });

  // 3. 注册立式储罐
  Graph.registerNode('p-tank-vertical', {
    inherit: 'image', 
    width: 80, 
    height: 160, // 保持 1:2 比例
    imageUrl: svgToDataUrl(tankVerticalSvg), // 使用导入的 SVG
    ports: TANK_VERTICAL_PORTS,
    attrs: { label: { text: 'V-101', refY: '100%', refY2: 10 } },
    data: { type: 'Tank', spec: 'Vertical', volume: '10.0' },
  });

  Graph.registerNode('p-gas-cooler', {
    inherit: 'image', width: 200, height: 130, imageUrl: svgToDataUrl(gasCoolerSvg),
    ports: GAS_COOLER_PORTS, attrs: { label: { text: 'E-201', refY: '100%', refY2: 10 } },
    data: { type: 'GasCooler', spec: 'AirCooled', area: '200' },
  });

  Graph.registerNode('p-fixed-bed-reactor', {
    inherit: 'image', width: 130, height: 150, imageUrl: svgToDataUrl(reactorFixedBedSvg),
    ports: FIXED_BED_REACTOR_PORTS, attrs: { label: { text: 'D-14', refY: '100%', refY2: 10 } },
    data: { type: 'FixedBedReactor', spec: '20000 Tubes', catalyst: 'V2O5' },
  });

  Graph.registerNode('p-exchanger-vertical', {
    inherit: 'image', width: 60, height: 200, imageUrl: svgToDataUrl(exchangerVerticalSvg),
    ports: VERTICAL_EXCHANGER_PORTS, attrs: { label: { text: 'E-102', refY: '100%', refY2: 10 } },
    data: { type: 'VerticalExchanger', spec: 'Vertical', area: '100' },
  });

  Graph.registerNode('p-trap', {
    inherit: 'image', width: 120, height: 100, imageUrl: svgToDataUrl(trapSvg),
    ports: TRAP_PORTS,
    attrs: { label: { text: 'V-102', refY: '100%', refY2: 10, textAnchor: 'middle', textVerticalAnchor: 'top', fontSize: 12, fill: '#333' } },
    data: { type: 'Trap', spec: 'Gravity', material: 'SS304', volume: '500L' },
  });
  //疏水阀注册
  Graph.registerNode('p-tv-trap', {
  inherit: 'image',
  width: 250, 
  height: 100,
  imageUrl: svgToDataUrl(tvtrapSvg),
  ports: {
    groups: {
        all: { position: 'absolute', attrs: PORT_ATTRS }
    },
    items: [
        { id: 'i', group: 'all', args: { x: '0%', y: '49%' }, data: { desc: '新接口', region: 'ShellSide', dir: 'bi' } as PortData },
        { id: 'o', group: 'all', args: { x: '100%', y: '49%' }, data: { desc: '新接口', region: 'ShellSide', dir: 'bi' } as PortData }
    ],
  },
  attrs: LABEL_ATTRS,
  data: { 
    type: 'Trap', 
    tag: 'tv-Trap', 
    spec: 'Spec...',
  },
});

};