/** Problems on the maps: things that lead nowhere, refer to missing events or NPCs, or stand where they can't work. */
import type { TilePos } from '../../data/areas/types';
import { ENEMIES } from '../../data/enemies';
import { TILE_CHARS, isBlocking } from '../../world/tiles';
import type { Content } from '../store';
import type { Problem } from '../validate';
import { areaUses, groupsOf, onMap } from './edit';

export function checkAreas(c: Content): Problem[] {
  const out: Problem[] = [];
  const events = c.story.events;
  const start = c.story.newGame.area;
  if (!c.areas[start]) out.push({ level: 'error', text: `New games start in an area “${start}” that doesn't exist. Tick “New games start here” on an area.` });
  else if (!c.areas[start].starts.default) {
    out.push({ level: 'error', area: start, text: `${c.areas[start].name}: new games start here, but it has no start point “default”.` });
  }

  for (const [id, a] of Object.entries(c.areas)) {
    const name = a.name || id;
    const add = (level: Problem['level'], text: string, more: Partial<Problem> = {}) => out.push({ level, area: id, text: `${name}: ${text}`, ...more });
    const blocked = (p: TilePos) => isBlocking(TILE_CHARS[a.tiles[p.y]?.[p.x]] ?? 0);
    const off = (p: TilePos) => !onMap(a, p);

    if (a.onEnter && !events[a.onEnter]) add('error', `plays “${a.onEnter}” on arrival, but there's no such event.`, { missingEvent: a.onEnter });
    if (id !== start && !areaUses(c, id).length) add('warning', 'nothing leads here yet (no exit or “Move party” step).');

    for (const [s, p] of Object.entries(a.starts)) {
      const at = { thing: { kind: 'start' as const, name: s }, at: p };
      if (off(p)) add('warning', `the start point “${s}” is off the map.`, at);
      else if (blocked(p)) add('warning', `the start point “${s}” is on a tile that blocks walking.`, at);
    }

    a.exits.forEach((e, index) => {
      const at = { thing: { kind: 'exit' as const, index }, at: e };
      const target = c.areas[e.to];
      if (!target) add('error', `an exit leads to an area “${e.to}” that doesn't exist.`, at);
      else if (!target.starts[e.at]) add('error', `an exit leads to ${target.name || e.to}, which has no start point “${e.at}”.`, at);
      if (off(e)) add('warning', 'an exit is off the map.', at);
      else if (blocked(e)) add('warning', 'an exit is on a tile that blocks walking, so it can never be used.', at);
    });

    a.npcs.forEach((n, index) => {
      const at = { thing: { kind: 'npc' as const, index }, at: n };
      if (!c.npcs[n.id]) add('error', `there's an NPC “${n.id}” on the map, but no NPC with that id.`, { ...at, missingNpc: n.id });
      if (off(n)) add('warning', `${c.npcs[n.id]?.name ?? n.id} is off the map.`, at);
    });

    a.enemies.forEach((e, index) => {
      const at = { thing: { kind: 'enemy' as const, index }, at: e };
      if (!(e.type in ENEMIES)) add('error', `an enemy of unknown type “${e.type}”.`, at);
      if (off(e)) add('warning', 'an enemy is off the map.', at);
      else if (blocked(e)) add('warning', `a ${ENEMIES[e.type as keyof typeof ENEMIES]?.name ?? 'enemy'} stands on a tile that blocks walking.`, at);
    });

    a.triggers.forEach((t, index) => {
      const at = { thing: { kind: 'trigger' as const, index }, at: t };
      if (!t.event) add('error', 'a story trigger has no event.', at);
      else if (!events[t.event]) add('error', `a story trigger plays “${t.event}”, but there's no such event.`, { ...at, missingEvent: t.event });
      if (off(t)) add('warning', `the story trigger “${t.event}” is off the map.`, at);
    });

    const groups = groupsOf(a);
    const seen = new Map<string, number>();
    for (const g of groups) {
      const at = { thing: { kind: 'enemy' as const, index: g.members[0] }, at: a.enemies[g.members[0]] };
      if (g.names.length > 1) add('warning', `one fight's enemies have different names (${g.names.join(', ')}).`, at);
      if (g.named) seen.set(g.id, (seen.get(g.id) ?? 0) + 1);
      const s = a.encounters[g.id];
      if (s?.onWin && !events[s.onWin]) add('error', `the fight “${g.id}” plays “${s.onWin}” after winning, but there's no such event.`, { ...at, missingEvent: s.onWin });
    }
    for (const [g, n] of seen) if (n > 1) add('warning', `${n} separate fights are named “${g}”; give each its own name.`);
    for (const g of Object.keys(a.encounters)) {
      if (!groups.some((x) => x.id === g)) add('warning', `there are settings for a fight “${g}”, but no enemies with that name.`);
    }
  }
  return out;
}

