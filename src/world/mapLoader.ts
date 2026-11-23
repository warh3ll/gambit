import type { AreaDef, TilePos } from '../data/areas/types';
import type { EnemyTypeId } from '../data/enemies';
import { TILE_CHARS } from './tiles';

/** Enemies within this many tiles of each other (chained) belong to the same group. */
export const GROUP_DISTANCE = 4;

export interface EncounterDef {
  /** The group's name if one of its enemies has `group` set, otherwise 'group-<n>' (numbered west to east). */
  id: string;
  /** Stays beaten once beaten (story/boss fights). Other groups respawn whenever the area is entered. */
  unique: boolean;
  /** Event to play when this fight is won. */
  onWin?: string;
  enemies: { type: EnemyTypeId; x: number; y: number }[];
}

export interface LoadedMap {
  width: number;
  height: number;
  /** Tile ids, [y][x]. */
  tiles: number[][];
  /** Named arrival points. Always has at least one. */
  starts: Map<string, TilePos>;
  /** Exit tiles, keyed "x,y". */
  exits: Map<string, { to: string; at: string }>;
  npcs: { id: string; x: number; y: number }[];
  encounters: EncounterDef[];
  /** Story trigger id for each trigger tile, keyed "x,y". */
  triggers: Map<string, string>;
}

/**
 * Turns an area file into tiles, start points, exits, NPCs, enemy groups and story triggers.
 * Only a broken tile grid is an error; things placed off the map are skipped (the editor points those out).
 */
export function loadMap(area: AreaDef, isEnemyType: (type: string) => boolean = () => true): LoadedMap {
  const rows = area.tiles;
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  if (!height || !width) throw new Error(`${area.id}: the map has no tiles`);
  const tiles = rows.map((r, y) => {
    if (r.length !== width) throw new Error(`${area.id}: map row ${y} is ${r.length} wide, expected ${width}`);
    return [...r].map((ch, x) => {
      const t = TILE_CHARS[ch];
      if (t === undefined) throw new Error(`${area.id}: unknown map character "${ch}" at ${x},${y}`);
      return t;
    });
  });
  const onMap = (p: TilePos) => p.x >= 0 && p.y >= 0 && p.x < width && p.y < height;

  const starts = new Map(Object.entries(area.starts ?? {}).filter(([, p]) => onMap(p)));
  if (!starts.size) starts.set('default', { x: Math.floor(width / 2), y: Math.floor(height / 2) });

  const exits = new Map<string, { to: string; at: string }>();
  for (const e of area.exits ?? []) if (onMap(e)) exits.set(`${e.x},${e.y}`, { to: e.to, at: e.at });

  const triggers = new Map<string, string>();
  for (const t of area.triggers ?? []) {
    for (let y = t.y; y < t.y + t.h; y++) for (let x = t.x; x < t.x + t.w; x++) if (onMap({ x, y })) triggers.set(`${x},${y}`, t.event);
  }

  const enemies = (area.enemies ?? []).filter((e) => onMap(e) && isEnemyType(e.type)) as PlacedEnemy[];
  const encounters = groupEnemies(enemies).map((g) => ({
    id: g.id,
    unique: false,
    ...area.encounters?.[g.id],
    enemies: g.enemies.map(({ type, x, y }) => ({ type, x, y })),
  }));

  return {
    width,
    height,
    tiles,
    starts,
    exits,
    npcs: (area.npcs ?? []).filter(onMap),
    encounters,
    triggers,
  };
}

type PlacedEnemy = { type: EnemyTypeId; x: number; y: number; group?: string };

/**
 * Groups enemies standing near each other, numbered west to east (or named, if a member has a group name).
 * The groups hold the very objects passed in.
 */
export function groupEnemies<E extends { x: number; y: number; group?: string }>(all: E[]): { id: string; enemies: E[] }[] {
  const groups: E[][] = [];
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
  const minX = (g: E[]) => Math.min(...g.map((e) => e.x));
  return groups
    .sort((a, b) => minX(a) - minX(b))
    .map((g, i) => ({ id: g.find((e) => e.group)?.group ?? `group-${i + 1}`, enemies: g }));
}
