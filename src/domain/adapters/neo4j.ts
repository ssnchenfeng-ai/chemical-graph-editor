import type { SemanticIR } from '../ir';

export interface Neo4jWritePlan {
  cypher: string;
  params: Record<string, unknown>;
}

// NOTE: First-step contract only. Existing persistence can progressively adopt this plan.
export interface Neo4jAdapter {
  toWritePlans(ir: SemanticIR): Neo4jWritePlan[];
  fromQueryResult(input: unknown): SemanticIR;
}
