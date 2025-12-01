// 这里存放化工设备的 SVG 路径数据
// 颜色规范：#333 (设备轮廓), #666 (内部细节)

// 1. 反应釜 (带夹套 & 搅拌器)
export const REACTOR_SVG = `
<svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg">
  <!-- 夹套 (Jacket) -->
  <path d="M10,40 L10,110 Q10,140 50,140 Q90,140 90,110 L90,40" fill="none" stroke="#888" stroke-width="2" stroke-dasharray="4,2"/>
  <!-- 釜体 (Body) -->
  <path d="M20,30 L20,110 Q20,130 50,130 Q80,130 80,110 L80,30 Q80,10 50,10 Q20,10 20,30 Z" fill="#fff" stroke="#333" stroke-width="3"/>
  <!-- 搅拌器 (Agitator) -->
  <line x1="50" y1="10" x2="50" y2="90" stroke="#333" stroke-width="2"/>
  <line x1="30" y1="90" x2="70" y2="90" stroke="#333" stroke-width="2"/>
  <path d="M30,90 L25,100 M70,90 L75,100" stroke="#333" stroke-width="2"/>
  <!-- 电机 (Motor) -->
  <rect x="40" y="0" width="20" height="10" rx="2" fill="#333"/>
</svg>
`;

// 2. 离心泵 (Centrifugal Pump)
export const PUMP_SVG = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <!-- 底座 -->
  <line x1="10" y1="90" x2="90" y2="90" stroke="#333" stroke-width="2"/>
  <!-- 泵体 (圆形) -->
  <circle cx="50" cy="50" r="30" fill="#fff" stroke="#333" stroke-width="3"/>
  <!-- 出口切线 -->
  <line x1="50" y1="20" x2="50" y2="0" stroke="#333" stroke-width="3"/>
  <path d="M40,25 L50,0 L60,25" fill="none" stroke="transparent"/> 
  <!-- 入口 -->
  <circle cx="50" cy="50" r="10" fill="none" stroke="#333" stroke-width="1"/>
</svg>
`;


// 3. 阀门 (Gate Valve)
export const VALVE_SVG = `
<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
  <!-- 蝶阀形状：两个相对的三角形 -->
  <path d="M0,0 L0,20 L20,10 Z" fill="#fff" stroke="#333" stroke-width="2"/>
  <path d="M40,0 L40,20 L20,10 Z" fill="#fff" stroke="#333" stroke-width="2"/>
  <!-- 阀杆 -->
  <line x1="20" y1="10" x2="20" y2="-5" stroke="#333" stroke-width="2"/>
  <line x1="10" y1="-5" x2="30" y2="-5" stroke="#333" stroke-width="2"/>
</svg>
`;