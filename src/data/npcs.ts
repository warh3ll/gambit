/**
 * NPCS — characters in the world you can talk to (click them).
 * Place them on a map with a marker in the area's legend: e.g. `m: { npc: 'marta' }`.
 *
 * PLACEHOLDER WRITING: rewrite freely. Until event scripting (M11), talking to an NPC plays their `lines`.
 */
import type { Line } from './story';

export interface NpcDef {
  id: string;
  name: string;
  /** Placeholder look until real sprites exist. */
  color: number;
  lines: Line[];
}

export const NPCS: Record<string, NpcDef> = {
  villager: {
    id: 'villager',
    name: 'Worried Villager',
    color: 0x9a7a5a,
    lines: [
      { speaker: 'villager', text: 'My cousin went into the woods with that stranger three days ago. Not a word since.' },
      { speaker: 'villager', text: 'If you\'re going east, please, bring him back.' },
    ],
  },
  marta: {
    id: 'marta',
    name: 'Old Marta',
    color: 0xb8a0c8,
    lines: [
      { speaker: 'marta', text: 'Come in, come in. Mind the stools.' },
      { speaker: 'marta', text: 'That stranger knocked on my door too. Said I\'d never want for anything again.' },
      { speaker: 'marta', text: 'I told him I already don\'t. He didn\'t like that.' },
    ],
  },
};
