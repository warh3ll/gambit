import type { EnemyTypeId } from '../data/enemies';
import { TILE_CHARS, Tile, isBlocking } from './tiles';

/** Map characters that place an enemy. */
const ENEMY_CHARS: Record<string, EnemyTypeId> = {
  w: 'wolf',
  b: 'bandit',
  a: 'banditArcher',
  c: 'acolyte',
  S: 'stranger',
};

/** Enemies within this many tiles of each other (chained) belong to the same group. */
const GROUP_DISTANCE = 4;

export interface EncounterDef {
  id: string;
  enemies: { type: EnemyTypeId; x: number; y: number }[];
}

export interface LoadedMap {
  width: number;
  height: number;
  /** Tile ids, [y][x]. */
  tiles: number[][];
  /** Party start tile. */
  spawn: { x: number; y: number };
  encounters: EncounterDef[];
  /** Story trigger digit for each trigger tile, keyed "x,y". */
  triggers: Map<string, string>;
}

/** Turns an ASCII map (see src/data/maps/) into tiles, enemy groups, spawn and story triggers. */
export function loadMap(rows: string[]): LoadedMap {
  const height = rows.length;
  const width = rows[0].length;
  rows.forEach((r, y) => {
    if (r.length !== width) throw new Error(`map row ${y} is ${r.length} wide, expected ${width}`);
  });

  const tiles: number[][] = [];
  const markers: { ch: string; x: number; y: number }[] = [];
  for (let y = 0; y < height; y++) {
    const line: number[] = [];
    for (let x = 0; x < width; x++) {
      const ch = rows[y][x];
      const tile = TILE_CHARS[ch];
      if (tile === undefined) markers.push({ ch, x, y });
      line.push(tile ?? Tile.Grass);
    }
    tiles.push(line);
  }

  let spawn: { x: number; y: number } | null = null;
  const enemies: EncounterDef['enemies'] = [];
  const triggers = new Map<string, string>();
  for (const m of markers) {
    tiles[m.y][m.x] = groundUnder(rows, m.x, m.y);
    if (m.ch === '@') spawn = { x: m.x, y: m.y };
    else if (ENEMY_CHARS[m.ch]) enemies.push({ type: ENEMY_CHARS[m.ch], x: m.x, y: m.y });
    else if (/[1-9]/.test(m.ch)) triggers.set(`${m.x},${m.y}`, m.ch);
    else throw new Error(`unknown map character "${m.ch}" at ${m.x},${m.y}`);
  }
  if (!spawn) throw new Error('map has no party start (@)');

  return { width, height, tiles, spawn, encounters: groupEnemies(enemies), triggers };
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

/** Groups enemies standing near each other, numbered west to east. */
function groupEnemies(all: EncounterDef['enemies']): EncounterDef[] {
  const groups: EncounterDef['enemies'][] = [];
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
  const minX = (g: EncounterDef['enemies']) => Math.min(...g.map((e) => e.x));
  return groups.sort((a, b) => minX(a) - minX(b)).map((enemies, i) => ({ id: `group-${i + 1}`, enemies }));
}
