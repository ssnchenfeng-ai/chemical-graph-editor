import type { DomainModel } from './model';
import { RELATION_TYPES } from './relations';

export interface ValidationIssue {
  level: 'error' | 'warning';
  code: string;
  message: string;
  entityId?: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}

export const validateDomainModel = (model: DomainModel): ValidationResult => {
  const issues: ValidationIssue[] = [];

  const equipmentIds = new Set(model.equipments.map((e) => e.id));
  const zoneIds = new Set(model.zones.map((z) => z.id));
  const portIds = new Set(model.ports.map((p) => p.id));
  const instrumentIds = new Set(model.instruments.map((i) => i.id));

  model.zones.forEach((zone) => {
    if (!equipmentIds.has(zone.equipmentId)) {
      issues.push({
        level: 'error',
        code: 'ZONE_OWNER_MISSING',
        message: `Zone ${zone.id} references missing equipment ${zone.equipmentId}.`,
        entityId: zone.id,
      });
    }
  });

  model.ports.forEach((port) => {
    const ownerExists =
      (port.ownerKind === 'zone' && zoneIds.has(port.ownerId)) ||
      (port.ownerKind === 'equipment' && equipmentIds.has(port.ownerId)) ||
      (port.ownerKind === 'instrument' && instrumentIds.has(port.ownerId));

    if (!ownerExists) {
      issues.push({
        level: 'error',
        code: 'PORT_OWNER_MISSING',
        message: `Port ${port.id} references missing ${port.ownerKind} ${port.ownerId}.`,
        entityId: port.id,
      });
    }
  });

  model.pipes.forEach((pipe) => {
    if (!portIds.has(pipe.fromPortId) || !portIds.has(pipe.toPortId)) {
      issues.push({
        level: 'error',
        code: 'PIPE_ENDPOINT_PORT_MISSING',
        message: `Pipe ${pipe.id} must connect existing ports.`,
        entityId: pipe.id,
      });
    }
  });

  model.relations.forEach((rel) => {
    const { source, target } = rel;
    const endpointExists = (kind: string, id: string) => {
      if (kind === 'equipment') return equipmentIds.has(id);
      if (kind === 'zone') return zoneIds.has(id);
      if (kind === 'port') return portIds.has(id);
      if (kind === 'instrument') return instrumentIds.has(id);
      if (kind === 'pipe') return model.pipes.some((p) => p.id === id);
      return false;
    };

    if (!endpointExists(source.kind, source.id) || !endpointExists(target.kind, target.id)) {
      issues.push({
        level: 'error',
        code: 'RELATION_ENDPOINT_MISSING',
        message: `Relation ${rel.id} has invalid source/target endpoint.`,
        entityId: rel.id,
      });
      return;
    }

    if (rel.type === RELATION_TYPES.HAS_ZONE && !(source.kind === 'equipment' && target.kind === 'zone')) {
      issues.push({
        level: 'error',
        code: 'REL_HAS_ZONE_INVALID_ENDPOINT',
        message: `HAS_ZONE must be equipment -> zone (${rel.id}).`,
        entityId: rel.id,
      });
    }

    if (rel.type === RELATION_TYPES.HAS_PORT && !(['zone', 'equipment', 'instrument'].includes(source.kind) && target.kind === 'port')) {
      issues.push({
        level: 'error',
        code: 'REL_HAS_PORT_INVALID_ENDPOINT',
        message: `HAS_PORT must be zone/equipment/instrument -> port (${rel.id}).`,
        entityId: rel.id,
      });
    }

    if (rel.type === RELATION_TYPES.FEEDS && !((source.kind === 'port' && target.kind === 'zone') || (source.kind === 'zone' && target.kind === 'zone'))) {
      issues.push({
        level: 'error',
        code: 'REL_FEEDS_INVALID_ENDPOINT',
        message: `FEEDS must be port -> zone or zone -> zone (${rel.id}).`,
        entityId: rel.id,
      });
    }

    if (rel.type === RELATION_TYPES.DRAINS && !((source.kind === 'zone' && target.kind === 'port') || (source.kind === 'zone' && target.kind === 'zone'))) {
      issues.push({
        level: 'error',
        code: 'REL_DRAINS_INVALID_ENDPOINT',
        message: `DRAINS must be zone -> port or zone -> zone (${rel.id}).`,
        entityId: rel.id,
      });
    }

    if (rel.type === RELATION_TYPES.MEASURES && !(source.kind === 'instrument' && target.kind === 'zone')) {
      issues.push({
        level: 'warning',
        code: 'REL_MEASURES_RECOMMENDED_ENDPOINT',
        message: `MEASURES is recommended as instrument -> zone (${rel.id}).`,
        entityId: rel.id,
      });
    }

    if (rel.type === RELATION_TYPES.CONTROLS && !(source.kind === 'instrument' && ['zone', 'equipment'].includes(target.kind))) {
      issues.push({
        level: 'warning',
        code: 'REL_CONTROLS_RECOMMENDED_ENDPOINT',
        message: `CONTROLS is recommended as instrument -> zone/equipment (${rel.id}).`,
        entityId: rel.id,
      });
    }
  });

  return { ok: !issues.some((i) => i.level === 'error'), issues };
};
