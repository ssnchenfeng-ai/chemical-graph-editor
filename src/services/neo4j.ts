// src/services/neo4j.ts
import neo4j from 'neo4j-driver';
import { FLUID_COLORS } from '../config/rules'; // 注意：这里不再引用 CURRENT_DRAWING_ID

const uri = import.meta.env.VITE_NEO4J_URI || 'bolt://localhost:7687';
const user = import.meta.env.VITE_NEO4J_USER || 'neo4j';
const password = import.meta.env.VITE_NEO4J_PASSWORD || '';

// 创建驱动实例
const driver = neo4j.driver(
  uri,
  neo4j.auth.basic(user, password)
);

export default driver;

// 类型映射表
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
  'Compressor':        ['Equipment', 'Pump', 'Compressor'],
  'Fan':               ['Equipment', 'Pump', 'Fan'],
  
  // 阀门类
  'Valve':             ['Equipment', 'Valve'],
  'ControlValve':      ['Equipment', 'Valve', 'ControlValve'],
  
  // 容器类
  'Tank':              ['Equipment', 'Vessel', 'Storage'],
  'Separator':         ['Equipment', 'Vessel', 'Separator'], 
  
  // 管件
  'Fitting':           ['Equipment', 'Fitting'],
  
  // 仪表类
  'Instrument':        ['Instrument'],
  'TappingPoint':      ['Instrument', 'Connection'],

  // 安全设施
  'SafetyValve':       ['Equipment', 'Valve', 'SafetyDevice'],
  'RuptureDisc':       ['Equipment', 'SafetyDevice', 'Fitting'],
  'BreatherValve':     ['Equipment', 'Valve', 'SafetyDevice'],

  // 疏水阀
  'Trap':              ['Equipment', 'Valve', 'Trap'],

  // 附件
  'Filter':            ['Equipment', 'Fitting', 'Filter'],
  'FlameArrester':     ['Equipment', 'SafetyDevice', 'Fitting'],
  'SightGlass':        ['Equipment', 'Fitting', 'Indicator'],
  'Silencer':          ['Equipment', 'Fitting'],

  // === [新增] 跨页连接符 ===
  'OffPageConnector':  ['Instrument', 'Connector', 'OffPageConnector'],

  // 默认
  'default':           ['Equipment', 'Other']
};

// ============================================================
// 图纸管理 API (新增)
// ============================================================

// 1. 获取图纸列表
export const fetchDrawingsList = async () => {
  const session = driver.session();
  try {
    // === 核心修改：自动发现旧图纸并注册 (优化版) ===
    // 逻辑：
    // 1. 找到所有 Asset 上的 drawingId
    // 2. 使用 MERGE 确保每个 drawingId 只对应一个 Drawing 节点
    // 3. 仅当 Drawing 节点是新创建时 (ON CREATE)，才设置名称和时间
    await session.run(`
      MATCH (n:Asset)
      WHERE n.drawingId IS NOT NULL
      MERGE (d:Drawing {id: n.drawingId})
      ON CREATE SET 
        d.name = CASE WHEN n.drawingId = 'Draft_V1' THEN '默认草稿 (V1)' ELSE 'Recovered-' + n.drawingId END,
        d.createdAt = datetime()
    `);

    // === 新增：清理重复的 Drawing 节点 (防御性编程) ===
    // 如果数据库中已经存在多个 id 相同的 Drawing 节点（虽然 MERGE 应该防止这种情况，但为了保险起见）
    // 我们保留创建时间最早的那个，删除其他的
    /* 
       注意：正常情况下 MERGE {id: ...} 会保证唯一性。
       出现重复可能是因为之前手动创建过没有 id 约束的节点，或者逻辑有误。
       下面的语句会清理掉 id 相同但节点 ID 不同的重复项。
    */
    await session.run(`
      MATCH (d:Drawing)
      WITH d.id as id, collect(d) as nodes
      WHERE size(nodes) > 1
      // 保留第一个，删除其余的
      FOREACH (n IN tail(nodes) | DETACH DELETE n)
    `);

    // 然后再查询列表
    const result = await session.run(
      `MATCH (d:Drawing) RETURN d.id as id, d.name as name ORDER BY d.createdAt`
    );
    return result.records.map(r => ({
      id: r.get('id'),
      name: r.get('name')
    }));
  } finally {
    await session.close();
  }
};

// 2. 创建新图纸
export const createDrawing = async (name: string) => {
  const session = driver.session();
  const id = crypto.randomUUID();
  try {
    await session.run(
      `CREATE (d:Drawing {id: $id, name: $name, createdAt: datetime()}) RETURN d`,
      { id, name }
    );
    return { id, name };
  } finally {
    await session.close();
  }
};

// 3. 删除图纸
export const deleteDrawing = async (drawingId: string) => {
  const session = driver.session();
  try {
    await session.run(
      `MATCH (d:Drawing {id: $drawingId})
       OPTIONAL MATCH (a:Asset {drawingId: $drawingId})
       DETACH DELETE d, a`,
      { drawingId }
    );
  } finally {
    await session.close();
  }
};

// ============================================================
// [在此处插入] 重命名图纸函数
// ============================================================
export const renameDrawing = async (id: string, newName: string) => {
  const session = driver.session();
  try {
    await session.run(
      `MATCH (d:Drawing {id: $id}) SET d.name = $newName, d.updatedAt = datetime()`,
      { id, newName }
    );
  } finally {
    await session.close();
  }
};
// ============================================================

// ============================================================
// 图谱保存与加载 (重构)
// ============================================================

export const saveGraphData = async (drawingId: string, nodes: any[], edges: any[]) => {
  const session = driver.session();
  const tx = session.beginTransaction();
  try {
    // 1. 确保 Drawing 节点存在并更新时间
    await tx.run(
      `MERGE (d:Drawing {id: $drawingId}) 
       SET d.updatedAt = datetime()`,
      { drawingId }
    );

    // 2. 删除当前图纸下的旧数据
    await tx.run(
      `MATCH (n:Asset {drawingId: $drawingId}) DETACH DELETE n`,
      { drawingId }
    );

    // 3. 保存节点
    if (nodes.length) {
      const groups: Record<string, any[]> = {};
      
      nodes.forEach(node => {
        const type = node.type || 'Unknown';
        const labels = TYPE_MAPPING[type] || TYPE_MAPPING['default'];
        const groupKey = labels.join(':');
        if (!groups[groupKey]) groups[groupKey] = [];
        groups[groupKey].push(node);
      });

      for (const [labelString, batch] of Object.entries(groups)) {
        const labels = `:Asset:${labelString}`; 
        await tx.run(
          `UNWIND $batch AS n 
           CREATE (e${labels} {x6Id: n.x6Id, drawingId: $drawingId}) 
           SET e += n`, 
          { batch, drawingId }
        );
      }
    }

    // 4. 保存连线
    if (edges.length) {
      const pipes = edges.filter(e => e.type !== 'Signal');
      const signals = edges.filter(e => e.type === 'Signal');

      if (pipes.length) {
        await tx.run(
          `UNWIND $pipes AS r 
           MATCH (s:Asset {x6Id: r.source, drawingId: $drawingId}), (t:Asset {x6Id: r.target, drawingId: $drawingId}) 
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
          { pipes, drawingId }
        );
      }

      if (signals.length) {
        const controlSignals = signals.filter((s: any) => s.targetPort === 'actuator' || s.relationType === 'CONTROLS');
        const measureSignals = signals.filter((s: any) => s.targetPort !== 'actuator' && s.relationType !== 'CONTROLS');

        if (controlSignals.length) {
          await tx.run(
            `UNWIND $batch AS r 
             MATCH (s:Asset {x6Id: r.source, drawingId: $drawingId}), (t:Asset {x6Id: r.target, drawingId: $drawingId}) 
             CREATE (s)-[:CONTROLS {
               fromPort:   r.sourcePort, 
               toPort:     r.targetPort,
               fluid:      'Signal',
               vertices:   r.vertices 
             }]->(t)`, 
            { batch: controlSignals, drawingId }
          );
        }

        if (measureSignals.length) {
          await tx.run(
            `UNWIND $batch AS r 
             MATCH (inst:Asset {x6Id: r.target, drawingId: $drawingId}), (tp:Asset {x6Id: r.source, drawingId: $drawingId}) 
             CREATE (inst)-[:MEASURES {
               fromPort:   r.targetPort,
               toPort:     r.sourcePort,
               fluid:      'Signal',
               vertices:   r.vertices
             }]->(tp)`, 
            { batch: measureSignals, drawingId }
          );
        }
      }
    }

    // 5. 自动建立跨页连接 (Auto-Link Off-Page Connectors)
    await tx.run(`
      MATCH (a:OffPageConnector {drawingId: $drawingId})
      WHERE a.Tag IS NOT NULL AND a.Tag <> ''
      
      MATCH (b:OffPageConnector)
      WHERE b.Tag = a.Tag 
        AND b.drawingId <> $drawingId
      
      // 建立关系 (使用 MERGE 避免重复创建)
      MERGE (a)-[:LINKS_TO]-(b)
    `, { drawingId });

    await tx.commit();
  } catch (e) {
    await tx.rollback();
    throw e;
  } finally {
    await session.close();
  }
};

export const loadGraphData = async (drawingId: string) => {
  const session = driver.session();
  try {
    // 1. 加载节点
    const nodesResult = await session.run(
      `MATCH (n:Asset {drawingId: $drawingId}) RETURN n`,
      { drawingId }
    );
    
    const nodes = nodesResult.records.map(record => {
      const props = record.get('n').properties;
      
      // 解析 layout JSON
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

      if (props.Tag) { props.tag = props.Tag; }
      const isTee = props.type === 'Fitting';
      if (isTee) { props.tag = 'TEE'; props.Tag = 'TEE'; }

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
          // [新增] OPC 映射
          case 'OffPageConnector': shapeName = 'p-opc'; break;
          default: break;
        }
      }

      const { layout: _layoutStr, x, y, width, height, angle, ...businessData } = props;

      return {
        id: props.x6Id,
        shape: shapeName, 
        x: layout.x,
        y: layout.y,
        width: layout.w, 
        height: layout.h,
        angle: layout.a, 
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

    // 2. 加载连线
    const edgesResult = await session.run(`
      MATCH (s:Asset {drawingId: $drawingId})-[r:PIPE|MEASURES|CONTROLS]->(t:Asset {drawingId: $drawingId}) 
      RETURN s.x6Id as sourceId, t.x6Id as targetId, r, type(r) as relType
    `, { drawingId });
    
    const edges = edgesResult.records.map(record => {
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