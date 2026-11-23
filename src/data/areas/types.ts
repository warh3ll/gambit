import type { TileName } from '../../world/tiles';
import type { EnemyTypeId } from '../enemies';

/**
 * What a map character places, besides plain tiles. Every marker stands on walkable ground: by default the most
 * common ground around it, or `tile` if given (e.g. a door).
 */
export type Marker = (
  | /** A named spot the party can arrive at. 'default' is used for a new game or when nothing else applies. */
  { start: string }
  /** Stepping here moves the party to another area, arriving at that area's start point `at`. */
  | { exit: { to: string; at: string } }
  /**
   * An enemy. Enemies close together form one group. Give one of them a `group` name to refer to the group
   * (in `encounters` below, or from an event: fight('stranger')).
   */
  | { enemy: EnemyTypeId; group?: string }
  /** A character to talk to (see src/data/npcs.ts). */
  | { npc: string }
  /** A story trigger: plays the event with this id (src/data/story.ts) once, when the leader steps on it. */
  | { trigger: string }
) & { tile?: TileName };

export interface AreaDef {
  id: string;
  /** Shown when entering the area. */
  name: string;
  /** Outdoor areas are larger and walkable; interiors and dungeons are instanced (entered through an exit). */
  kind: 'outdoor' | 'interior' | 'dungeon';
  /** One character per 16px tile; every row the same length. Tile characters are in src/world/tiles.ts. */
  map: string[];
  /** This area's markers, on top of the shared ones (party start '@' and the common enemies). */
  legend?: Record<string, Marker>;
  /** Settings for named enemy groups. Groups without settings respawn and have no event. */
  encounters?: Record<string, EncounterSettings>;
  /** Event (src/data/story.ts) that plays every time the party arrives in this area. */
  onEnter?: string;
}

export interface EncounterSettings {
  /** Stays beaten once beaten (story/boss fights). Other groups respawn every time the area loads. */
  unique?: boolean;
  /** Event (src/data/story.ts) that plays when this fight is won. */
  onWin?: string;
}
