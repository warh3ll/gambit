/**
 * Map tiles. The ids index into the 'tiles' tileset texture (16px tiles side by side),
 * which is generated as placeholder art in BootScene unless real art is provided (src/data/art.ts).
 */
export const Tile = {
  Grass: 0,
  Flowers: 1,
  Tree: 2,
  Rock: 3,
  Water: 4,
  Path: 5,
  ForestFloor: 6,
  ForestTree: 7,
  House: 8,
  Fence: 9,
  Bridge: 10,
  Floor: 11,
  Wall: 12,
  Furniture: 13,
  Door: 14,
} as const;

export type TileName = keyof typeof Tile;

export type TileId = (typeof Tile)[keyof typeof Tile];

export const TILE_COUNT = Object.keys(Tile).length;

const BLOCKING = new Set<number>([
  Tile.Tree,
  Tile.Rock,
  Tile.Water,
  Tile.ForestTree,
  Tile.House,
  Tile.Fence,
  Tile.Wall,
  Tile.Furniture,
]);
export const isBlocking = (tile: number) => BLOCKING.has(tile);

/** Characters used in the ASCII map files (src/data/maps/). */
export const TILE_CHARS: Record<string, TileId> = {
  '.': Tile.Grass,
  ',': Tile.Flowers,
  T: Tile.Tree,
  '#': Tile.Rock,
  '~': Tile.Water,
  '=': Tile.Path,
  ':': Tile.ForestFloor,
  Y: Tile.ForestTree,
  H: Tile.House,
  F: Tile.Fence,
  '+': Tile.Bridge,
  _: Tile.Floor,
  W: Tile.Wall,
  O: Tile.Furniture,
};
