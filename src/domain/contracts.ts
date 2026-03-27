import type { SemanticIR } from './ir';
import { validateDomainModel } from './validators';

export interface ContractIssue {
  level: 'error' | 'warning';
  code: string;
  message: string;
  entityId?: string;
}

export interface ContractReport {
  ok: boolean;
  issues: ContractIssue[];
}

export const runDomainContractChecks = (ir: SemanticIR): ContractReport => {
  const issues: ContractIssue[] = [];
  const model = ir.model;

  const allEntityIds = new Set<string>();
  const duplicateIds: string[] = [];
  const registerId = (id: string) => {
    if (allEntityIds.has(id)) duplicateIds.push(id);
    allEntityIds.add(id);
  };

  model.equipments.forEach((e) => registerId(e.id));
  model.zones.forEach((z) => registerId(z.id));
  model.ports.forEach((p) => registerId(p.id));
  model.pipes.forEach((p) => registerId(p.id));
  model.instruments.forEach((i) => registerId(i.id));
  model.relations.forEach((r) => registerId(r.id));

  duplicateIds.forEach((id) => {
    issues.push({
      level: 'error',
      code: 'CONTRACT_DUPLICATE_ENTITY_ID',
      message: `Duplicate entity id across model: ${id}`,
      entityId: id,
    });
  });

  const drawingEntityIds = new Set([
    ...model.drawing.equipmentIds,
    ...model.drawing.instrumentIds,
    ...model.drawing.pipeIds,
    ...model.drawing.relationIds,
  ]);
  if (drawingEntityIds.size === 0) {
    issues.push({
      level: 'warning',
      code: 'CONTRACT_DRAWING_EMPTY',
      message: 'Drawing references no entities.',
      entityId: model.drawing.id,
    });
  }

  const validation = validateDomainModel(model);
  validation.issues.forEach((issue) => {
    issues.push({
      level: issue.level,
      code: `CONTRACT_${issue.code}`,
      message: issue.message,
      entityId: issue.entityId,
    });
  });

  return {
    ok: !issues.some((issue) => issue.level === 'error'),
    issues,
  };
};

