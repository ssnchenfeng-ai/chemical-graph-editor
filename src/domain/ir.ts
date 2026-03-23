import type { DomainModel } from './model';

export interface SemanticIRMeta {
  version: 'ir/0.1';
  source?: 'canvas' | 'neo4j' | 'importer' | string;
  generatedAt?: string;
}

export interface SemanticIR {
  meta: SemanticIRMeta;
  model: DomainModel;
}

export const createEmptyIR = (drawingId: string, drawingName: string): SemanticIR => ({
  meta: { version: 'ir/0.1', source: 'canvas', generatedAt: new Date().toISOString() },
  model: {
    drawing: {
      id: drawingId,
      name: drawingName,
      equipmentIds: [],
      instrumentIds: [],
      pipeIds: [],
      relationIds: [],
    },
    equipments: [],
    zones: [],
    ports: [],
    pipes: [],
    instruments: [],
    relations: [],
  },
});
