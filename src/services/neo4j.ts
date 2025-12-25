// src/services/neo4j.ts
import neo4j from 'neo4j-driver';
import { FLUID_COLORS, CURRENT_DRAWING_ID } from '../config/rules';

const uri = import.meta.env.VITE_NEO4J_URI || 'bolt://localhost:7687';
const user = import.meta.env.VITE_NEO4J_USER || 'neo4j';
const password = import.meta.env.VITE_NEO4J_PASSWORD || '';

// 创建驱动实例
const driver = neo4j.driver(
  uri,
  neo4j.auth.basic(user, password)
);

export default driver;

// [新增] 类型映射表：定义 X6 type 到 Neo4j Labels 的映射关系
// 所有的节点都会自动带上 :Asset 标签
const TYPE_MAPPING: Record<string, string[]> = {
  // 反应器类
  'Reactor':           ['Equipment', 'Reactor'],
  'FixedBedReactor':   ['Equipment', 'Reactor'],
  
  // 换热器类
  'Exchanger':         ['Equipment', 'Exchanger'],
  'VerticalExchanger': ['Equipment', 'Exchanger'],
  'Evaporator':        ['Equipment', 'Exchanger'],
  'GasCooler':         ['Equipment', 'Exchanger'],
  
  // 泵/压缩机类
  'Pump':              ['Equipment', 'Pump'],
  'LiquidPump':        ['Equipment', 'Pump'],
  'CentrifugalPump':   ['Equipment', 'Pump'],
  'DiaphragmPump':     ['Equipment', 'Pump'],
  'PistonPump':        ['Equipment', 'Pump'],
  'GearPump':          ['Equipment', 'Pump'],
  'JetPump':           ['Equipment', 'Pump'],
  'Compressor':        ['Equipment', 'Pump', 'Compressor'], // 压缩机也是流体输送设备，但也可是独立分类
  'Fan':               ['Equipment', 'Pump', 'Fan'],
  
  // 阀门类 (包括手动阀和调节阀)
  'Valve':             ['Equipment', 'Valve'],
  'ControlValve':      ['Equipment', 'Valve', 'ControlValve'], // 调节阀既是阀门，也是控制元件
  //'Trap':              ['Equipment', 'Trap'],
  
  // 容器类
  'Tank':              ['Equipment', 'Vessel', 'Storage'],
  //'Trap':              ['Equipment', 'Vessel'],
  'Separator':         ['Equipment', 'Vessel', 'Separator'], 

  
  // 管件
  'Fitting':           ['Equipment', 'Fitting'],
  
  // 仪表类
  'Instrument':        ['Instrument'],
  'TappingPoint':      ['Instrument', 'Connection'], // 测点

  // === [新增] 安全设施 ===
  // 给它们打上 SafetyDevice 标签，方便 AI 查询所有安全设施
  'SafetyValve':       ['Equipment', 'Valve', 'SafetyDevice'],
  'RuptureDisc':       ['Equipment', 'SafetyDevice', 'Fitting'],
  'BreatherValve':     ['Equipment', 'Valve', 'SafetyDevice'],

  // === [新增] 疏水阀 ===
  'Trap':              ['Equipment', 'Valve', 'Trap'],

  // === [新增] 附件 ===
  'Filter':            ['Equipment', 'Fitting', 'Filter'],
  'FlameArrester':     ['Equipment', 'SafetyDevice', 'Fitting'],
  'SightGlass':        ['Equipment', 'Fitting', 'Indicator'],
  'Silencer':          ['Equipment', 'Fitting'],

  
  // 默认
  'default':           ['Equipment', 'Other']
};

export const saveGraphData = async (nodes: any[], edges: any[]) => {
  const session = driver.session();
  const tx = session.beginTransaction();
  try {
    // 1. [修改] 删除当前图纸的所有资产 (使用基类标签 :Asset)
    await tx.run(
      `MATCH (n:Asset {drawingId: $drawingId}) DETACH DELETE n`,
      { drawingId: CURRENT_DRAWING_ID }
    );

    // 2. [重构] 保存节点 - 根据类型进行分组批量插入
    if (nodes.length) {
      // 2.1 在内存中对节点进行分组
      const groups: Record<string, any[]> = {};
      
      nodes.forEach(node => {
        const type = node.type || 'Unknown';
        // 获取对应的标签列表，例如 ['Equipment', 'Pump']
        const labels = TYPE_MAPPING[type] || TYPE_MAPPING['default'];
        // 生成唯一的 Group Key，例如 "Equipment_Pump"
        const groupKey = labels.join(':');
        
        if (!groups[groupKey]) groups[groupKey] = [];
        groups[groupKey].push(node);
      });

      // 2.2 针对每一组生成特定的 Cypher 语句
      for (const [labelString, batch] of Object.entries(groups)) {
        // labelString 是 "Equipment:Pump"，我们需要把它拼接到 Cypher 中
        // 注意：Cypher 不支持参数化 Label，所以这里必须使用字符串拼接
        // 但由于 labelString 来自我们内部定义的 TYPE_MAPPING，所以是安全的
        const labels = `:Asset:${labelString}`; 
        
        await tx.run(
          `UNWIND $batch AS n 
           CREATE (e${labels} {x6Id: n.x6Id, drawingId: $drawingId}) 
           SET e += n`, 
          { batch, drawingId: CURRENT_DRAWING_ID }
        );
      }
    }

    // 3. 保存连线 (匹配 :Asset)
    if (edges.length) {
      const pipes = edges.filter(e => e.type !== 'Signal');
      const signals = edges.filter(e => e.type === 'Signal');

      // 3.1 保存工艺管线
      if (pipes.length) {
        await tx.run(
          `UNWIND $pipes AS r 
           MATCH (s:Asset {x6Id: r.source}), (t:Asset {x6Id: r.target}) 
           CREATE (s)-[:PIPE {
             fromPort:   r.sourcePort, 
             toPort:     r.targetPort,
             tag:        r.label,
             material:   r.material,
             fluid:      r.fluid,
             dn:         r.dn,
             pn:         r.pn,
             insulation: r.insulation,
             fromRegion: r.sourceRegion, 
             fromDesc:   r.sourceDesc,
             toRegion:   r.targetRegion,
             toDesc:     r.targetDesc,
             vertices:   r.vertices
           }]->(t)`, 
          { pipes }
        );
      }

      // 3.2 保存信号线
      if (signals.length) {
        const controlSignals = signals.filter((s: any) => s.targetPort === 'actuator' || s.relationType === 'CONTROLS');
        const measureSignals = signals.filter((s: any) => s.targetPort !== 'actuator' && s.relationType !== 'CONTROLS');

        if (controlSignals.length) {
          await tx.run(
            `UNWIND $batch AS r 
             MATCH (s:Asset {x6Id: r.source}), (t:Asset {x6Id: r.target}) 
             CREATE (s)-[:CONTROLS {
               fromPort:   r.sourcePort, 
               toPort:     r.targetPort,
               fluid:      'Signal',
               vertices:   r.vertices 
             }]->(t)`, 
            { batch: controlSignals }
          );
        }

        if (measureSignals.length) {
          await tx.run(
            `UNWIND $batch AS r 
             MATCH (inst:Asset {x6Id: r.target}), (tp:Asset {x6Id: r.source}) 
             CREATE (inst)-[:MEASURES {
               fromPort:   r.targetPort,
               toPort:     r.sourcePort,
               fluid:      'Signal',
               vertices:   r.vertices
             }]->(tp)`, 
            { batch: measureSignals }
          );
        }
      }
    }

    await tx.commit();
  } catch (e) {
    await tx.rollback();
    throw e;
  } finally {
    await session.close();
  }
};


  export const loadGraphData = async () => {
  const session = driver.session();
  try {
    // 1. 加载节点
    const nodesResult = await session.run(
      `MATCH (n:Asset {drawingId: $drawingId}) RETURN n`,
      { drawingId: CURRENT_DRAWING_ID }
    );
    
    const nodes = nodesResult.records.map(record => {
      const props = record.get('n').properties;
      
      // 1. 解析 layout JSON
      let layout: any = { x: 0, y: 0, w: 40, h: 40, a: 0, s: ''  };
      if (props.layout) {
        try {
          layout = JSON.parse(props.layout);
        } catch (e) {
          console.warn('Layout parse failed for node:', props.x6Id);
        }
      } else {
        // 兼容旧数据
        layout = {
          x: props.x || 0,
          y: props.y || 0,
          w: props.width || 40,
          h: props.height || 40,
          a: props.angle || 0,
          s: props.shape || ''
        };
      }

      // ... (Tag 处理逻辑保持不变) ...
      if (props.Tag) { props.tag = props.Tag; }
      const isTee = props.type === 'Fitting';
      if (isTee) { props.tag = 'TEE'; props.Tag = 'TEE'; }

      // ... (Shape 映射逻辑保持不变) ...
      let shapeName = layout.s || props.shape; 
      if (!shapeName) {
        shapeName = 'p-valve'; 
      switch (props.type) {
          
          case 'Reactor':      shapeName = 'p-r101'; break;
          case 'Exchanger':    shapeName = 'p-e101'; break;
          case 'Pump':         shapeName = 'p-centrifugalpump'; break;
          case 'LiquidPump':   shapeName = 'p-p101'; break;
          case 'CentrifugalPump': shapeName = 'p-centrifugalpump'; break;
          case 'DiaphragmPump': shapeName = 'p-diaphragmpump'; break;
          case 'PistonPump':   shapeName = 'p-pistonpump'; break;
          case 'Compressor':   shapeName = 'p-compressor'; break;
          case 'GearPump':     shapeName = 'p-gearpump'; break;
          case 'Fan':          shapeName = 'p-fan'; break;
          case 'JetPump':      shapeName = 'p-jetpump'; break;
          case 'ControlValve': shapeName = 'p-cv-pneumatic'; break;
          case 'Valve':        shapeName = 'p-cv-manual'; break;
          case 'Fitting':      shapeName = 'p-tee'; break; 
          case 'Tank':         if (props.spec === 'Vertical') {shapeName = 'p-tankvertical';} else {shapeName = 'p-tank';} break;
          case 'GasCooler':    shapeName = 'p-gascooler'; break;
          case 'Trap':         shapeName = 'p-trap'; break;
          case 'FixedBedReactor': shapeName = 'p-fixedbedreactor'; break;
          case 'VerticalExchanger': shapeName = 'p-exchangervertical'; break;
          case 'Evaporator':   shapeName = 'p-e13'; break;
          case 'Instrument':   
            if(props.spec === 'Local') shapeName = 'p-inst-local';
            else if(props.spec === 'Panel') shapeName = 'p-inst-panel';
            else shapeName = 'p-inst-remote';
            break;
          case 'TappingPoint': shapeName = 'tapping-point'; break;
          default: break;
      }
    }

      // [核心修正 1] 清理 props，分离出纯业务数据
      // 我们不希望 data 里包含 layout 字符串，也不希望包含旧的 x,y
      const { layout: _layoutStr, x, y, width, height, angle, ...businessData } = props;

      return {
        id: props.x6Id,
        shape: shapeName, 
        
        // [核心修正 2] 使用解析后的 layout 变量
        // 注意：保存时用的键是 w, h, a，这里要对应上
        x: layout.x,
        y: layout.y,
        width: layout.w, 
        height: layout.h,
        angle: layout.a, 
        
        // [核心修正 3] data 只放入清洗后的业务数据
        data: { ...businessData }, 
        
        attrs: { 
          label: { 
            text: isTee ? '' : (props.Tag || props.tag || props.label),
            display: isTee ? 'none' : undefined
          },
          topLabel: props.tagId ? { text: props.tagId } : undefined,
          bottomLabel: props.loopNum ? { text: props.loopNum } : undefined,
        }
      };
    });

    // 2. [修改] 加载连线 (匹配 :Asset)
    const edgesResult = await session.run(`
      MATCH (s:Asset {drawingId: $drawingId})-[r:PIPE|MEASURES|CONTROLS]->(t:Asset {drawingId: $drawingId}) 
      RETURN s.x6Id as sourceId, t.x6Id as targetId, r, type(r) as relType
    `, { drawingId: CURRENT_DRAWING_ID });
    
    // ... (edges map 逻辑保持不变) ...
    const edges = edgesResult.records.map(record => {
        // ... 保持原样 ...
        const rel = record.get('r').properties;
        const relType = record.get('relType'); 
        const sourceId = record.get('sourceId');
        const targetId = record.get('targetId');
        
        let strokeWidth = 2;
        let strokeColor = FLUID_COLORS[rel.fluid] || '#5F95FF';
        let dashArray = null;
        let targetMarker: any = null; 
        let edgeType = 'Pipe'; 
        let labels: any[] = [];
        let vertices = [];
        
        if (rel.vertices) {
            try { vertices = JSON.parse(rel.vertices); } catch (e) { console.warn('Vertices parse error', e); }
        }

        if (relType === 'MEASURES' || relType === 'CONTROLS') {
            strokeWidth = 1;
            strokeColor = FLUID_COLORS.Signal; 
            dashArray = '4 4';    
            targetMarker = { name: 'classic', width: 10, height: 6 }; 
            edgeType = 'Signal';
        } else {
            targetMarker = { name: 'classic', width: 8, height: 6 }; 
            if (rel.insulation && rel.insulation.startsWith('Jacket')) {
            strokeWidth = 4;
            strokeColor = FLUID_COLORS.Oil; 
            } else if (['ST', 'ET', 'OT'].includes(rel.insulation)) {
            dashArray = '5 5'; 
            }
        }

        if (relType === 'PIPE' && rel.tag) {
            labels.push({
            attrs: { label: { text: rel.tag }, body: { fill: '#fff', stroke: '#333' } },
            position: { distance: 0.5, args: { y: -10 }, options: { 
                  keepGradient: true, 
                  ensureLegibility: true 
                } } 
            });
        }

        let finalSourceId = sourceId;
        let finalTargetId = targetId;
        let finalSourcePort = rel.fromPort;
        let finalTargetPort = rel.toPort;

        if (relType === 'MEASURES') {
            finalSourceId = targetId; 
            finalTargetId = sourceId; 
            finalSourcePort = rel.toPort;   
            finalTargetPort = rel.fromPort; 
        }

        return {
            shape: edgeType === 'Signal' ? 'signal-edge' : 'edge',
            source: { cell: finalSourceId, port: finalSourcePort || undefined },
            target: { cell: finalTargetId, port: finalTargetPort || undefined },
            vertices: vertices, 
            attrs: { 
            line: { 
                stroke: strokeColor,
                strokeWidth: strokeWidth,
                strokeDasharray: dashArray,
                targetMarker: targetMarker
            } 
            },
            labels: labels,
            data: { 
            type: edgeType, 
            relationType: relType, 
            material: rel.material, 
            fluid: rel.fluid,
            dn: rel.dn,
            pn: rel.pn,
            insulation: rel.insulation
            }
        };
    });

    return { nodes, edges };
  } finally {
    await session.close();
  }
};