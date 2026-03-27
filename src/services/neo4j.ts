// src/services/neo4j.ts
import neo4j from 'neo4j-driver';
import { FLUID_COLORS } from '../config/rules';
import type { SemanticIR } from '../domain/ir';
import { fromNeo4jDomainSnapshot, toNeo4jWritePlans, type Neo4jWriteOptions } from '../domain/adapters/neo4j';
import { compareSemanticIRRoundTrip, type RoundTripReport } from '../domain/roundTrip';
import { CURRENT_IR_VERSION, CURRENT_SCHEMA_VERSION, migrateSemanticIR } from '../domain/migrations';

const uri = import.meta.env.VITE_NEO4J_URI || 'bolt://localhost:7687';
const user = import.meta.env.VITE_NEO4J_USER || 'neo4j';
const password = import.meta.env.VITE_NEO4J_PASSWORD || '';

const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));

export default driver;

let ensureDomainSchemaPromise: Promise<void> | null = null;

const ensureDomainSchema = async () => {
  if (ensureDomainSchemaPromise) {
    await ensureDomainSchemaPromise;
    return;
  }

  ensureDomainSchemaPromise = (async () => {
    const session = driver.session();
    try {
      const statements = [
        'CREATE INDEX domain_drawing_by_id IF NOT EXISTS FOR (d:DomainDrawing) ON (d.id)',
        'CREATE INDEX domain_entity_by_drawing IF NOT EXISTS FOR (e:DomainEntity) ON (e.drawingId)',
        'CREATE INDEX domain_entity_lookup IF NOT EXISTS FOR (e:DomainEntity) ON (e.drawingId, e.kind, e.entityId)',
      ];
      for (const cypher of statements) {
        try {
          await session.run(cypher);
        } catch (error) {
          console.warn('[DomainIR] create index skipped:', cypher, error);
        }
      }
    } finally {
      await session.close();
    }
  })();

  await ensureDomainSchemaPromise;
};

type JsonObject = Record<string, unknown>;
type GraphNodePayload = JsonObject & { x6Id?: string; type?: string };
type GraphEdgePayload = JsonObject & { type?: string; targetPort?: string; relationType?: string };

// 类型映射表 (保持不变)
const TYPE_MAPPING: Record<string, string[]> = {
  'Reactor':           ['Equipment', 'Reactor'],
  'FixedBedReactor':   ['Equipment', 'Reactor'],
  'Exchanger':         ['Equipment', 'Exchanger'],
  'VerticalExchanger': ['Equipment', 'Exchanger'],
  'Evaporator':        ['Equipment', 'Exchanger'],
  'GasCooler':         ['Equipment', 'Exchanger'],
  'Pump':              ['Equipment', 'Pump'],
  'LiquidPump':        ['Equipment', 'Pump'],
  'CentrifugalPump':   ['Equipment', 'Pump'],
  'DiaphragmPump':     ['Equipment', 'Pump'],
  'PistonPump':        ['Equipment', 'Pump'],
  'GearPump':          ['Equipment', 'Pump'],
  'JetPump':           ['Equipment', 'Pump'],
  'Compressor':        ['Equipment', 'Pump', 'Compressor'],
  'Fan':               ['Equipment', 'Pump', 'Fan'],
  'Valve':             ['Equipment', 'Valve'],
  'ControlValve':      ['Equipment', 'Valve', 'ControlValve'],
  'Tank':              ['Equipment', 'Vessel', 'Storage'],
  'Separator':         ['Equipment', 'Vessel', 'Separator'], 
  'Fitting':           ['Equipment', 'Fitting'],
  'Instrument':        ['Instrument'],
  'TappingPoint':      ['Instrument', 'Connection'],
  'SafetyValve':       ['Equipment', 'Valve', 'SafetyDevice'],
  'RuptureDisc':       ['Equipment', 'SafetyDevice', 'Fitting'],
  'BreatherValve':     ['Equipment', 'Valve', 'SafetyDevice'],
  'Trap':              ['Equipment', 'Valve', 'Trap'],
  'Filter':            ['Equipment', 'Fitting', 'Filter'],
  'FlameArrester':     ['Equipment', 'SafetyDevice', 'Fitting'],
  'SightGlass':        ['Equipment', 'Fitting', 'Indicator'],
  'Silencer':          ['Equipment', 'Fitting'],
  'OffPageConnector':  ['Instrument', 'Connector', 'OffPageConnector'],
  'default':           ['Equipment', 'Other']
};

// ... fetchDrawingsList, createDrawing, deleteDrawing, renameDrawing 保持不变 ...
export const fetchDrawingsList = async () => {
  const session = driver.session();
  try {
    await session.run(`
      MATCH (n:Asset)
      WHERE n.drawingId IS NOT NULL
      MERGE (d:Drawing {id: n.drawingId})
      ON CREATE SET 
        d.name = CASE WHEN n.drawingId = 'Draft_V1' THEN '默认草稿 (V1)' ELSE 'Recovered-' + n.drawingId END,
        d.createdAt = datetime()
    `);
    await session.run(`
      MATCH (d:Drawing)
      WITH d.id as id, collect(d) as nodes
      WHERE size(nodes) > 1
      FOREACH (n IN tail(nodes) | DETACH DELETE n)
    `);
    const result = await session.run(
      `MATCH (d:Drawing) RETURN d.id as id, d.name as name ORDER BY d.createdAt`
    );
    return result.records.map(r => ({ id: r.get('id'), name: r.get('name') }));
  } finally { await session.close(); }
};

export const createDrawing = async (name: string) => {
  const session = driver.session();
  const id = crypto.randomUUID();
  try {
    await session.run(`CREATE (d:Drawing {id: $id, name: $name, createdAt: datetime()}) RETURN d`, { id, name });
    return { id, name };
  } finally { await session.close(); }
};

export const deleteDrawing = async (drawingId: string) => {
  const session = driver.session();
  try {
    await session.run(`MATCH (d:Drawing {id: $drawingId}) OPTIONAL MATCH (a:Asset {drawingId: $drawingId}) DETACH DELETE d, a`, { drawingId });
  } finally { await session.close(); }
};

export const renameDrawing = async (id: string, newName: string) => {
  const session = driver.session();
  try {
    await session.run(`MATCH (d:Drawing {id: $id}) SET d.name = $newName, d.updatedAt = datetime()`, { id, newName });
  } finally { await session.close(); }
};

// ============================================================
// 图谱保存与加载 (重构)
// ============================================================

export const saveGraphData = async (drawingId: string, nodes: GraphNodePayload[], edges: GraphEdgePayload[]) => {
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
      const groups: Record<string, GraphNodePayload[]> = {};
      
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
             fromPort:    r.sourcePort, 
             toPort:      r.targetPort,
             // [核心修改] 新增语义属性
             fromChamber: coalesce(r.fromChamber, split(coalesce(r.sourceRegion, ''), ':')[0], ''),
             fromPhase:   coalesce(r.fromPhase, split(coalesce(r.sourceRegion, ''), ':')[1], ''),
             toChamber:   coalesce(r.toChamber, split(coalesce(r.targetRegion, ''), ':')[0], ''),
             toPhase:     coalesce(r.toPhase, split(coalesce(r.targetRegion, ''), ':')[1], ''),
             sourceRegion: r.sourceRegion,
             sourceDesc:   r.sourceDesc,
             targetRegion: r.targetRegion,
             targetDesc:   r.targetDesc,
             // ... 其他属性
             tag:        r.label,
             material:   r.material,
             fluid:      r.fluid,
             dn:         r.dn,
             pn:         r.pn,
             dnSpecJson: r.dnSpecJson,
             pnSpecJson: r.pnSpecJson,
             insulation: r.insulation,
             desc:       r.desc,
             vertices:   r.vertices
           }]->(t)`, 
          { pipes, drawingId }
        );
      }

      if (signals.length) {
        const controlSignals = signals.filter((s) => s.targetPort === 'actuator' || s.relationType === 'CONTROLS');
        const measureSignals = signals.filter((s) => s.targetPort !== 'actuator' && s.relationType !== 'CONTROLS');

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

    // 5. 自动建立有向跨页连接
    await tx.run(`
      MATCH (curr:OffPageConnector {drawingId: $drawingId})
      WHERE curr.Tag IS NOT NULL AND curr.Tag <> ''
      MATCH ()-[:PIPE {toPort: 'in'}]->(curr)
      MATCH (remote:OffPageConnector)
      WHERE remote.Tag = curr.Tag AND remote.drawingId <> $drawingId
      MERGE (curr)-[:LINKS_TO]->(remote)
    `, { drawingId });

    await tx.run(`
      MATCH (curr:OffPageConnector {drawingId: $drawingId})
      WHERE curr.Tag IS NOT NULL AND curr.Tag <> ''
      MATCH (curr)-[:PIPE {fromPort: 'out'}]->()
      MATCH (remote:OffPageConnector)
      WHERE remote.Tag = curr.Tag AND remote.drawingId <> $drawingId
      MERGE (remote)-[:LINKS_TO]->(curr)
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
    const nodesResult = await session.run(
      `MATCH (n:Asset {drawingId: $drawingId}) RETURN n`,
      { drawingId }
    );
    
    const nodes = nodesResult.records.map(record => {
      const props = record.get('n').properties;
      let layout: JsonObject = { x: 0, y: 0, w: 40, h: 40, a: 0, s: ''  };
      if (props.layout) {
        try { layout = JSON.parse(props.layout); } catch { console.warn('Layout parse failed', props.x6Id); }
      } else {
        layout = { x: props.x || 0, y: props.y || 0, w: props.width || 40, h: props.height || 40, a: props.angle || 0, s: props.shape || '' };
      }

      if (props.Tag) { props.tag = props.Tag; }
      const isTee = props.type === 'Fitting';
      if (isTee) { props.tag = 'TEE'; props.Tag = 'TEE'; }

      let shapeName = layout.s || props.shape; 
      if (!shapeName) {
        // 简单的回退逻辑，实际应依赖 layout.s
        shapeName = 'p-valve'; 
      }

      const { layout: _layoutStr, x, y, width, height, angle, ...businessData } = props;
      void _layoutStr;
      void x;
      void y;
      void width;
      void height;
      void angle;

      return {
        id: props.x6Id,
        shape: shapeName, 
        x: layout.x, y: layout.y, width: layout.w, height: layout.h, angle: layout.a, 
        data: { ...businessData }, 
        attrs: { 
          label: { text: isTee ? '' : (props.Tag || props.tag || props.label), display: isTee ? 'none' : undefined },
          topLabel: props.tagId ? { text: props.tagId } : undefined,
          bottomLabel: props.loopNum ? { text: props.loopNum } : undefined,
        }
      };
    });

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
        let targetMarker: JsonObject | null = null; 
        let edgeType = 'Pipe'; 
        const labels: JsonObject[] = [];
        let vertices: JsonObject[] = [];
        
        if (rel.vertices) { try { vertices = JSON.parse(rel.vertices) as JsonObject[]; } catch { /* ignore */ } }

        if (relType === 'MEASURES' || relType === 'CONTROLS') {
            strokeWidth = 1; strokeColor = FLUID_COLORS.Signal; dashArray = '4 4'; targetMarker = { name: 'classic', width: 10, height: 6 }; edgeType = 'Signal';
        } else {
            targetMarker = { name: 'classic', width: 8, height: 6 }; 
            if (rel.insulation && rel.insulation.startsWith('Jacket')) { strokeWidth = 4; strokeColor = FLUID_COLORS.Oil; } 
            else if (['ST', 'ET', 'OT'].includes(rel.insulation)) { dashArray = '5 5'; }
        }

        if (relType === 'PIPE' && rel.tag) {
            labels.push({
            attrs: { label: { text: rel.tag }, body: { fill: '#fff', stroke: '#333' } },
            position: { distance: 0.5, args: { y: -10 }, options: { keepGradient: true, ensureLegibility: true } } 
            });
        }

        let finalSourceId = sourceId;
        let finalTargetId = targetId;
        let finalSourcePort = rel.fromPort;
        let finalTargetPort = rel.toPort;

        if (relType === 'MEASURES') {
            finalSourceId = targetId; finalTargetId = sourceId; finalSourcePort = rel.toPort; finalTargetPort = rel.fromPort; 
        }

        let dnSpec: JsonObject | undefined;
        let pnSpec: JsonObject | undefined;
        if (rel.dnSpecJson) { try { dnSpec = JSON.parse(rel.dnSpecJson); } catch { /* ignore */ } }
        if (rel.pnSpecJson) { try { pnSpec = JSON.parse(rel.pnSpecJson); } catch { /* ignore */ } }

        return {
            shape: edgeType === 'Signal' ? 'signal-edge' : 'edge',
            source: { cell: finalSourceId, port: finalSourcePort || undefined },
            target: { cell: finalTargetId, port: finalTargetPort || undefined },
            vertices: vertices, 
            attrs: { line: { stroke: strokeColor, strokeWidth: strokeWidth, strokeDasharray: dashArray, targetMarker: targetMarker } },
            labels: labels,
            data: { 
              type: edgeType,
              relationType: relType,
              material: rel.material,
              fluid: rel.fluid,
              dn: rel.dn,
              pn: rel.pn,
              dnSpec: dnSpec,
              pnSpec: pnSpec,
              insulation: rel.insulation,
              desc: rel.desc
            }
        };
    });

    return { nodes, edges };
  } finally { await session.close(); }
};

// ============================================================
// Domain IR 并行持久化入口 (不替换现有 saveGraphData/loadGraphData)
// ============================================================

export interface SaveDomainIROptions {
  mode?: 'replace' | 'merge';
  expectedUpdatedAt?: string;
  irVersion?: string;
  schemaVersion?: string;
}

export interface SaveDomainIRResult {
  updatedAt?: string;
}

export const saveDomainIR = async (ir: SemanticIR, options?: SaveDomainIROptions): Promise<SaveDomainIRResult> => {
  const normalized = migrateSemanticIR(ir);
  await ensureDomainSchema();
  const session = driver.session();
  const tx = session.beginTransaction();
  try {
    if (options?.expectedUpdatedAt) {
      const lockRes = await tx.run(
        `MATCH (d:DomainDrawing {id: $drawingId}) RETURN toString(d.updatedAt) as updatedAt LIMIT 1`,
        { drawingId: normalized.model.drawing.id },
      );
      const currentUpdatedAt = lockRes.records[0]?.get('updatedAt');
      const current = typeof currentUpdatedAt === 'string' ? currentUpdatedAt : '';
      if (current !== options.expectedUpdatedAt) {
        throw new Error(`DOMAIN_IR_WRITE_CONFLICT: expected ${options.expectedUpdatedAt}, got ${current || '<empty>'}`);
      }
    }

    const writeOptions: Neo4jWriteOptions = {
      mode: options?.mode || 'replace',
      irVersion: options?.irVersion || normalized.meta.version || CURRENT_IR_VERSION,
      schemaVersion: options?.schemaVersion || String(normalized.model.drawing.metadata?.schemaVersion || CURRENT_SCHEMA_VERSION),
    };
    const plans = toNeo4jWritePlans(normalized, writeOptions);
    for (const plan of plans) {
      await tx.run(plan.cypher, plan.params);
    }
    const updatedRes = await tx.run(
      `MATCH (d:DomainDrawing {id: $drawingId}) RETURN toString(d.updatedAt) as updatedAt LIMIT 1`,
      { drawingId: normalized.model.drawing.id },
    );
    await tx.commit();
    return {
      updatedAt: typeof updatedRes.records[0]?.get('updatedAt') === 'string'
        ? String(updatedRes.records[0]?.get('updatedAt'))
        : undefined,
    };
  } catch (error) {
    await tx.rollback();
    throw error;
  } finally {
    await session.close();
  }
};

export const saveDomainIRWithRoundTripCheck = async (ir: SemanticIR, options?: SaveDomainIROptions): Promise<RoundTripReport> => {
  await saveDomainIR(ir, options);
  const loaded = await loadDomainIR(ir.model.drawing.id);
  if (!loaded) {
    return {
      ok: false,
      issues: [
        {
          level: 'error',
          code: 'ROUNDTRIP_LOAD_EMPTY',
          message: `Round-trip load returned empty for drawing ${ir.model.drawing.id}`,
          entityId: ir.model.drawing.id,
        },
      ],
    };
  }
  return compareSemanticIRRoundTrip(ir, loaded);
};

export const loadDomainIR = async (drawingId: string): Promise<SemanticIR | null> => {
  await ensureDomainSchema();
  const session = driver.session();
  try {
    const drawingRes = await session.run(
      `MATCH (d:DomainDrawing {id: $drawingId}) RETURN d LIMIT 1`,
      { drawingId }
    );
    if (drawingRes.records.length === 0) return null;

    const drawingNode = drawingRes.records[0].get('d').properties as Record<string, unknown>;

    const entityRes = await session.run(
      `MATCH (d:DomainDrawing {id: $drawingId})-[:HAS_DOMAIN_ENTITY]->(e:DomainEntity)
       WHERE NOT e:DomainRelation
       RETURN e.kind as kind, e.entityId as entityId, e.payloadJson as payloadJson`,
      { drawingId }
    );

    const relationRes = await session.run(
      `MATCH (d:DomainDrawing {id: $drawingId})-[:HAS_DOMAIN_ENTITY]->(r:DomainEntity:DomainRelation)-[:REL_SOURCE]->(s:DomainEntity)
       MATCH (r)-[:REL_TARGET]->(t:DomainEntity)
       RETURN r.entityId as id, r.relType as relType, r.payloadJson as payloadJson,
              s.kind as sourceKind, s.entityId as sourceId,
              t.kind as targetKind, t.entityId as targetId`,
      { drawingId }
    );

    const ir = fromNeo4jDomainSnapshot({
      drawingId,
      drawingName: typeof drawingNode.name === 'string' ? drawingNode.name : drawingId,
      drawingPayloadJson: typeof drawingNode.payloadJson === 'string' ? drawingNode.payloadJson : undefined,
      entities: entityRes.records.map((r) => ({
        kind: String(r.get('kind')) as 'equipment' | 'zone' | 'port' | 'pipe' | 'instrument',
        entityId: String(r.get('entityId')),
        payloadJson: typeof r.get('payloadJson') === 'string' ? r.get('payloadJson') : undefined,
      })),
      relations: relationRes.records.map((r) => ({
        id: String(r.get('id')),
        relType: String(r.get('relType')),
        sourceKind: String(r.get('sourceKind')) as 'equipment' | 'zone' | 'port' | 'pipe' | 'instrument',
        sourceId: String(r.get('sourceId')),
        targetKind: String(r.get('targetKind')) as 'equipment' | 'zone' | 'port' | 'pipe' | 'instrument',
        targetId: String(r.get('targetId')),
        payloadJson: typeof r.get('payloadJson') === 'string' ? r.get('payloadJson') : undefined,
      })),
    });
    ir.meta.version = CURRENT_IR_VERSION;
    return migrateSemanticIR(ir);
  } finally {
    await session.close();
  }
};
