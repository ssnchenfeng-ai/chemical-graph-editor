import type { DomainRelation } from './relations';

export type EntityId = string;

export type EquipmentType =
  | 'Reactor'
  | 'FixedBedReactor'
  | 'Exchanger'
  | 'Tank'
  | 'Separator'
  | 'Pump'
  | 'Compressor'
  | 'Valve'
  | 'ControlValve'
  | 'Instrument'
  | string;

export type ZoneRole =
  | 'reaction_zone'
  | 'salt_bath_zone'
  | 'upper_salt_ring'
  | 'lower_salt_ring'
  | 'shell_side'
  | 'tube_side'
  | 'jacket'
  | 'vapor_space'
  | 'liquid_space'
  | 'header'
  | 'catalyst_bed'
  | string;

export type PortDirection = 'in' | 'out' | 'bi';

export type PortRole =
  | 'process'
  | 'signal'
  | 'utility'
  | 'relief'
  | string;

export interface Drawing {
  id: EntityId;
  name: string;
  revision?: string;
  equipmentIds: EntityId[];
  instrumentIds: EntityId[];
  pipeIds: EntityId[];
  relationIds: EntityId[];
  metadata?: Record<string, unknown>;
}

export interface Equipment {
  id: EntityId;
  type: EquipmentType;
  tag?: string;
  name?: string;
  description?: string;
  zoneIds: EntityId[];
  portIds: EntityId[];
  internalPartIds?: EntityId[];
  internalConnectionIds?: EntityId[];
  attributes?: Record<string, unknown>;
}

export interface Zone {
  id: EntityId;
  equipmentId: EntityId;
  role: ZoneRole;
  label?: string;
  phase?: 'Liquid' | 'Vapor' | 'Mix' | 'Solid' | 'Any' | string;
  pressureBand?: 'LP' | 'MP' | 'HP' | string;
  portIds: EntityId[];
  attributes?: Record<string, unknown>;
}

export interface Port {
  id: EntityId;
  ownerKind: 'zone' | 'equipment' | 'instrument';
  ownerId: EntityId;
  direction: PortDirection;
  role: PortRole;
  mediumClass?: 'process' | 'signal' | 'utility' | 'thermal' | string;
  label?: string;
  attributes?: Record<string, unknown>;
}

export interface DnSpec {
  series: 'DN' | 'NPS' | string;
  value: string;
  unit?: 'mm' | 'inch' | string;
}

export interface PnSpec {
  series: 'PN' | 'CL' | string;
  value: string;
  unit?: 'bar' | 'class' | string;
  standard?: string;
}

export interface Pipe {
  id: EntityId;
  fromPortId: EntityId;
  toPortId: EntityId;
  fluid?: string;
  material?: string;
  dnSpec?: DnSpec;
  pnSpec?: PnSpec;
  insulation?: string;
  tag?: string;
  attributes?: Record<string, unknown>;
}

export interface Instrument {
  id: EntityId;
  type: EquipmentType;
  tag?: string;
  loop?: string;
  mountPortId?: EntityId;
  measurePortId?: EntityId;
  controlPortId?: EntityId;
  attributes?: Record<string, unknown>;
}

export interface InternalPart {
  id: EntityId;
  equipmentId: EntityId;
  type: string;
  label?: string;
  phase?: string;
  attributes?: Record<string, unknown>;
}

export interface InternalConnection {
  id: EntityId;
  equipmentId: EntityId;
  type: string;
  sourceId: EntityId;
  targetId: EntityId;
  label?: string;
  attributes?: Record<string, unknown>;
}

export interface DomainModel {
  drawing: Drawing;
  equipments: Equipment[];
  internalParts?: InternalPart[];
  internalConnections?: InternalConnection[];
  zones: Zone[];
  ports: Port[];
  pipes: Pipe[];
  instruments: Instrument[];
  relations: DomainRelation[];
}
