import neo4j from 'neo4j-driver';

const FLUID_COLORS: Record<string, string> = {
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
};

// ==================== [新增] 在线元件类型列表 ====================
const INLINE_TYPES = ['ControlValve', 'Valve', 'Fitting', 'TappingPoint'];

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
        const controlSignals = signals.filter((s: any) => s.targetPort === 'actuator' || s.relationType === 'CONTROLS');
        const measureSignals = signals.filter((s: any) => s.targetPort !== 'actuator' && s.relationType !== 'CONTROLS');

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

        if (measureSignals.length) {
          await tx.run(
            `UNWIND $batch AS r 
             MATCH (inst:Equipment {x6Id: r.target}), (tp:Equipment {x6Id: r.source}) 
             CREATE (inst)-[:MEASURES {
               fromPort:   r.targetPort,
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
      let strokeColor = FLUID_COLORS[rel.fluid] || '#5F95FF';
      let dashArray = null;
      let targetMarker: any = null; 
      let edgeType = 'Pipe'; 
      let labels: any[] = [];

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

      // ==================== [新增] 动态计算路由排除列表 ====================
      let routerConfig = undefined;

      if (edgeType === 'Pipe') {
        const excludeNodes = ['SHEET_FRAME_A2']; 

        const sourceNode = nodes.find(n => n.id === finalSourceId);
        const targetNode = nodes.find(n => n.id === finalTargetId);

        if (sourceNode && INLINE_TYPES.includes(sourceNode.data.type)) {
          excludeNodes.push(finalSourceId);
        }

        if (targetNode && INLINE_TYPES.includes(targetNode.data.type)) {
          excludeNodes.push(finalTargetId);
        }

        routerConfig = {
          name: 'manhattan',
          args: {
            padding: 20,
            excludeNodes: excludeNodes
          }
        };
      }
      // =================================================================

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
        // ==================== [关键修复] 注入 router 配置 ====================
        router: routerConfig, 
        // ===================================================================
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