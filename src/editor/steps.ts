/** The kinds of step the editor offers, with their names, colours and a fresh example of each. */
import type { FlagValue } from '../game/save';
import type { Step } from '../game/script';
import type { Content } from './store';
import { WORLD } from './world';

export interface StepKind {
  id: string;
  label: string;
  hint: string;
  /** Accent colour of the step's card. */
  color: string;
  make: () => Step;
}

export const STEP_KINDS: StepKind[] = [
  { id: 'line', label: 'Line', hint: 'Someone says something', color: '#f2d16b', make: () => ({ do: 'say', speaker: 'yasmi', text: '' }) },
  { id: 'narrate', label: 'Narration', hint: 'Text with no speaker', color: '#b8b0cc', make: () => ({ do: 'say', text: '' }) },
  {
    id: 'choice',
    label: 'Choice',
    hint: 'The player picks an answer',
    color: '#7fb8e6',
    make: () => ({ do: 'choice', prompt: '', options: [{ label: 'Yes', steps: [] }, { label: 'No', steps: [] }] }),
  },
  {
    id: 'if',
    label: 'If flag',
    hint: 'Only do something if…',
    color: '#c58cff',
    make: () => ({ do: 'if', flag: '', equals: true, then: [], else: [] }),
  },
  { id: 'setFlag', label: 'Set flag', hint: 'Remember that something happened', color: '#c58cff', make: () => ({ do: 'setFlag', flag: '', value: true }) },
  { id: 'fight', label: 'Start fight', hint: 'Fight a named enemy group', color: '#e8705a', make: () => ({ do: 'fight', group: '' }) },
  { id: 'heal', label: 'Heal party', hint: 'Everyone back to full HP', color: '#7cd67c', make: () => ({ do: 'heal' }) },
  { id: 'wait', label: 'Pause', hint: 'Wait a moment', color: '#8a82a0', make: () => ({ do: 'wait', ms: 1000 }) },
  {
    id: 'teleport',
    label: 'Move party',
    hint: 'To another area or spot',
    color: '#5ac8b8',
    make: () => ({ do: 'teleport', area: WORLD.startArea, at: 'default' }),
  },
  { id: 'endGame', label: 'End game', hint: 'Show the end screen', color: '#e8705a', make: () => ({ do: 'endGame' }) },
];

export function kindOf(step: Step): StepKind {
  const id = step.do === 'say' ? (step.speaker ? 'line' : 'narrate') : step.do;
  return STEP_KINDS.find((k) => k.id === id) ?? STEP_KINDS[0];
}

/** Steps that end the event: nothing after them in the same list runs. */
export const endsEvent = (step: Step) => step.do === 'fight' || step.do === 'teleport' || step.do === 'endGame';

// ── speakers ──

export interface Speaker {
  id: string;
  name: string;
  color: number;
  kind: 'party' | 'npc' | 'other';
}

export function speakers(c: Content): Speaker[] {
  return [
    ...WORLD.party.map((p) => ({ ...p, kind: 'party' as const })),
    ...Object.entries(c.npcs).map(([id, n]) => ({ id, name: n.name, color: hex(n.color), kind: 'npc' as const })),
    ...Object.entries(c.story.speakers).map(([id, s]) => ({ id, name: s.name, color: hex(s.color), kind: 'other' as const })),
  ];
}

export const hex = (color: string) => parseInt(color.replace('#', ''), 16) || 0;

// ── flags ──

/** How a flag value reads: true → "yes". */
export function flagValueText(v: FlagValue) {
  if (v === true) return 'yes';
  if (v === false) return 'no';
  return typeof v === 'string' ? `“${v}”` : String(v);
}

/** One line describing a step, used in lists and search. */
export function stepText(step: Step): string {
  switch (step.do) {
    case 'say':
      return step.text;
    case 'choice':
      return [step.prompt, ...step.options.map((o) => o.label)].join(' ');
    case 'setFlag':
    case 'if':
      return step.flag;
    case 'fight':
      return step.group;
    case 'teleport':
      return `${step.area} ${step.at}`;
    default:
      return '';
  }
}

/** A valid id for a new thing: `base`, `base2`, `base3`… */
export function freshId(base: string, taken: (id: string) => boolean) {
  if (!taken(base)) return base;
  for (let n = 2; ; n++) if (!taken(`${base}${n}`)) return `${base}${n}`;
}

/** Ids are used in the game's files and flags: letters, digits and _ only, starting with a letter. */
export const ID_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;
