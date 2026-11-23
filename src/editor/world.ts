/**
 * What the editor knows about the rest of the game, read straight from the game's own data files:
 * the party, and every area's start points, enemy groups, story triggers and NPC placements.
 * (Areas are still edited in src/data/areas/ until the map painter exists, so this is read-only here.)
 */
import { AREAS, START_AREA } from '../data/areas';
import type { AreaDef } from '../data/areas/types';
import { PARTY } from '../data/party';
import { loadMap } from '../world/mapLoader';

export interface AreaInfo {
  id: string;
  name: string;
  kind: AreaDef['kind'];
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

function readArea(def: AreaDef): AreaInfo {
  const base: AreaInfo = { id: def.id, name: def.name, kind: def.kind, starts: [], groups: [], triggers: [], npcs: [], onEnter: def.onEnter };
  try {
    const map = loadMap(def);
    const named = new Set(Object.values(def.legend ?? {}).flatMap((m) => ('enemy' in m && m.group ? [m.group] : [])));
    return {
      ...base,
      starts: [...map.starts.keys()],
      groups: map.encounters.filter((g) => named.has(g.id)).map((g) => ({ id: g.id, unique: g.unique ?? false, onWin: g.onWin })),
      triggers: [...new Set(map.triggers.values())],
      npcs: [...new Set(map.npcs.map((n) => n.id))],
    };
  } catch (err) {
    return { ...base, error: err instanceof Error ? err.message : String(err) };
  }
}

export const WORLD = {
  areas: Object.values(AREAS).map(readArea),
  startArea: START_AREA,
  party: PARTY.map((c) => ({ id: c.id, name: c.name, color: c.color })),
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
