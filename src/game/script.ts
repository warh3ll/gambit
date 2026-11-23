/**
 * EVENT SCRIPTING — the building blocks for story events, NPC conversations and quests.
 *
 * An event is a list of steps that run in order:
 *
 *   [
 *     narrate('The road narrows.'),
 *     say('hyne', 'Townsfolk. They walked this way willingly.'),
 *     choice('Follow the tracks?', [
 *       ['Yes', [setFlag('followedTracks')]],
 *       ['Not yet', []],
 *     ]),
 *   ]
 *
 * The player can't move while an event runs (except during a fight it starts).
 */
import type { FlagValue } from './save';

export type Step =
  | { do: 'say'; speaker?: string; text: string }
  | { do: 'choice'; speaker?: string; prompt: string; options: { label: string; steps: Step[] }[] }
  | { do: 'setFlag'; flag: string; value: FlagValue }
  | { do: 'if'; flag: string; equals: FlagValue; then: Step[]; else: Step[] }
  | { do: 'fight'; group: string }
  | { do: 'heal' }
  | { do: 'teleport'; area: string; at: string }
  | { do: 'wait'; ms: number }
  | { do: 'endGame' };

/** A line of dialogue, with the speaker's headshot. Speaker: a party member, an NPC id, or 'stranger'. */
export const say = (speaker: string, text: string): Step => ({ do: 'say', speaker, text });

/** Narration: text with no speaker. */
export const narrate = (text: string): Step => ({ do: 'say', text });

/**
 * The player picks an answer; that answer's steps run, then the event carries on after the choice.
 * Optionally said by someone: choice('Will you help?', [...], 'marta').
 */
export const choice = (prompt: string, options: [label: string, steps: Step[]][], speaker?: string): Step => ({
  do: 'choice',
  speaker,
  prompt,
  options: options.map(([label, steps]) => ({ label, steps })),
});

/** Remembers something (saved with the game). */
export const setFlag = (flag: string, value: FlagValue = true): Step => ({ do: 'setFlag', flag, value });

/** Runs `then` if the flag is set (or equals `equals`), otherwise `otherwise`. */
export const ifFlag = (flag: string, then: Step[], otherwise: Step[] = [], equals: FlagValue = true): Step => ({
  do: 'if',
  flag,
  equals,
  then,
  else: otherwise,
});

/** Runs `then` if the flag is NOT set. */
export const ifNotFlag = (flag: string, then: Step[], otherwise: Step[] = []): Step => ifFlag(flag, otherwise, then);

/**
 * Starts the fight with a named enemy group in this area (see `encounters` in the area file).
 * The event ends here: what happens after winning goes in that group's `onWin` event.
 * (If the party loses, they retry from just before the fight, or walk away and come back.)
 */
export const fight = (group: string): Step => ({ do: 'fight', group });

/** Restores the whole party to full HP (and gets the fallen back up). */
export const heal = (): Step => ({ do: 'heal' });

/** Moves the party to another area (or another spot in this one), arriving at start point `at`. */
export const teleport = (area: string, at: string): Step => ({ do: 'teleport', area, at });

/** A pause, in milliseconds. */
export const wait = (ms: number): Step => ({ do: 'wait', ms });

/** Ends the game (the slice): shows the end screen. */
export const endGame = (): Step => ({ do: 'endGame' });

// Coming with later milestones: addMember / removeMember (M12), giveXp (M13), giveItem (M15), quest steps (M16).
