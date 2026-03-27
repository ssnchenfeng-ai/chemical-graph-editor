import type { SemanticIR } from './ir';
import type { RelationEndpointKind } from './relations';

export interface RoundTripIssue {
  level: 'error' | 'warning';
  code: string;
  message: string;
  entityId?: string;
}

export interface RoundTripReport {
  ok: boolean;
  issues: RoundTripIssue[];
}

const compareIdSet = (
  issues: RoundTripIssue[],
  kind: string,
  expected: string[],
  actual: string[],
) => {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);

  expected.forEach((id) => {
    if (!actualSet.has(id)) {
      issues.push({
        level: 'error',
        code: 'ROUNDTRIP_MISSING_ENTITY',
        message: `${kind} missing after round-trip: ${id}`,
        entityId: id,
      });
    }
  });

  actual.forEach((id) => {
    if (!expectedSet.has(id)) {
      issues.push({
        level: 'warning',
        code: 'ROUNDTRIP_EXTRA_ENTITY',
        message: `${kind} extra after round-trip: ${id}`,
        entityId: id,
      });
    }
  });
};

const relationSignature = (item: { type: string; source: { kind: RelationEndpointKind; id: string }; target: { kind: RelationEndpointKind; id: string } }) =>
  `${item.type}|${item.source.kind}:${item.source.id}|${item.target.kind}:${item.target.id}`;

export const compareSemanticIRRoundTrip = (expected: SemanticIR, actual: SemanticIR): RoundTripReport => {
  const issues: RoundTripIssue[] = [];

  if (expected.model.drawing.id !== actual.model.drawing.id) {
    issues.push({
      level: 'error',
      code: 'ROUNDTRIP_DRAWING_ID_MISMATCH',
      message: `Drawing id mismatch: expected ${expected.model.drawing.id}, got ${actual.model.drawing.id}`,
      entityId: expected.model.drawing.id,
    });
  }

  compareIdSet(
    issues,
    'equipment',
    expected.model.equipments.map((e) => e.id),
    actual.model.equipments.map((e) => e.id),
  );
  compareIdSet(
    issues,
    'zone',
    expected.model.zones.map((z) => z.id),
    actual.model.zones.map((z) => z.id),
  );
  compareIdSet(
    issues,
    'port',
    expected.model.ports.map((p) => p.id),
    actual.model.ports.map((p) => p.id),
  );
  compareIdSet(
    issues,
    'pipe',
    expected.model.pipes.map((p) => p.id),
    actual.model.pipes.map((p) => p.id),
  );
  compareIdSet(
    issues,
    'instrument',
    expected.model.instruments.map((i) => i.id),
    actual.model.instruments.map((i) => i.id),
  );

  const expectedRelationMap = new Map(expected.model.relations.map((rel) => [rel.id, relationSignature(rel)]));
  const actualRelationMap = new Map(actual.model.relations.map((rel) => [rel.id, relationSignature(rel)]));
  compareIdSet(
    issues,
    'relation',
    expected.model.relations.map((r) => r.id),
    actual.model.relations.map((r) => r.id),
  );
  expectedRelationMap.forEach((signature, relationId) => {
    const got = actualRelationMap.get(relationId);
    if (got && got !== signature) {
      issues.push({
        level: 'error',
        code: 'ROUNDTRIP_RELATION_SHAPE_MISMATCH',
        message: `Relation changed after round-trip: ${relationId}`,
        entityId: relationId,
      });
    }
  });

  return {
    ok: !issues.some((issue) => issue.level === 'error'),
    issues,
  };
};

