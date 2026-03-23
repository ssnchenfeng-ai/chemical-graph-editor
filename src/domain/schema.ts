export type SchemaValueType = 'string' | 'number' | 'boolean' | 'enum' | 'object';

export interface SchemaField {
  key: string;
  label: string;
  type: SchemaValueType;
  required?: boolean;
  options?: string[];
  defaultValue?: unknown;
}

export interface EntitySchema {
  entity: 'drawing' | 'equipment' | 'zone' | 'port' | 'pipe' | 'instrument' | 'relation';
  fields: SchemaField[];
}

export const DOMAIN_SCHEMAS: EntitySchema[] = [
  {
    entity: 'equipment',
    fields: [
      { key: 'id', label: 'ID', type: 'string', required: true },
      { key: 'type', label: 'Type', type: 'string', required: true },
      { key: 'tag', label: 'Tag', type: 'string' },
      { key: 'zoneIds', label: 'Zone IDs', type: 'object', required: true },
    ],
  },
  {
    entity: 'zone',
    fields: [
      { key: 'id', label: 'ID', type: 'string', required: true },
      { key: 'equipmentId', label: 'Equipment ID', type: 'string', required: true },
      { key: 'role', label: 'Role', type: 'string', required: true },
      { key: 'phase', label: 'Phase', type: 'enum', options: ['Liquid', 'Vapor', 'Mix', 'Solid', 'Any'] },
    ],
  },
  {
    entity: 'port',
    fields: [
      { key: 'id', label: 'ID', type: 'string', required: true },
      { key: 'ownerKind', label: 'Owner Kind', type: 'enum', options: ['zone', 'equipment', 'instrument'], required: true },
      { key: 'ownerId', label: 'Owner ID', type: 'string', required: true },
      { key: 'direction', label: 'Direction', type: 'enum', options: ['in', 'out', 'bi'], required: true },
      { key: 'role', label: 'Role', type: 'string', required: true },
    ],
  },
  {
    entity: 'pipe',
    fields: [
      { key: 'id', label: 'ID', type: 'string', required: true },
      { key: 'fromPortId', label: 'From Port', type: 'string', required: true },
      { key: 'toPortId', label: 'To Port', type: 'string', required: true },
      { key: 'dnSpec', label: 'DN Spec', type: 'object' },
      { key: 'pnSpec', label: 'PN Spec', type: 'object' },
    ],
  },
  {
    entity: 'instrument',
    fields: [
      { key: 'id', label: 'ID', type: 'string', required: true },
      { key: 'type', label: 'Type', type: 'string', required: true },
      { key: 'tag', label: 'Tag', type: 'string' },
    ],
  },
  {
    entity: 'relation',
    fields: [
      { key: 'id', label: 'ID', type: 'string', required: true },
      { key: 'type', label: 'Type', type: 'string', required: true },
      { key: 'source', label: 'Source', type: 'object', required: true },
      { key: 'target', label: 'Target', type: 'object', required: true },
    ],
  },
];
