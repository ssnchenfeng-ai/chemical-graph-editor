export const RELATION_TYPES = {
  HAS_ZONE: 'HAS_ZONE',
  HAS_PORT: 'HAS_PORT',
  CONNECTS_TO: 'CONNECTS_TO',
  FEEDS: 'FEEDS',
  DRAINS: 'DRAINS',
  MEASURES: 'MEASURES',
  CONTROLS: 'CONTROLS',
} as const;

export type RelationType = (typeof RELATION_TYPES)[keyof typeof RELATION_TYPES];

export type RelationEndpointKind =
  | 'equipment'
  | 'zone'
  | 'port'
  | 'pipe'
  | 'instrument';

export interface RelationEndpoint {
  kind: RelationEndpointKind;
  id: string;
}

export interface DomainRelation {
  id: string;
  type: RelationType;
  source: RelationEndpoint;
  target: RelationEndpoint;
  attributes?: Record<string, unknown>;
}
