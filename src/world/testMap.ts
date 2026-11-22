/**
 * Placeholder map for M1 — built in code until we switch to Tiled maps.
 * Tile ids index into the generated 'tiles' tileset (see BootScene).
 */
import type { EnemyTypeId } from '../data/enemies';

export const Tile = {
  Grass: 0,
  Flowers: 1,
  Tree: 2,
  Rock: 3,
  Water: 4,
  Path: 5,
} as const;

export const TILE_COUNT = 6;

const BLOCKING = new Set<number>([Tile.Tree, Tile.Rock, Tile.Water]);
export const isBlocking = (tile: number) => BLOCKING.has(tile);

export const MAP_WIDTH = 64;
export const MAP_HEIGHT = 40;

/** Tile the party starts on. */
export const SPAWN = { x: 8, y: 20 };

/** Enemy groups placed on the test map (tile coordinates). */
export interface EncounterDef {
  id: string;
  enemies: { type: EnemyTypeId; x: number; y: number }[];
}

export const ENCOUNTERS: EncounterDef[] = [
  {
    id: 'wolves',
    enemies: [
      { type: 'wolf', x: 26, y: 23 },
      { type: 'wolf', x: 28, y: 22 },
      { type: 'wolf', x: 27, y: 25 },
    ],
  },
  {
    id: 'bandits-gap',
    enemies: [
      { type: 'bandit', x: 40, y: 19 },
      { type: 'bandit', x: 40, y: 22 },
      { type: 'banditArcher', x: 44, y: 20 },
    ],
  },
  {
    id: 'lone-bandit',
    enemies: [{ type: 'bandit', x: 48, y: 6 }],
  },
];

/** Small deterministic RNG so the map is the same every run. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
}

export function buildTestMap(): number[][] {
  const rand = rng(1337);
  const map: number[][] = Array.from({ length: MAP_HEIGHT }, () =>
    Array.from({ length: MAP_WIDTH }, () => (rand() < 0.06 ? Tile.Flowers : Tile.Grass)),
  );
  const set = (x: number, y: number, t: number) => {
    if (x >= 0 && y >= 0 && x < MAP_WIDTH && y < MAP_HEIGHT) map[y][x] = t;
  };
  const rect = (x: number, y: number, w: number, h: number, t: number) => {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(i, j, t);
  };
  const blob = (cx: number, cy: number, rx: number, ry: number, t: number) => {
    for (let j = -ry; j <= ry; j++)
      for (let i = -rx; i <= rx; i++) if ((i * i) / (rx * rx) + (j * j) / (ry * ry) <= 1) set(cx + i, cy + j, t);
  };

  // Dirt path winding west → east.
  for (let x = 0; x < MAP_WIDTH; x++) {
    const y = Math.round(20 + Math.sin(x / 7) * 4);
    rect(x, y, 1, 2, Tile.Path);
  }

  // Forest border.
  rect(0, 0, MAP_WIDTH, 2, Tile.Tree);
  rect(0, MAP_HEIGHT - 2, MAP_WIDTH, 2, Tile.Tree);
  rect(0, 0, 2, MAP_HEIGHT, Tile.Tree);
  rect(MAP_WIDTH - 2, 0, 2, MAP_HEIGHT, Tile.Tree);

  // Pond and a rocky ridge with a gap to walk through.
  blob(22, 9, 5, 3, Tile.Water);
  rect(36, 4, 2, 13, Tile.Rock);
  rect(36, 25, 2, 13, Tile.Rock);
  rect(36, 4, 10, 2, Tile.Rock);

  // Tree clumps.
  blob(14, 31, 3, 2, Tile.Tree);
  blob(50, 12, 2, 2, Tile.Tree);
  blob(52, 30, 4, 3, Tile.Tree);
  blob(28, 30, 2, 3, Tile.Tree);

  // Scattered single trees, kept off the path and away from spawn.
  for (let n = 0; n < 60; n++) {
    const x = 2 + Math.floor(rand() * (MAP_WIDTH - 4));
    const y = 2 + Math.floor(rand() * (MAP_HEIGHT - 4));
    if (map[y][x] !== Tile.Grass && map[y][x] !== Tile.Flowers) continue;
    if (Math.abs(x - SPAWN.x) < 5 && Math.abs(y - SPAWN.y) < 5) continue;
    set(x, y, Tile.Tree);
  }

  // Keep the spawn area clear.
  rect(SPAWN.x - 3, SPAWN.y - 3, 7, 7, Tile.Grass);
  return map;
}
