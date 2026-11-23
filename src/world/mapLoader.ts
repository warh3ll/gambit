import type { AreaDef, Marker } from '../data/areas/types';
import type { EnemyTypeId } from '../data/enemies';
import { TILE_CHARS, Tile, isBlocking } from './tiles';

/** Markers every area understands; an area's own legend can add to or override these. */
const SHARED_MARKERS: Record<string, Marker> = {
  '@': { start: 'default' },
  w: { enemy: 'wolf' },
  b: { enemy: 'bandit' },
  a: { enemy: 'banditArcher' },
  c: { enemy: 'acolyte' },
};

/** Enemies within this many tiles of each other (chained) belong to the same group. */
const GROUP_DISTANCE = 4;

type TilePos = { x: number; y: number };

export interface EncounterDef {
  /** The group's name if one of its enemies has `group` set, otherwise 'group-<n>' (numbered west to east). */
  id: string;
  /** Stays beaten once beaten (story/boss fights). Other groups respawn whenever the area is entered. */
  unique: boolean;
  /** Event to play when this fight is won. */
  onWin?: string;
  enemies: { type: EnemyTypeId; x: number; y: number }[];
}

type PlacedEnemy = EncounterDef['enemies'][number] & { group?: string };

export interface LoadedMap {
  width: number;
  height: number;
  /** Tile ids, [y][x]. */
  tiles: number[][];
  /** Named arrival points. */
  starts: Map<string, TilePos>;
  /** Exit tiles, keyed "x,y". */
  exits: Map<string, { to: string; at: string }>;
  npcs: { id: string; x: number; y: number }[];
  encounters: EncounterDef[];
  /** Story trigger id for each trigger tile, keyed "x,y". */
  triggers: Map<string, string>;
}

/** Turns an area's ASCII map + legend into tiles, start points, exits, NPCs, enemy groups and story triggers. */
export function loadMap(area: AreaDef): LoadedMap {
  const rows = area.map;
  const legend = { ...SHARED_MARKERS, ...area.legend };
  const height = rows.length;
  const width = rows[0].length;
  rows.forEach((r, y) => {
    if (r.length !== width) throw new Error(`${area.id}: map row ${y} is ${r.length} wide, expected ${width}`);
  });

  const tiles: number[][] = [];
  const placed: { marker: Marker; x: number; y: number }[] = [];
  for (let y = 0; y < height; y++) {
    const line: number[] = [];
    for (let x = 0; x < width; x++) {
      const ch = rows[y][x];
      const tile = TILE_CHARS[ch];
      if (tile === undefined) {
        const marker = legend[ch];
        if (!marker) throw new Error(`${area.id}: unknown map character "${ch}" at ${x},${y}`);
        placed.push({ marker, x, y });
      }
      line.push(tile ?? Tile.Grass);
    }
    tiles.push(line);
  }

  const out: LoadedMap = {
    width,
    height,
    tiles,
    starts: new Map(),
    exits: new Map(),
    npcs: [],
    encounters: [],
    triggers: new Map(),
  };
  const enemies: PlacedEnemy[] = [];
  for (const { marker: m, x, y } of placed) {
    tiles[y][x] = m.tile ? Tile[m.tile] : groundUnder(rows, x, y);
    const key = `${x},${y}`;
    if ('start' in m) out.starts.set(m.start, { x, y });
    else if ('exit' in m) out.exits.set(key, m.exit);
    else if ('enemy' in m) enemies.push({ type: m.enemy, x, y, group: m.group });
    else if ('npc' in m) out.npcs.push({ id: m.npc, x, y });
    else if ('trigger' in m) out.triggers.set(key, m.trigger);
  }
  if (!out.starts.size) throw new Error(`${area.id}: map has no start point`);
  out.encounters = groupEnemies(enemies).map((g) => ({ ...g, ...area.encounters?.[g.id] }));
  for (const name of Object.keys(area.encounters ?? {})) {
    if (!out.encounters.some((g) => g.id === name)) throw new Error(`${area.id}: no enemy group named "${name}" on the map`);
  }
  return out;
}

/** The ground a marker stands on: the most common walkable tile around it. */
function groundUnder(rows: string[], x: number, y: number): number {
  const counts = new Map<number, number>();
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const t = TILE_CHARS[rows[y + dy]?.[x + dx] ?? ''];
      if (t !== undefined && !isBlocking(t)) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  let best: number = Tile.Grass;
  let most = 0;
  for (const [t, n] of counts) if (n > most) [best, most] = [t, n];
  return best;
}

/** Groups enemies standing near each other, numbered west to east (or named, if a member has a group name). */
function groupEnemies(all: PlacedEnemy[]): EncounterDef[] {
  const groups: (typeof all)[] = [];
  const left = [...all];
  while (left.length) {
    const group = [left.shift()!];
    for (let i = 0; i < group.length; i++) {
      for (let j = left.length - 1; j >= 0; j--) {
        const a = group[i];
        const b = left[j];
        if (Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= GROUP_DISTANCE) group.push(...left.splice(j, 1));
      }
    }
    groups.push(group);
  }
  const minX = (g: typeof all) => Math.min(...g.map((e) => e.x));
  return groups
    .sort((a, b) => minX(a) - minX(b))
    .map((g, i) => ({
      id: g.find((e) => e.group)?.group ?? `group-${i + 1}`,
      unique: false,
      enemies: g.map(({ type, x, y }) => ({ type, x, y })),
    }));
}
