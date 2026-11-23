/**
 * What the editor knows about the world: the party (from the game's own data), and every area's start points,
 * enemy groups, story triggers and NPC placements, read from the areas being edited (so unsaved map changes count).
 */
import type { AreaFile } from '../data/areas/types';
import { ENEMIES } from '../data/enemies';
import { PARTY } from '../data/party';
import { groupEnemies, loadMap } from '../world/mapLoader';
import { type Content, getState } from './store';

export interface AreaInfo {
  id: string;
  name: string;
  kind: AreaFile['kind'];
  /** Named arrival points ('default' = new game / fallback). */
  starts: string[];
  /** Enemy groups that have a name (only those can be started by an event). */
  groups: { id: string; unique: boolean; onWin?: string }[];
  /** Story trigger ids on this map (each plays the event with the same id). */
  triggers: string[];
  /** NPC ids standing on this map. */
  npcs: string[];
  onEnter?: string;
  /** Set if the map can't be read (the game would refuse to load it too). */
  error?: string;
}

function readArea(id: string, file: AreaFile): AreaInfo {
  const base: AreaInfo = { id, name: file.name, kind: file.kind, starts: [], groups: [], triggers: [], npcs: [], onEnter: file.onEnter };
  try {
    loadMap({ ...file, id });
    const named = groupEnemies(file.enemies.filter((e) => e.type in ENEMIES)).filter((g) => g.enemies.some((e) => e.group));
    return {
      ...base,
      starts: Object.keys(file.starts),
      groups: named.map((g) => ({ id: g.id, unique: !!file.encounters[g.id]?.unique, onWin: file.encounters[g.id]?.onWin })),
      triggers: [...new Set(file.triggers.map((t) => t.event))],
      npcs: [...new Set(file.npcs.map((n) => n.id))],
    };
  } catch (err) {
    return { ...base, error: err instanceof Error ? err.message : String(err) };
  }
}

const cache = new WeakMap<Content['areas'], AreaInfo[]>();

/** Facts about every area in `c`. */
export function areasOf(c: Content): AreaInfo[] {
  let out = cache.get(c.areas);
  if (!out) {
    out = Object.entries(c.areas).map(([id, a]) => readArea(id, a));
    cache.set(c.areas, out);
  }
  return out;
}

const party = PARTY.map((c) => ({ id: c.id, name: c.name, color: c.color }));

/** The world as currently edited. */
export const WORLD = {
  get areas() {
    return areasOf(getState().content);
  },
  /** Where a new game starts. */
  get startArea() {
    return getState().content.story.newGame.area;
  },
  party,
};

export const areaById = (id: string) => WORLD.areas.find((a) => a.id === id);

/** Flags the game sets by itself, besides the ones events set. */
export function builtInFlags(): string[] {
  const triggers = WORLD.areas.flatMap((a) => a.triggers);
  return ['story.intro', ...triggers.map((t) => `story.${t}`), 'sliceComplete'];
}

/** Where an event starts from, in words. Empty if nothing plays it. */
export function eventUses(id: string): { text: string; short: string; area?: string }[] {
  const uses: { text: string; short: string; area?: string }[] = [];
  if (id === 'intro') uses.push({ text: 'Plays once when a new game starts', short: 'New game' });
  for (const a of WORLD.areas) {
    if (a.triggers.includes(id)) uses.push({ text: `Story trigger on the map of ${a.name} (plays once)`, short: `Trigger · ${a.name}`, area: a.id });
    for (const g of a.groups) {
      if (g.onWin === id) uses.push({ text: `After winning the fight “${g.id}” in ${a.name}`, short: `After fight · ${g.id}`, area: a.id });
    }
    if (a.onEnter === id) uses.push({ text: `Every time the party arrives in ${a.name}`, short: `On arrival · ${a.name}`, area: a.id });
  }
  return uses;
}

/** Areas an NPC stands in. */
export const npcAreas = (npcId: string) => WORLD.areas.filter((a) => a.npcs.includes(npcId));
