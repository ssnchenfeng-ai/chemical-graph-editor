import type { SemanticIR } from '../ir';
import { RELATION_TYPES } from '../relations';

export const phthalicAnhydrideFixedBedMinimalIR: SemanticIR = {
  meta: {
    version: 'ir/0.1',
    source: 'importer',
    generatedAt: '2026-03-22T00:00:00.000Z',
  },
  model: {
    drawing: {
      id: 'drawing-pa-fixed-bed-min',
      name: 'PhthalicAnhydride-FixedBed-Minimal',
      revision: 'v1',
      equipmentIds: ['eq-rx-001'],
      instrumentIds: [],
      pipeIds: [],
      relationIds: [
        'rel-hz-rx-rz',
        'rel-hz-rx-sbz',
        'rel-hz-rx-usr',
        'rel-hz-rx-lsr',
        'rel-hp-rz-gin',
        'rel-hp-rz-gout',
        'rel-hp-usr-sin',
        'rel-hp-lsr-sout',
        'rel-feed-gin-rz',
        'rel-drain-rz-gout',
        'rel-feed-sin-usr',
        'rel-drain-lsr-sout',
        'rel-feed-usr-sbz',
        'rel-drain-sbz-lsr',
      ],
    },
    equipments: [
      {
        id: 'eq-rx-001',
        type: 'FixedBedReactor',
        tag: 'R-101',
        name: 'Phthalic Anhydride Fixed Bed Reactor',
        zoneIds: ['zone-rz', 'zone-sbz', 'zone-usr', 'zone-lsr'],
        portIds: [],
      },
    ],
    zones: [
      { id: 'zone-rz', equipmentId: 'eq-rx-001', role: 'reaction_zone', label: 'Reaction Zone', phase: 'Mix', portIds: ['port-gas-in', 'port-gas-out'] },
      { id: 'zone-sbz', equipmentId: 'eq-rx-001', role: 'salt_bath_zone', label: 'Salt Bath Zone', phase: 'Liquid', portIds: [] },
      { id: 'zone-usr', equipmentId: 'eq-rx-001', role: 'upper_salt_ring', label: 'Upper Salt Ring', phase: 'Liquid', portIds: ['port-salt-in'] },
      { id: 'zone-lsr', equipmentId: 'eq-rx-001', role: 'lower_salt_ring', label: 'Lower Salt Ring', phase: 'Liquid', portIds: ['port-salt-out'] },
    ],
    ports: [
      { id: 'port-gas-in', ownerKind: 'zone', ownerId: 'zone-rz', direction: 'in', role: 'process', mediumClass: 'process', label: 'gas in' },
      { id: 'port-gas-out', ownerKind: 'zone', ownerId: 'zone-rz', direction: 'out', role: 'process', mediumClass: 'process', label: 'gas out' },
      { id: 'port-salt-in', ownerKind: 'zone', ownerId: 'zone-usr', direction: 'in', role: 'utility', mediumClass: 'thermal', label: 'salt in' },
      { id: 'port-salt-out', ownerKind: 'zone', ownerId: 'zone-lsr', direction: 'out', role: 'utility', mediumClass: 'thermal', label: 'salt out' },
    ],
    pipes: [],
    instruments: [],
    relations: [
      { id: 'rel-hz-rx-rz', type: RELATION_TYPES.HAS_ZONE, source: { kind: 'equipment', id: 'eq-rx-001' }, target: { kind: 'zone', id: 'zone-rz' } },
      { id: 'rel-hz-rx-sbz', type: RELATION_TYPES.HAS_ZONE, source: { kind: 'equipment', id: 'eq-rx-001' }, target: { kind: 'zone', id: 'zone-sbz' } },
      { id: 'rel-hz-rx-usr', type: RELATION_TYPES.HAS_ZONE, source: { kind: 'equipment', id: 'eq-rx-001' }, target: { kind: 'zone', id: 'zone-usr' } },
      { id: 'rel-hz-rx-lsr', type: RELATION_TYPES.HAS_ZONE, source: { kind: 'equipment', id: 'eq-rx-001' }, target: { kind: 'zone', id: 'zone-lsr' } },

      { id: 'rel-hp-rz-gin', type: RELATION_TYPES.HAS_PORT, source: { kind: 'zone', id: 'zone-rz' }, target: { kind: 'port', id: 'port-gas-in' } },
      { id: 'rel-hp-rz-gout', type: RELATION_TYPES.HAS_PORT, source: { kind: 'zone', id: 'zone-rz' }, target: { kind: 'port', id: 'port-gas-out' } },
      { id: 'rel-hp-usr-sin', type: RELATION_TYPES.HAS_PORT, source: { kind: 'zone', id: 'zone-usr' }, target: { kind: 'port', id: 'port-salt-in' } },
      { id: 'rel-hp-lsr-sout', type: RELATION_TYPES.HAS_PORT, source: { kind: 'zone', id: 'zone-lsr' }, target: { kind: 'port', id: 'port-salt-out' } },

      { id: 'rel-feed-gin-rz', type: RELATION_TYPES.FEEDS, source: { kind: 'port', id: 'port-gas-in' }, target: { kind: 'zone', id: 'zone-rz' } },
      { id: 'rel-drain-rz-gout', type: RELATION_TYPES.DRAINS, source: { kind: 'zone', id: 'zone-rz' }, target: { kind: 'port', id: 'port-gas-out' } },
      { id: 'rel-feed-sin-usr', type: RELATION_TYPES.FEEDS, source: { kind: 'port', id: 'port-salt-in' }, target: { kind: 'zone', id: 'zone-usr' } },
      { id: 'rel-drain-lsr-sout', type: RELATION_TYPES.DRAINS, source: { kind: 'zone', id: 'zone-lsr' }, target: { kind: 'port', id: 'port-salt-out' } },
      { id: 'rel-feed-usr-sbz', type: RELATION_TYPES.FEEDS, source: { kind: 'zone', id: 'zone-usr' }, target: { kind: 'zone', id: 'zone-sbz' } },
      { id: 'rel-drain-sbz-lsr', type: RELATION_TYPES.DRAINS, source: { kind: 'zone', id: 'zone-sbz' }, target: { kind: 'zone', id: 'zone-lsr' } },
    ],
  },
};
