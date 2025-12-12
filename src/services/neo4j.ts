import neo4j from 'neo4j-driver';

const driver = neo4j.driver(
  'bolt://localhost:7687', 
  neo4j.auth.basic('neo4j', 'CGrx2526'), 
  { encrypted: 'ENCRYPTION_OFF', disableLosslessIntegers: true }
);

export const runCypher = async (cypher: string, params = {}) => {
  const session = driver.session();
  try {
    const result = await session.run(cypher, params);
    return result.records;
  } catch (error) {
    console.error('Neo4j Execution Error:', error);
    throw error;
  } finally {
    await session.close();
  }
};

export const saveGraphData = async (nodes: any[], edges: any[]) => {
  const session = driver.session();
  const tx = session.beginTransaction();
  try {
    // 1. 清空旧数据
    await tx.run(`MATCH (n:Equipment) DETACH DELETE n`);

    // 2. 保存节点
    if (nodes.length) {
      await tx.run(
        `UNWIND $nodes AS n 
         CREATE (e:Equipment {x6Id: n.x6Id}) 
         SET e += n`, 
        { nodes }
      );
    }

    // 3. 保存连线
    if (edges.length) {
      const pipes = edges.filter(e => e.type !== 'Signal');
      const signals = edges.filter(e => e.type === 'Signal');

      // 3.1 保存工艺管线 (PIPE)
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
             toDesc:     r.targetDesc
           }]->(t)`, 
          { pipes }
        );
      }

      // 3.2 保存信号线 (Signal)
      if (signals.length) {
        // 区分控制信号和测量信号
        // 控制信号：目标端口是 actuator，或者 Canvas 显式标记为 CONTROLS
        const controlSignals = signals.filter((s: any) => s.targetPort === 'actuator' || s.relationType === 'CONTROLS');
        
        // 测量信号：其余的信号线 (通常是 TappingPoint -> Instrument)
        const measureSignals = signals.filter((s: any) => s.targetPort !== 'actuator' && s.relationType !== 'CONTROLS');

        // A. 保存控制关系 (Instrument -> Valve)
        // 方向一致：X6 (Inst->Valve) === Neo4j (Inst->Valve)
        if (controlSignals.length) {
          await tx.run(
            `UNWIND $batch AS r 
             MATCH (s:Equipment {x6Id: r.source}), (t:Equipment {x6Id: r.target}) 
             CREATE (s)-[:CONTROLS {
               fromPort:   r.sourcePort, 
               toPort:     r.targetPort,
               fromRegion: r.sourceRegion, 
               fromDesc:   r.sourceDesc,
               toRegion:   r.targetRegion,
               toDesc:     r.targetDesc,
               fluid:      'Signal' 
             }]->(t)`, 
            { batch: controlSignals }
          );
        }

        // B. 保存测量关系 (Instrument -> TappingPoint)
        // 方向反转：X6 (TP->Inst) !== Neo4j (Inst->TP)
        // 我们需要让 Instrument(r.target) 指向 TappingPoint(r.source)
        if (measureSignals.length) {
          await tx.run(
            `UNWIND $batch AS r 
             MATCH (inst:Equipment {x6Id: r.target}), (tp:Equipment {x6Id: r.source}) 
             CREATE (inst)-[:MEASURES {
               fromPort:   r.targetPort,  // 端口属性也要反转记录
               toPort:     r.sourcePort,
               fromRegion: r.targetRegion,
               fromDesc:   r.targetDesc,
               toRegion:   r.sourceRegion,
               toDesc:     r.sourceDesc,
               fluid:      'Signal' 
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
    const nodesResult = await session.run(`MATCH (n:Equipment) RETURN n`);
    const nodes = nodesResult.records.map(record => {
      const props = record.get('n').properties;
      
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

      const data = { ...props };
      
      return {
        id: props.x6Id,
        shape: shapeName, 
        x: props.x,
        y: props.y,
        width: safeNumber(props.width), 
        height: safeNumber(props.height),
        angle: safeNumber(props.angle) || 0,
        data: data,
        attrs: { 
          label: { text: props.Tag || props.label },
          topLabel: props.tagId ? { text: props.tagId } : undefined,
          bottomLabel: props.loopNum ? { text: props.loopNum } : undefined,
        }
      };
    });

    // 2. 加载连线
    const edgesResult = await session.run(`
      MATCH (s:Equipment)-[r:PIPE|MEASURES|CONTROLS]->(t:Equipment) 
      RETURN s.x6Id as sourceId, t.x6Id as targetId, r, type(r) as relType
    `);
    
    const edges = edgesResult.records.map(record => {
      const rel = record.get('r').properties;
      const relType = record.get('relType'); 
      const sourceId = record.get('sourceId');
      const targetId = record.get('targetId');
      
      let strokeWidth = 2;
      let strokeColor = '#5F95FF';
      let dashArray = null;
      let targetMarker: any = null; 
      let edgeType = 'Pipe'; 
      let labels: any[] = [];

      // 视觉样式处理
      if (relType === 'MEASURES' || relType === 'CONTROLS') {
        strokeWidth = 1;
        strokeColor = '#888'; 
        dashArray = '4 4';    
        targetMarker = { name: 'classic', width: 10, height: 6 }; 
        edgeType = 'Signal';
      } else {
        targetMarker = { name: 'classic', width: 8, height: 6 }; 
        if (rel.insulation && rel.insulation.startsWith('Jacket')) {
          strokeWidth = 4;
          strokeColor = '#fa8c16'; 
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

      // --- 核心逻辑：处理方向反转 ---
      let finalSourceId = sourceId;
      let finalTargetId = targetId;
      let finalSourcePort = rel.fromPort;
      let finalTargetPort = rel.toPort;

      // 如果是测量关系 (MEASURES)，Neo4j 中是 Inst->TP，但 X6 需要 TP->Inst
      if (relType === 'MEASURES') {
        finalSourceId = targetId; // TappingPoint
        finalTargetId = sourceId; // Instrument
        finalSourcePort = rel.toPort;   // 交换端口
        finalTargetPort = rel.fromPort; // 交换端口
      }

      return {
        shape: edgeType === 'Signal' ? 'signal-edge' : 'edge',
        source: { cell: finalSourceId, port: finalSourcePort || undefined },
        target: { cell: finalTargetId, port: finalTargetPort || undefined },
        
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
          relationType: relType, // 记录关系类型，方便下次保存时识别
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