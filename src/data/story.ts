/**
 * STORY — all dialogue and story text for the vertical slice.
 *
 * PLACEHOLDER WRITING: the designer owns the story; rewrite anything here.
 *
 * A line is { speaker, text }. Leave `speaker` out for narration.
 * Speakers: 'yasmi' | 'hyne' | 'oxleth' | 'arthur' | 'telara' | 'stranger'.
 */

export type SpeakerId = 'yasmi' | 'hyne' | 'oxleth' | 'arthur' | 'telara' | 'stranger';

export interface Line {
  speaker?: SpeakerId;
  text: string;
}

/** Names for speakers who aren't party members. */
export const SPEAKER_NAMES: Partial<Record<SpeakerId, string>> = {
  stranger: 'The Stranger',
};

/** Shown when the game starts. */
export const INTRO: Line[] = [
  { text: 'For weeks, a stranger has been seen on the edge of Barrelsby.' },
  {
    text: 'He promises the townsfolk riches if they follow him into the woods. Some already have, and none have come back.',
  },
  { speaker: 'yasmi', text: 'Then we go to him. East road, into the woods.' },
  { text: 'Click the ground to walk.   Press T to set the party\'s tactics. Fights play out on their own.' },
];

export interface StoryTrigger {
  lines: Line[];
  /** After the lines, the nearest enemy group attacks. */
  startsFight?: boolean;
}

/**
 * Story triggers: the digit is placed on tiles in the map (src/data/maps/).
 * Each plays once, when the party leader steps on one of its tiles.
 */
export const TRIGGERS: Record<string, StoryTrigger> = {
  '1': {
    lines: [
      { text: 'The road narrows as the trees close in. Fresh footprints lead east, many of them.' },
      { speaker: 'hyne', text: 'Townsfolk. They walked this way willingly.' },
    ],
  },
  '2': {
    startsFight: true,
    lines: [
      { text: 'Ahead, in a clearing, a tall figure in a dark coat waits as if he expected company.' },
      { speaker: 'stranger', text: 'More visitors from Barrelsby. Have you come to get rich, too?' },
      { speaker: 'yasmi', text: 'We\'ve come to bring our people home.' },
      { speaker: 'stranger', text: 'Then you\'ll have to take them from me.' },
    ],
  },
};

/** Plays when The Stranger is defeated, before the end screen. */
export const ENDING: Line[] = [
  { text: 'The Stranger falls. Deeper in the woods, voices: the missing townsfolk, dazed but alive.' },
  { speaker: 'oxleth', text: 'He wasn\'t working alone. Someone gave him that power.' },
];

/** The end screen after the slice. */
export const END_SCREEN = {
  title: 'End of the demo',
  text: 'Thanks for playing! The road from Barrelsby goes on…',
};
