/**
 * All areas in the game. Add a new area file in this folder and list it here.
 */
import { BARRELSBY_ROAD } from './barrelsbyRoad';
import { MARTA_HOUSE } from './martaHouse';
import type { AreaDef } from './types';

export const AREAS: Record<string, AreaDef> = {
  [BARRELSBY_ROAD.id]: BARRELSBY_ROAD,
  [MARTA_HOUSE.id]: MARTA_HOUSE,
};

/** Where a new game begins. */
export const START_AREA = BARRELSBY_ROAD.id;

export function getArea(id: string): AreaDef {
  return AREAS[id] ?? AREAS[START_AREA];
}
