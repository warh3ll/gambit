/**
 * MARTA'S HOUSE — an instanced interior in Barrelsby (placeholder content).
 * Map characters: see barrelsbyRoad.ts. Leaving through the door returns to the road.
 */
import type { AreaDef } from './types';

export const MARTA_HOUSE: AreaDef = {
  id: 'martaHouse',
  name: 'Marta\'s House',
  kind: 'interior',
  legend: {
    D: { exit: { to: 'barrelsbyRoad', at: 'martaDoor' }, tile: 'Door' },
    d: { start: 'door' }, // where you arrive from outside
    m: { npc: 'marta' },
  },
  map: [
    'WWWWWWWWWWWWWW',
    'W____________W',
    'W_OO______OO_W',
    'W_OO___m_____W',
    'W____________W',
    'W_O__________W',
    'W_O____d_____W',
    'WWWWWWWDWWWWWW',
  ],
};
