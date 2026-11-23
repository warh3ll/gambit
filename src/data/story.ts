/**
 * STORY — the story events of the game, written with the steps from src/game/script.ts.
 *
 * PLACEHOLDER WRITING: the designer owns the story; rewrite anything here.
 *
 * Where events start:
 *  - 'intro' plays once when a new game starts.
 *  - Story triggers: a map character in an area's legend, e.g. `'1': { trigger: 'forestEdge' }`.
 *    A trigger's event plays once (when the leader steps on it), and is remembered once it has finished.
 *  - Fights: an area's `encounters` can name an event to play when that fight is won (`onWin`).
 *  - Areas: an area's `onEnter` event plays every time the party arrives (use ifFlag to play it once).
 *  - NPCs: their `talk` steps in src/data/npcs.ts play each time you talk to them.
 */
import { type Step, endGame, fight, narrate, say } from '../game/script';

/** Names for speakers who aren't party members or NPCs. */
export const SPEAKER_NAMES: Record<string, string> = {
  stranger: 'The Stranger',
};

export const EVENTS: Record<string, Step[]> = {
  intro: [
    narrate('For weeks, a stranger has been seen on the edge of Barrelsby.'),
    narrate(
      'He promises the townsfolk riches if they follow him into the woods. Some already have, and none have come back.',
    ),
    say('yasmi', 'Then we go to him. East road, into the woods.'),
    narrate('Click the ground to walk.   Press T to set the party\'s tactics. Fights play out on their own.'),
  ],

  forestEdge: [
    narrate('The road narrows as the trees close in. Fresh footprints lead east, many of them.'),
    say('hyne', 'Townsfolk. They walked this way willingly.'),
  ],

  meetStranger: [
    narrate('Ahead, in a clearing, a tall figure in a dark coat waits as if he expected company.'),
    say('stranger', 'More visitors from Barrelsby. Have you come to get rich, too?'),
    say('yasmi', 'We\'ve come to bring our people home.'),
    say('stranger', 'Then you\'ll have to take them from me.'),
    fight('stranger'),
  ],

  // Plays when the 'stranger' fight in barrelsbyRoad is won (see that area's `encounters`).
  strangerDefeated: [
    narrate('The Stranger falls. Deeper in the woods, voices: the missing townsfolk, dazed but alive.'),
    say('oxleth', 'He wasn\'t working alone. Someone gave him that power.'),
    endGame(),
  ],
};

/** The end screen after the slice. */
export const END_SCREEN = {
  title: 'End of the demo',
  text: 'Thanks for playing! The road from Barrelsby goes on…',
};
