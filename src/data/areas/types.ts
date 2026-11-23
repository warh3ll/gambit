/**
 * The shape of an area file (src/data/areas/<id>.json). Areas are made in the Gambit Editor (Map tab);
 * the file name is the area's id.
 *
 * Positions are in tiles, counted from the top-left corner (0, 0).
 */

export interface TilePos {
  x: number;
  y: number;
}

export interface AreaFile {
  /** Shown when entering the area. */
  name: string;
  /** Outdoor areas are larger and walkable; interiors and dungeons are instanced (entered through an exit). */
  kind: 'outdoor' | 'interior' | 'dungeon';
  /** Event (story.json) that plays every time the party arrives in this area. */
  onEnter?: string;
  /** Named spots the party can arrive at. 'default' is used for a new game or when nothing else applies. */
  starts: Record<string, TilePos>;
  /** Stepping on one moves the party to area `to`, arriving at its start point `at`. */
  exits: (TilePos & { to: string; at: string })[];
  /** Characters to talk to (npcs.json). */
  npcs: (TilePos & { id: string })[];
  /**
   * Enemies (types in src/data/enemies.ts). Enemies close together form one group (one fight).
   * Give one of them a `group` name to refer to the group (in `encounters`, or from a "Start fight" step).
   */
  enemies: (TilePos & { type: string; group?: string })[];
  /** Story triggers: a rectangle of tiles that plays `event` once, when the leader steps in it. */
  triggers: (TilePos & { event: string; w: number; h: number })[];
  /** Settings for named enemy groups. Groups without settings respawn and play no event. */
  encounters: Record<string, EncounterSettings>;
  /** One character per 16px tile, every row the same length. The characters are listed in src/world/tiles.ts. */
  tiles: string[];
}

export interface EncounterSettings {
  /** Stays beaten once beaten (story/boss fights). Other groups respawn every time the area loads. */
  unique?: boolean;
  /** Event (story.json) that plays when this fight is won. */
  onWin?: string;
}

/** An area as the game uses it: the file, plus its id (the file name). */
export interface AreaDef extends AreaFile {
  id: string;
}
