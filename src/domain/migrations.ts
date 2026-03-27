import type { SemanticIR } from './ir';

export const CURRENT_IR_VERSION = 'ir/0.1';
export const CURRENT_SCHEMA_VERSION = 'schema/0.2';

export const migrateSemanticIR = (ir: SemanticIR): SemanticIR => {
  const next: SemanticIR = {
    ...ir,
    meta: {
      ...ir.meta,
      version: CURRENT_IR_VERSION,
      generatedAt: ir.meta.generatedAt || new Date().toISOString(),
    },
    model: {
      ...ir.model,
      drawing: {
        ...ir.model.drawing,
        metadata: {
          ...(ir.model.drawing.metadata || {}),
          schemaVersion: ir.model.drawing.metadata?.schemaVersion || CURRENT_SCHEMA_VERSION,
        },
      },
      zones: ir.model.zones.map((zone) => ({
        ...zone,
        role: zone.role === 'chamber' ? 'zone' : zone.role,
      })),
    },
  };
  return next;
};

