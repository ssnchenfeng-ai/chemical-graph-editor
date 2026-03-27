import type { SemanticIR } from '../ir';
import type { DomainModel, Drawing, Equipment, Instrument, Pipe, Port, Zone } from '../model';
import type { DomainRelation, RelationEndpointKind, RelationType } from '../relations';

export interface Neo4jWritePlan {
  cypher: string;
  params: Record<string, unknown>;
}

// NOTE: First-step contract only. Existing persistence can progressively adopt this plan.
export interface Neo4jAdapter {
  toWritePlans(ir: SemanticIR): Neo4jWritePlan[];
  fromQueryResult(input: unknown): SemanticIR;
}

export interface Neo4jWriteOptions {
  mode?: 'replace' | 'merge';
  irVersion?: string;
  schemaVersion?: string;
}

type EntityKind = 'equipment' | 'zone' | 'port' | 'pipe' | 'instrument';

export interface Neo4jDomainEntityRow {
  kind: EntityKind;
  entityId: string;
  payloadJson?: string;
}

export interface Neo4jDomainRelationRow {
  id: string;
  relType: string;
  sourceKind: RelationEndpointKind;
  sourceId: string;
  targetKind: RelationEndpointKind;
  targetId: string;
  payloadJson?: string;
}

export interface Neo4jDomainSnapshot {
  drawingId: string;
  drawingName?: string;
  drawingPayloadJson?: string;
  entities: Neo4jDomainEntityRow[];
  relations: Neo4jDomainRelationRow[];
}

const stringifyPayload = (payload: unknown) => JSON.stringify(payload ?? {});

const parsePayload = <T>(raw: string | undefined, fallback: T): T => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

export const toNeo4jWritePlans = (ir: SemanticIR, options?: Neo4jWriteOptions): Neo4jWritePlan[] => {
  const drawingId = ir.model.drawing.id;
  const mode = options?.mode || 'replace';
  const irVersion = options?.irVersion || ir.meta.version || 'ir/0.1';
  const schemaVersion = options?.schemaVersion || String(ir.model.drawing.metadata?.schemaVersion || 'schema/0.1');

  const entities = [
    ...ir.model.equipments.map((e) => ({ kind: 'equipment' as const, entityId: e.id, payloadJson: stringifyPayload(e) })),
    ...ir.model.zones.map((z) => ({ kind: 'zone' as const, entityId: z.id, payloadJson: stringifyPayload(z) })),
    ...ir.model.ports.map((p) => ({ kind: 'port' as const, entityId: p.id, payloadJson: stringifyPayload(p) })),
    ...ir.model.pipes.map((p) => ({ kind: 'pipe' as const, entityId: p.id, payloadJson: stringifyPayload(p) })),
    ...ir.model.instruments.map((i) => ({ kind: 'instrument' as const, entityId: i.id, payloadJson: stringifyPayload(i) })),
  ];

  const relations = ir.model.relations.map((r) => ({
    id: r.id,
    relType: r.type,
    sourceKind: r.source.kind,
    sourceId: r.source.id,
    targetKind: r.target.kind,
    targetId: r.target.id,
    payloadJson: stringifyPayload(r),
  }));

  const entityKeyList = entities.map((e) => `${e.kind}|${e.entityId}`);
  const relationIdList = relations.map((r) => r.id);
  const relationTriples = relations.map((r) => ({
    id: r.id,
    relType: r.relType,
    sourceKind: r.sourceKind,
    sourceId: r.sourceId,
    targetKind: r.targetKind,
    targetId: r.targetId,
    payloadJson: r.payloadJson,
  }));

  if (mode === 'merge') {
    return [
      {
        cypher: `
          MERGE (d:DomainDrawing {id: $drawingId})
          SET d.name = $name,
              d.payloadJson = $drawingPayloadJson,
              d.irVersion = $irVersion,
              d.schemaVersion = $schemaVersion,
              d.updatedAt = datetime()
        `,
        params: {
          drawingId,
          name: ir.model.drawing.name,
          drawingPayloadJson: stringifyPayload(ir.model.drawing),
          irVersion,
          schemaVersion,
        },
      },
      {
        cypher: `
          MATCH (d:DomainDrawing {id: $drawingId})
          UNWIND $entities AS e
          MERGE (n:DomainEntity {drawingId: $drawingId, kind: e.kind, entityId: e.entityId})
          SET n.payloadJson = e.payloadJson
          MERGE (d)-[:HAS_DOMAIN_ENTITY]->(n)
        `,
        params: { drawingId, entities },
      },
      {
        cypher: `
          MATCH (n:DomainEntity {drawingId: $drawingId})
          WHERE NOT n:DomainRelation
            AND NOT (n.kind + '|' + n.entityId) IN $entityKeyList
          DETACH DELETE n
        `,
        params: { drawingId, entityKeyList },
      },
      {
        cypher: `
          MATCH (d:DomainDrawing {id: $drawingId})
          UNWIND $relationTriples AS r
          MERGE (rel:DomainEntity:DomainRelation {drawingId: $drawingId, kind: 'relation', entityId: r.id})
          SET rel.relType = r.relType, rel.payloadJson = r.payloadJson
          MERGE (d)-[:HAS_DOMAIN_ENTITY]->(rel)
          WITH rel, r, $drawingId AS drawingId
          OPTIONAL MATCH (rel)-[oldS:REL_SOURCE]->()
          DELETE oldS
          WITH rel, r, drawingId
          OPTIONAL MATCH (rel)-[oldT:REL_TARGET]->()
          DELETE oldT
          WITH rel, r, drawingId
          MATCH (s:DomainEntity {drawingId: drawingId, kind: r.sourceKind, entityId: r.sourceId})
          MATCH (t:DomainEntity {drawingId: drawingId, kind: r.targetKind, entityId: r.targetId})
          MERGE (rel)-[:REL_SOURCE]->(s)
          MERGE (rel)-[:REL_TARGET]->(t)
        `,
        params: { drawingId, relationTriples },
      },
      {
        cypher: `
          MATCH (rel:DomainEntity:DomainRelation {drawingId: $drawingId})
          WHERE NOT rel.entityId IN $relationIdList
          DETACH DELETE rel
        `,
        params: { drawingId, relationIdList },
      },
    ];
  }

  return [
    {
      cypher: `
        MERGE (d:DomainDrawing {id: $drawingId})
        SET d.name = $name,
            d.payloadJson = $drawingPayloadJson,
            d.irVersion = $irVersion,
            d.schemaVersion = $schemaVersion,
            d.updatedAt = datetime()
      `,
      params: {
        drawingId,
        name: ir.model.drawing.name,
        drawingPayloadJson: stringifyPayload(ir.model.drawing),
        irVersion,
        schemaVersion,
      },
    },
    {
      cypher: `
        MATCH (e:DomainEntity {drawingId: $drawingId})
        DETACH DELETE e
      `,
      params: { drawingId },
    },
    {
      cypher: `
        MATCH (d:DomainDrawing {id: $drawingId})
        UNWIND $entities AS e
        CREATE (n:DomainEntity {drawingId: $drawingId, kind: e.kind, entityId: e.entityId, payloadJson: e.payloadJson})
        MERGE (d)-[:HAS_DOMAIN_ENTITY]->(n)
      `,
      params: { drawingId, entities },
    },
    {
      cypher: `
        MATCH (d:DomainDrawing {id: $drawingId})
        UNWIND $relations AS r
        CREATE (rel:DomainEntity:DomainRelation {drawingId: $drawingId, kind: 'relation', entityId: r.id, relType: r.relType, payloadJson: r.payloadJson})
        WITH d, rel, r
        MATCH (s:DomainEntity {drawingId: $drawingId, kind: r.sourceKind, entityId: r.sourceId})
        MATCH (t:DomainEntity {drawingId: $drawingId, kind: r.targetKind, entityId: r.targetId})
        MERGE (d)-[:HAS_DOMAIN_ENTITY]->(rel)
        MERGE (rel)-[:REL_SOURCE]->(s)
        MERGE (rel)-[:REL_TARGET]->(t)
      `,
      params: { drawingId, relations },
    },
  ];
};

export const fromNeo4jDomainSnapshot = (snapshot: Neo4jDomainSnapshot): SemanticIR => {
  const drawingDefaults: Drawing = {
    id: snapshot.drawingId,
    name: snapshot.drawingName || snapshot.drawingId,
    equipmentIds: [],
    instrumentIds: [],
    pipeIds: [],
    relationIds: [],
  };
  const drawing = parsePayload<Drawing>(snapshot.drawingPayloadJson, drawingDefaults);
  drawing.id = snapshot.drawingId;
  if (!drawing.name) drawing.name = snapshot.drawingName || snapshot.drawingId;

  const equipments: Equipment[] = [];
  const zones: Zone[] = [];
  const ports: Port[] = [];
  const pipes: Pipe[] = [];
  const instruments: Instrument[] = [];

  snapshot.entities.forEach((row) => {
    if (row.kind === 'equipment') {
      equipments.push(parsePayload<Equipment>(row.payloadJson, {
        id: row.entityId,
        type: 'Unknown',
        zoneIds: [],
        portIds: [],
      }));
      return;
    }
    if (row.kind === 'zone') {
      zones.push(parsePayload<Zone>(row.payloadJson, {
        id: row.entityId,
        equipmentId: '',
        role: 'zone',
        portIds: [],
      }));
      return;
    }
    if (row.kind === 'port') {
      ports.push(parsePayload<Port>(row.payloadJson, {
        id: row.entityId,
        ownerKind: 'zone',
        ownerId: '',
        direction: 'bi',
        role: 'process',
      }));
      return;
    }
    if (row.kind === 'pipe') {
      pipes.push(parsePayload<Pipe>(row.payloadJson, {
        id: row.entityId,
        fromPortId: '',
        toPortId: '',
      }));
      return;
    }
    if (row.kind === 'instrument') {
      instruments.push(parsePayload<Instrument>(row.payloadJson, {
        id: row.entityId,
        type: 'Instrument',
      }));
    }
  });

  const relations: DomainRelation[] = snapshot.relations.map((row) => {
    const payload = parsePayload<Partial<DomainRelation>>(row.payloadJson, {});
    return {
      id: row.id,
      type: (row.relType || payload.type || 'CONNECTS_TO') as RelationType,
      source: payload.source || { kind: row.sourceKind, id: row.sourceId },
      target: payload.target || { kind: row.targetKind, id: row.targetId },
      attributes: payload.attributes,
    };
  });

  drawing.equipmentIds = equipments.map((e) => e.id);
  drawing.instrumentIds = instruments.map((i) => i.id);
  drawing.pipeIds = pipes.map((p) => p.id);
  drawing.relationIds = relations.map((r) => r.id);

  const model: DomainModel = {
    drawing,
    equipments,
    zones,
    ports,
    pipes,
    instruments,
    relations,
  };

  return {
    meta: {
      version: 'ir/0.1',
      source: 'neo4j',
      generatedAt: new Date().toISOString(),
    },
    model,
  };
};
