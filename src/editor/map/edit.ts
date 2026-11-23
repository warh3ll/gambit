/**
 * Changing areas: painting tiles, placing / moving / removing things, resizing, and renaming things that other
 * content refers to by name (areas, start points, fights, events, NPCs), keeping those references in step.
 */
import type { AreaFile, TilePos } from '../../data/areas/types';
import { ENEMIES } from '../../data/enemies';
import { groupEnemies } from '../../world/mapLoader';
import { TILE_CHARS, Tile, isBlocking } from '../../world/tiles';
import { ID_PATTERN, freshId } from '../steps';
import { type Content, allOwners, commit, walkSteps } from '../store';
import { renameKey } from '../ui';
import type { Selection } from './state';

/** Changes one area (`fn` gets a copy to change in place; see `commit` for `coalesce`). */
export function editArea(id: string, fn: (a: AreaFile, c: Content) => void, coalesce?: string) {
  commit((c) => {
    const a = c.areas[id];
    if (a) fn(a, c);
  }, coalesce);
}

// ── tiles ──

export interface TileInfo {
  char: string;
  id: number;
  name: string;
  blocking: boolean;
}

/** Every tile, in tileset order, with its map character and a readable name. */
export const TILES: TileInfo[] = Object.entries(TILE_CHARS)
  .map(([char, id]) => {
    const key = Object.keys(Tile).find((k) => Tile[k as keyof typeof Tile] === id)!;
    const name = key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/ (\w)/g, (m) => m.toLowerCase());
    return { char, id, name: key === 'House' ? 'House (roof)' : name, blocking: isBlocking(id) };
  })
  .sort((a, b) => a.id - b.id);

export const tileInfo = (char: string | undefined) => TILES.find((t) => t.char === char);

export const mapSize = (a: AreaFile) => ({ w: a.tiles[0]?.length ?? 0, h: a.tiles.length });

export const onMap = (a: AreaFile, p: TilePos) => p.x >= 0 && p.y >= 0 && p.x < mapSize(a).w && p.y < mapSize(a).h;

export function setTile(a: AreaFile, x: number, y: number, ch: string): boolean {
  const row = a.tiles[y];
  if (row === undefined || x < 0 || x >= row.length || row[x] === ch) return false;
  a.tiles[y] = row.slice(0, x) + ch + row.slice(x + 1);
  return true;
}

/** Paints every tile on the line between two tiles (for brush strokes, so fast moves leave no gaps). */
export function paintLine(a: AreaFile, from: TilePos, to: TilePos, ch: string) {
  const n = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y));
  for (let i = 0; i <= n; i++) {
    const t = n ? i / n : 0;
    setTile(a, Math.round(from.x + (to.x - from.x) * t), Math.round(from.y + (to.y - from.y) * t), ch);
  }
}

export function fillRect(a: AreaFile, r: Rect, ch: string) {
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) setTile(a, x, y, ch);
}

/** Paints the patch of same tiles around (x, y). */
export function floodFill(a: AreaFile, x: number, y: number, ch: string) {
  const from = a.tiles[y]?.[x];
  if (from === undefined || from === ch) return;
  const grid = a.tiles.map((r) => [...r]);
  const stack: TilePos[] = [{ x, y }];
  while (stack.length) {
    const p = stack.pop()!;
    if (grid[p.y]?.[p.x] !== from) continue;
    grid[p.y][p.x] = ch;
    stack.push({ x: p.x + 1, y: p.y }, { x: p.x - 1, y: p.y }, { x: p.x, y: p.y + 1 }, { x: p.x, y: p.y - 1 });
  }
  a.tiles = grid.map((r) => r.join(''));
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const rectBetween = (p: TilePos, q: TilePos): Rect => ({
  x: Math.min(p.x, q.x),
  y: Math.min(p.y, q.y),
  w: Math.abs(p.x - q.x) + 1,
  h: Math.abs(p.y - q.y) + 1,
});

/**
 * Adds (positive) or removes (negative) rows / columns at each edge. New tiles are `fill`.
 * Everything placed on the map moves along; things that end up off the map are removed.
 */
export function resize(a: AreaFile, edges: { left: number; top: number; right: number; bottom: number }, fill: string) {
  const { w, h } = mapSize(a);
  const nw = w + edges.left + edges.right;
  const nh = h + edges.top + edges.bottom;
  if (nw < 1 || nh < 1) return;
  const rows: string[] = [];
  for (let y = 0; y < nh; y++) {
    const src = a.tiles[y - edges.top];
    let row = '';
    for (let x = 0; x < nw; x++) row += src?.[x - edges.left] ?? fill;
    rows.push(row);
  }
  a.tiles = rows;
  const shift = <T extends TilePos>(p: T): T => ({ ...p, x: p.x + edges.left, y: p.y + edges.top });
  const inside = (p: TilePos) => onMap(a, p);
  a.starts = Object.fromEntries(Object.entries(a.starts).map(([k, p]) => [k, shift(p)] as const).filter(([, p]) => inside(p)));
  a.exits = a.exits.map(shift).filter(inside);
  a.npcs = a.npcs.map(shift).filter(inside);
  a.enemies = a.enemies.map(shift).filter(inside);
  a.triggers = a.triggers
    .map(shift)
    .map((t) => {
      // Clip to the map.
      const x = Math.max(0, t.x);
      const y = Math.max(0, t.y);
      return { ...t, x, y, w: Math.min(t.x + t.w, nw) - x, h: Math.min(t.y + t.h, nh) - y };
    })
    .filter((t) => t.w > 0 && t.h > 0);
}

// ── things on the map ──

/** Where a thing is (triggers are rectangles, everything else one tile). */
export function thingRect(a: AreaFile, sel: Selection): Rect | null {
  if (sel.kind === 'start') {
    const p = a.starts[sel.name];
    return p ? { x: p.x, y: p.y, w: 1, h: 1 } : null;
  }
  if (sel.kind === 'trigger') {
    const t = a.triggers[sel.index];
    return t ? { x: t.x, y: t.y, w: t.w, h: t.h } : null;
  }
  const p = listOf(a, sel.kind)[sel.index];
  return p ? { x: p.x, y: p.y, w: 1, h: 1 } : null;
}

function listOf(a: AreaFile, kind: 'exit' | 'npc' | 'enemy' | 'trigger'): TilePos[] {
  return kind === 'exit' ? a.exits : kind === 'npc' ? a.npcs : kind === 'enemy' ? a.enemies : a.triggers;
}

/** Everything at a tile, topmost (easiest to mean) first. */
export function thingsAt(a: AreaFile, x: number, y: number): Selection[] {
  const out: Selection[] = [];
  const at = (p: TilePos) => p.x === x && p.y === y;
  a.npcs.forEach((p, index) => at(p) && out.push({ kind: 'npc', index }));
  a.enemies.forEach((p, index) => at(p) && out.push({ kind: 'enemy', index }));
  for (const [name, p] of Object.entries(a.starts)) if (at(p)) out.push({ kind: 'start', name });
  a.exits.forEach((p, index) => at(p) && out.push({ kind: 'exit', index }));
  a.triggers.forEach((t, index) => x >= t.x && y >= t.y && x < t.x + t.w && y < t.y + t.h && out.push({ kind: 'trigger', index }));
  return out;
}

export function moveThing(a: AreaFile, sel: Selection, x: number, y: number) {
  if (sel.kind === 'start') {
    if (a.starts[sel.name]) a.starts[sel.name] = { x, y };
    return;
  }
  const p = listOf(a, sel.kind)[sel.index];
  if (p) Object.assign(p, { x, y });
}

export function removeThing(a: AreaFile, sel: Selection) {
  if (sel.kind === 'start') delete a.starts[sel.name];
  else listOf(a, sel.kind).splice(sel.index, 1);
  // A fight's settings go when its last named enemy does.
  if (sel.kind === 'enemy') for (const g of Object.keys(a.encounters)) if (!a.enemies.some((e) => e.group === g)) delete a.encounters[g];
}

/** A start point name not used in this area yet. */
export const freshStartName = (a: AreaFile, base = 'start') => freshId(base, (x) => x in a.starts);

// ── enemy groups ──

export interface GroupInfo {
  /** The name events and settings use: the given name, or 'group-<n>' if unnamed. */
  id: string;
  named: boolean;
  /** Indexes into the area's `enemies`. */
  members: number[];
  /** Different names given to members of the same group (a mistake). */
  names: string[];
}

/** The area's enemy groups (enemies close together form one fight), as the game will form them. */
export function groupsOf(a: AreaFile): GroupInfo[] {
  const tagged = a.enemies.map((e, index) => ({ ...e, index })).filter((e) => e.type in ENEMIES && onMap(a, e));
  return groupEnemies(tagged).map((g) => {
    const names = [...new Set(g.enemies.flatMap((e) => (e.group ? [e.group] : [])))];
    return { id: g.id, named: names.length > 0, members: g.enemies.map((e) => e.index), names };
  });
}

export const groupOfEnemy = (a: AreaFile, index: number) => groupsOf(a).find((g) => g.members.includes(index));

/** Names (or renames) a fight: every member gets the name; its settings and "Start fight" steps follow. */
export function nameGroup(c: Content, areaId: string, group: GroupInfo, next: string) {
  const a = c.areas[areaId];
  for (const i of group.members) a.enemies[i].group = next;
  if (group.named && group.id !== next) {
    if (a.encounters[group.id]) a.encounters = renameKey(a.encounters, group.id, next);
    for (const { steps } of allOwners(c)) walkSteps(steps, (s) => s.do === 'fight' && s.group === group.id && (s.group = next));
  }
}

// ── renaming, with everything that refers to the name ──

export const idProblem = (next: string, taken: boolean) =>
  !next ? 'Needs a name.' : !ID_PATTERN.test(next) ? 'Letters, digits and _ only, starting with a letter.' : taken ? 'That name is taken.' : null;

/** An event got a new name: story triggers, fights and arrival events on the maps follow. */
export function renameEventRefs(c: Content, from: string, to: string) {
  for (const a of Object.values(c.areas)) {
    for (const t of a.triggers) if (t.event === from) t.event = to;
    for (const e of Object.values(a.encounters)) if (e.onWin === from) e.onWin = to;
    if (a.onEnter === from) a.onEnter = to;
  }
}

/** An NPC got a new id: their places on the maps follow. */
export function renameNpcRefs(c: Content, from: string, to: string) {
  for (const a of Object.values(c.areas)) for (const n of a.npcs) if (n.id === from) n.id = to;
}

/** Renames an area: exits leading there, "Move party" steps and the new-game area follow. */
export function renameArea(c: Content, from: string, to: string) {
  c.areas = renameKey(c.areas, from, to);
  for (const a of Object.values(c.areas)) for (const e of a.exits) if (e.to === from) e.to = to;
  for (const { steps } of allOwners(c)) walkSteps(steps, (s) => s.do === 'teleport' && s.area === from && (s.area = to));
  if (c.story.newGame.area === from) c.story.newGame.area = to;
}

/** Renames a start point: exits arriving there and "Move party" steps follow. */
export function renameStart(c: Content, areaId: string, from: string, to: string) {
  const a = c.areas[areaId];
  a.starts = renameKey(a.starts, from, to);
  for (const other of Object.values(c.areas)) for (const e of other.exits) if (e.to === areaId && e.at === from) e.at = to;
  for (const { steps } of allOwners(c)) walkSteps(steps, (s) => s.do === 'teleport' && s.area === areaId && s.at === from && (s.at = to));
}

/** What arrives at a start point: exits in any area, and "Move party" steps. */
export function startUses(c: Content, areaId: string, name: string): string[] {
  const out: string[] = [];
  for (const [id, a] of Object.entries(c.areas)) {
    for (const e of a.exits) if (e.to === areaId && e.at === name) out.push(`the exit at ${e.x}, ${e.y} in ${a.name || id}`);
  }
  for (const { owner, steps } of allOwners(c)) {
    walkSteps(steps, (s) => {
      if (s.do === 'teleport' && s.area === areaId && s.at === name) out.push(`a “Move party” step in ${owner.kind === 'event' ? `“${owner.id}”` : `${owner.id}’s conversation`}`);
    });
  }
  if (name === 'default' && c.story.newGame.area === areaId) out.unshift('new games');
  return out;
}

/** What leads into an area: exits elsewhere, "Move party" steps, new games. */
export function areaUses(c: Content, areaId: string): string[] {
  const out: string[] = [];
  if (c.story.newGame.area === areaId) out.push('new games start here');
  for (const [id, a] of Object.entries(c.areas)) if (id !== areaId && a.exits.some((e) => e.to === areaId)) out.push(`exits in ${a.name || id}`);
  let steps = 0;
  for (const o of allOwners(c)) walkSteps(o.steps, (s) => s.do === 'teleport' && s.area === areaId && steps++);
  if (steps) out.push(`${steps} “Move party” step(s)`);
  return out;
}

/** A fresh, small outdoor area: grass with a start point in the middle. */
export function newArea(name: string, w = 24, h = 16): AreaFile {
  return {
    name,
    kind: 'outdoor',
    starts: { default: { x: Math.floor(w / 2), y: Math.floor(h / 2) } },
    exits: [],
    npcs: [],
    enemies: [],
    triggers: [],
    encounters: {},
    tiles: Array.from({ length: h }, () => '.'.repeat(w)),
  };
}
