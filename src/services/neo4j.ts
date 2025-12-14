// src/services/neo4j.ts
import neo4j from 'neo4j-driver';
import { FLUID_COLORS, CURRENT_DRAWING_ID } from '../config/rules';

const driver = neo4j.driver(
  'bolt://localhost:7687', 
  neo4j.auth.basic('neo4j', 'CGrx2526'), 
  { encrypted: 'ENCRYPTION_OFF', disableLosslessIntegers: true }
);

export const saveGraphData = async (nodes: any[], edges: any[]) => {
  const session = driver.session();
  const tx = session.beginTransaction();
  try {
    // 1. [安全修复] 仅删除当前图纸的数据
    await tx.run(
      `MATCH (n:Equipment {drawingId: $drawingId}) DETACH DELETE n`,
      { drawingId: CURRENT_DRAWING_ID }
    );

    // 2. 保存节点 (注入 drawingId)
    if (nodes.length) {
      await tx.run(
        `UNWIND $nodes AS n 
         CREATE (e:Equipment {x6Id: n.x6Id, drawingId: $drawingId}) 
         SET e += n`, 
        { nodes, drawingId: CURRENT_DRAWING_ID }
      );
    }

    // 3. 保存连线
    if (edges.length) {
      const pipes = edges.filter(e => e.type !== 'Signal');
      const signals = edges.filter(e => e.type === 'Signal');

      // 3.1 保存工艺管线
      if (pipes.length) {
        await tx.run(
          `UNWIND $pipes AS r 
           MATCH (s:Equipment {x6Id: r.source}), (t:Equipment {x6Id: r.target}) 
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

      // 3.2 保存信号线 (逻辑保持不变)
      if (signals.length) {
        const controlSignals = signals.filter((s: any) => s.targetPort === 'actuator' || s.relationType === 'CONTROLS');
        const measureSignals = signals.filter((s: any) => s.targetPort !== 'actuator' && s.relationType !== 'CONTROLS');

        if (controlSignals.length) {
          await tx.run(
            `UNWIND $batch AS r 
             MATCH (s:Equipment {x6Id: r.source}), (t:Equipment {x6Id: r.target}) 
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
             MATCH (inst:Equipment {x6Id: r.target}), (tp:Equipment {x6Id: r.source}) 
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
    // 1. 加载节点 (增加 drawingId 过滤)
    const nodesResult = await session.run(
      `MATCH (n:Equipment {drawingId: $drawingId}) RETURN n`,
      { drawingId: CURRENT_DRAWING_ID }
    );
    
    const nodes = nodesResult.records.map(record => {
      const props = record.get('n').properties;
      
      // ... (Shape 映射逻辑保持不变，此处省略以节省篇幅) ...
      let shapeName = 'p-valve'; 
      switch (props.type) {
        case 'Reactor':      shapeName = 'p-reactor'; break;
        case 'Exchanger':    shapeName = 'p-exchanger'; break;
        case 'Pump':         shapeName = 'p-pump'; break;
        case 'LiquidPump':   shapeName = 'p-pump-liquid'; break;
        case 'CentrifugalPump': shapeName = 'p-pump-centrifugal'; break;
        case 'DiaphragmPump': shapeName = 'p-pump-diaphragm'; break;
        case 'PistonPump':   shapeName = 'p-pump-piston'; break;
        case 'Compressor':   shapeName = 'p-pump-compressor'; break;
        case 'GearPump':     shapeName = 'p-pump-gear'; break;
        case 'Fan':          shapeName = 'p-pump-fan'; break;
        case 'JetPump':      shapeName = 'p-pump-jet'; break;
        case 'ControlValve': shapeName = 'p-cv-pneumatic'; break;
        case 'Valve':        shapeName = 'p-cv-manual'; break;
        case 'Fitting':      shapeName = 'p-tee'; break; 
        case 'Tank':         shapeName = 'p-tank-horizontal'; break;
        case 'GasCooler':    shapeName = 'p-gas-cooler'; break;
        case 'Trap':         shapeName = 'p-trap'; break;
        case 'FixedBedReactor': shapeName = 'p-fixed-bed-reactor'; break;
        case 'VerticalExchanger': shapeName = 'p-exchanger-vertical'; break;
        case 'Evaporator':   shapeName = 'p-naphthalene-evaporator'; break;
        case 'Instrument':   
          if(props.spec === 'Local') shapeName = 'p-inst-local';
          else if(props.spec === 'Panel') shapeName = 'p-inst-panel';
          else shapeName = 'p-inst-remote';
          break;
        case 'TappingPoint': shapeName = 'tapping-point'; break;
        default: break;
      }

      const safeNumber = (val: any) => {
        if (typeof val === 'number') return val;
        if (val && val.low !== undefined) return val.low; 
        if (val && !isNaN(Number(val))) return Number(val); 
        return undefined; 
      };

      return {
        id: props.x6Id,
        shape: shapeName, 
        x: props.x,
        y: props.y,
        width: safeNumber(props.width), 
        height: safeNumber(props.height),
        angle: safeNumber(props.angle) || 0,
        data: { ...props },
        attrs: { 
          label: { text: props.Tag || props.label },
          topLabel: props.tagId ? { text: props.tagId } : undefined,
          bottomLabel: props.loopNum ? { text: props.loopNum } : undefined,
        }
      };
    });

    // 2. 加载连线
    const edgesResult = await session.run(`
      MATCH (s:Equipment {drawingId: $drawingId})-[r:PIPE|MEASURES|CONTROLS]->(t:Equipment {drawingId: $drawingId}) 
      RETURN s.x6Id as sourceId, t.x6Id as targetId, r, type(r) as relType
    `, { drawingId: CURRENT_DRAWING_ID });
    
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
          strokeColor = FLUID_COLORS.Oil; // 默认夹套颜色
        } else if (['ST', 'ET', 'OT'].includes(rel.insulation)) {
          dashArray = '5 5'; 
        }
      }

      if (relType === 'PIPE' && rel.tag) {
        labels.push({
          attrs: { label: { text: rel.tag }, body: { fill: '#fff', stroke: '#333' } },
          position: { distance: 0.5, args: { y: -15 } } 
        });
      }

      // 处理 MEASURES 的反向关系
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

      // [架构修复] 移除后端的 router 计算逻辑
      // 路由配置现在完全由前端根据节点类型动态生成

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