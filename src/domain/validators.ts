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
  const internalParts = model.internalParts || [];
  const internalConnections = model.internalConnections || [];
  const internalPartIds = new Set(internalParts.map((p) => p.id));
  const zoneIds = new Set(model.zones.map((z) => z.id));
  const portIds = new Set(model.ports.map((p) => p.id));
  const instrumentIds = new Set(model.instruments.map((i) => i.id));
  const tags = new Map<string, string>();

  const rememberTag = (kind: string, id: string, tag?: string) => {
    if (!tag) {
      issues.push({
        level: 'warning',
        code: 'TAG_MISSING',
        message: `${kind} ${id} 缺少位号。`,
        entityId: id,
      });
      return;
    }

    const previous = tags.get(tag);
    if (previous) {
      issues.push({
        level: 'error',
        code: 'TAG_DUPLICATED',
        message: `位号 ${tag} 同时用于 ${previous} 和 ${id}。`,
        entityId: id,
      });
      return;
    }

    tags.set(tag, id);
  };

  if (model.equipments.length === 0) {
    issues.push({
      level: 'warning',
      code: 'DRAWING_EQUIPMENT_EMPTY',
      message: '图纸还没有设备。',
      entityId: model.drawing.id,
    });
  }

  model.equipments.forEach((equipment) => {
    rememberTag('Equipment', equipment.id, equipment.tag);

    const type = String(equipment.type || '');
    if (['Valve', 'ManualValve', 'ControlValve'].includes(type)) {
      if (!equipment.attributes?.dn) {
        issues.push({ level: 'warning', code: 'VALVE_DN_MISSING', message: `${equipment.tag || equipment.id} 缺少 DN。`, entityId: equipment.id });
      }
      if (!equipment.attributes?.pn) {
        issues.push({ level: 'warning', code: 'VALVE_PN_MISSING', message: `${equipment.tag || equipment.id} 缺少 PN。`, entityId: equipment.id });
      }
    }

    if (type === 'FixedBedReactor' && equipment.zoneIds.length === 0) {
      issues.push({
        level: 'warning',
        code: 'REACTOR_ZONE_MISSING',
        message: `${equipment.tag || equipment.id} 建议定义床层/腔室。`,
        entityId: equipment.id,
      });
    }
  });

  model.instruments.forEach((instrument) => {
    rememberTag('Instrument', instrument.id, instrument.tag);
    if (!instrument.loop) {
      issues.push({
        level: 'warning',
        code: 'INSTRUMENT_LOOP_MISSING',
        message: `${instrument.tag || instrument.id} 缺少回路号。`,
        entityId: instrument.id,
      });
    }
  });

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

    if (!pipe.tag) {
      issues.push({
        level: 'warning',
        code: 'PIPE_TAG_MISSING',
        message: `Pipe ${pipe.id} 缺少管线号。`,
        entityId: pipe.id,
      });
    }

    if (!pipe.fluid) {
      issues.push({
        level: 'warning',
        code: 'PIPE_FLUID_MISSING',
        message: `${pipe.tag || pipe.id} 缺少介质。`,
        entityId: pipe.id,
      });
    }

    if (!pipe.dnSpec?.value) {
      issues.push({
        level: 'warning',
        code: 'PIPE_DN_MISSING',
        message: `${pipe.tag || pipe.id} 缺少 DN。`,
        entityId: pipe.id,
      });
    }

    if (!pipe.pnSpec?.value) {
      issues.push({
        level: 'warning',
        code: 'PIPE_PN_MISSING',
        message: `${pipe.tag || pipe.id} 缺少 PN。`,
        entityId: pipe.id,
      });
    }
  });

  model.relations.forEach((rel) => {
    const { source, target } = rel;
    const endpointExists = (kind: string, id: string) => {
      if (kind === 'equipment') return equipmentIds.has(id);
      if (kind === 'internalPart') return internalPartIds.has(id);
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
      if (source.kind === 'internalPart' && target.kind === 'internalPart') return;
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

  internalConnections.forEach((connection) => {
    if (!internalPartIds.has(connection.sourceId) || !internalPartIds.has(connection.targetId)) {
      issues.push({
        level: 'error',
        code: 'INTERNAL_CONNECTION_ENDPOINT_MISSING',
        message: `内部关系 ${connection.id} 引用了不存在的内部部件。`,
        entityId: connection.id,
      });
    }
  });

  return { ok: !issues.some((i) => i.level === 'error'), issues };
};
