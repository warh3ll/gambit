/**
 * NPCS — characters in the world you can talk to (click them).
 * Place them on a map with a marker in the area's legend: e.g. `m: { npc: 'marta' }`.
 * `talk` is an event (steps from src/game/script.ts) that plays each time you talk to them.
 *
 * PLACEHOLDER WRITING: rewrite freely.
 */
import { type Step, choice, heal, ifNotFlag, narrate, say, setFlag } from '../game/script';

export interface NpcDef {
  id: string;
  name: string;
  /** Placeholder look until real sprites exist. */
  color: number;
  talk: Step[];
}

export const NPCS: Record<string, NpcDef> = {
  villager: {
    id: 'villager',
    name: 'Worried Villager',
    color: 0x9a7a5a,
    talk: [
      say('villager', 'My cousin went into the woods with that stranger three days ago. Not a word since.'),
      say('villager', 'If you\'re going east, please, bring him back.'),
    ],
  },
  marta: {
    id: 'marta',
    name: 'Old Marta',
    color: 0xb8a0c8,
    talk: [
      ifNotFlag(
        'metMarta',
        [
          say('marta', 'Come in, come in. Mind the stools.'),
          say('marta', 'That stranger knocked on my door too. Said I\'d never want for anything again.'),
          say('marta', 'I told him I already don\'t. He didn\'t like that.'),
          setFlag('metMarta'),
        ],
        [say('marta', 'Back again? The kettle\'s always on.')],
      ),
      choice(
        'Anything I can do for you?',
        [
          ['Could we rest here a while?', [say('marta', 'Of course. Sit, all of you.'), heal(), narrate('The party rests. Everyone is back to full health.')]],
          ['Where did the stranger go?', [say('marta', 'East, down the road and into the woods. Where else do people vanish?')]],
          ['Nothing, thank you.', [say('marta', 'Mind how you go.')]],
        ],
        'marta',
      ),
    ],
  },
};
