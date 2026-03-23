import type { SemanticIR } from '../ir';

// NOTE: First-step contract only. Implementations should live in app-specific modules.
export interface CanvasAdapter {
  toIR(input: unknown): SemanticIR;
  fromIR(ir: SemanticIR): unknown;
}
