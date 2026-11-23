/**
 * Finds problems in the content: things that would break or silently do nothing in the game.
 * Errors are things the game can't do; warnings are things that are probably a mistake.
 */
import type { Step } from '../game/script';
import { endsEvent, speakers } from './steps';
import { type Content, type ListPath, type Owner, allOwners, walkSteps } from './store';
import { WORLD, areaById, builtInFlags, eventUses, npcAreas } from './world';

export interface Problem {
  level: 'error' | 'warning';
  text: string;
  /** Where to go to fix it. */
  owner?: Owner;
  step?: { path: ListPath; index: number };
  /** An event the game expects but which doesn't exist: offer to create it. */
  missingEvent?: string;
  /** An NPC a map expects but which doesn't exist: offer to create it. */
  missingNpc?: string;
}

/** Flags set anywhere (by events or by the game itself). */
export function knownFlags(c: Content): string[] {
  const set = new Set(builtInFlags());
  for (const { steps } of allOwners(c)) walkSteps(steps, (s) => s.do === 'setFlag' && s.flag && set.add(s.flag));
  return [...set].sort();
}

/** Flags checked or set anywhere, for suggestions. */
export function allFlags(c: Content): string[] {
  const set = new Set(knownFlags(c));
  for (const { steps } of allOwners(c)) walkSteps(steps, (s) => s.do === 'if' && s.flag && set.add(s.flag));
  return [...set].sort();
}

export function validate(c: Content): Problem[] {
  const out: Problem[] = [];
  const who = new Set(speakers(c).map((s) => s.id));
  const flags = new Set(knownFlags(c));
  const allGroups = new Set(WORLD.areas.flatMap((a) => a.groups.map((g) => g.id)));

  for (const a of WORLD.areas) if (a.error) out.push({ level: 'error', text: `The map of ${a.name} can't be read: ${a.error}` });

  for (const { owner, steps } of allOwners(c)) {
    const name = owner.kind === 'event' ? `Event “${owner.id}”` : `${c.npcs[owner.id]?.name ?? owner.id}’s conversation`;
    // The areas this can play in, to check fights against. Unknown → any area.
    const areas = owner.kind === 'npc' ? npcAreas(owner.id).map((a) => a.id) : eventUses(owner.id).flatMap((u) => (u.area ? [u.area] : []));

    if (owner.kind === 'event' && !eventUses(owner.id).length) {
      out.push({ level: 'warning', owner, text: `${name} never plays: no story trigger, fight or area uses it.` });
    }
    if (!steps.length) out.push({ level: 'warning', owner, text: `${name} has no steps.` });

    const add = (level: Problem['level'], text: string, path: ListPath, index: number) =>
      out.push({ level, owner, step: { path, index }, text: `${name}: ${text}` });

    walkSteps(steps, (s: Step, path, i) => {
      switch (s.do) {
        case 'say':
          if (s.speaker && !who.has(s.speaker)) add('error', `unknown speaker “${s.speaker}”.`, path, i);
          if (!s.text.trim()) add('warning', 'a line with no text.', path, i);
          break;
        case 'choice':
          if (s.speaker && !who.has(s.speaker)) add('error', `unknown speaker “${s.speaker}”.`, path, i);
          if (!s.options.length) add('error', 'a choice with no answers.', path, i);
          if (s.options.some((o) => !o.label.trim())) add('warning', 'a choice has an empty answer.', path, i);
          if (s.options.length > 6) add('warning', 'more than 6 answers may not fit in the dialogue box.', path, i);
          break;
        case 'setFlag':
          if (!s.flag.trim()) add('error', '“Set flag” has no flag name.', path, i);
          break;
        case 'if':
          if (!s.flag.trim()) add('error', '“If flag” has no flag name.', path, i);
          else if (!flags.has(s.flag)) add('warning', `checks the flag “${s.flag}”, which nothing ever sets.`, path, i);
          break;
        case 'fight':
          if (!s.group) add('error', '“Start fight” has no enemy group.', path, i);
          else if (!allGroups.has(s.group)) add('error', `no area has an enemy group named “${s.group}”.`, path, i);
          else if (areas.length && !areas.some((a) => areaById(a)?.groups.some((g) => g.id === s.group))) {
            add('error', `the fight “${s.group}” isn't in ${areas.map((a) => areaById(a)?.name ?? a).join(' / ')}, where this plays.`, path, i);
          }
          break;
        case 'teleport': {
          const area = areaById(s.area);
          if (!area) add('error', `“Move party” goes to an unknown area “${s.area}”.`, path, i);
          else if (!area.starts.includes(s.at)) add('error', `${area.name} has no start point “${s.at}”.`, path, i);
          break;
        }
        case 'wait':
          if (!(s.ms > 0)) add('warning', 'a pause of 0 seconds.', path, i);
          break;
      }
    });

    // Steps after a fight / move / end never run.
    const checkUnreachable = (list: Step[], path: ListPath) => {
      const end = list.findIndex(endsEvent);
      if (end >= 0 && end < list.length - 1) add('warning', 'steps after “' + label(list[end]) + '” never run.', path, end + 1);
    };
    checkUnreachable(steps, []);
    walkSteps(steps, (s, path, i) => {
      if (s.do === 'choice') s.options.forEach((o, j) => checkUnreachable(o.steps, [...path, i, 'options', j, 'steps']));
      if (s.do === 'if') {
        checkUnreachable(s.then, [...path, i, 'then']);
        checkUnreachable(s.else, [...path, i, 'else']);
      }
    });
  }

  // What the maps expect.
  const events = c.story.events;
  if (!events.intro) out.push({ level: 'error', missingEvent: 'intro', text: 'There is no “intro” event (it plays when a new game starts).' });
  for (const a of WORLD.areas) {
    for (const t of a.triggers) if (!events[t]) out.push({ level: 'error', missingEvent: t, text: `${a.name} has a story trigger “${t}” but no event with that name.` });
    for (const g of a.groups) if (g.onWin && !events[g.onWin]) out.push({ level: 'error', missingEvent: g.onWin, text: `${a.name}: the fight “${g.id}” plays “${g.onWin}” after winning, but there's no such event.` });
    if (a.onEnter && !events[a.onEnter]) out.push({ level: 'error', missingEvent: a.onEnter, text: `${a.name} plays “${a.onEnter}” on arrival, but there's no such event.` });
    for (const n of a.npcs) if (!c.npcs[n]) out.push({ level: 'error', missingNpc: n, text: `${a.name} has an NPC “${n}” on its map, but no NPC with that id.` });
  }

  // Speaker ids must be unique across party, NPCs and other speakers.
  const seen = new Map<string, number>();
  for (const s of speakers(c)) seen.set(s.id, (seen.get(s.id) ?? 0) + 1);
  for (const [id, n] of seen) if (n > 1) out.push({ level: 'error', text: `More than one speaker has the id “${id}” (party, NPCs and other speakers share ids).` });

  return out;
}

function label(s: Step) {
  return s.do === 'fight' ? 'Start fight' : s.do === 'teleport' ? 'Move party' : 'End game';
}
