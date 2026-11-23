/**
 * STORY — the story events of the game.
 *
 * The content lives in story.json, next to this file. Edit it with the Gambit Editor:
 * run `npm run dev` and open http://localhost:8080/editor.html (Events tab).
 *
 * Where events start (all set up on the editor's Map tab):
 *  - 'intro' plays once when a new game starts (in the area `newGame.area`).
 *  - Story triggers: a rectangle on a map. A trigger's event plays once (when the leader steps in it),
 *    and is remembered once it has finished.
 *  - Fights: a named enemy group can play an event when the fight is won (`onWin`).
 *  - Areas: an area's `onEnter` event plays every time the party arrives (use an "if flag" step to play it once).
 *  - NPCs: their conversation (npcs.json) plays each time you talk to them.
 *
 * In dev, saving story.json updates the running game straight away: the next line you see uses the new text.
 */
import type { Step } from '../game/script';
import storyFile from './story.json';

/** A speaker who isn't a party member or an NPC (e.g. the Stranger). */
export interface SpeakerDef {
  name: string;
  /** Placeholder headshot colour, '#rrggbb', until real art exists (src/data/art.ts). */
  color: string;
}

/** The shape of story.json. */
export interface StoryFile {
  /** Where a new game starts: the area's 'default' start point. */
  newGame: { area: string };
  speakers: Record<string, SpeakerDef>;
  endScreen: { title: string; text: string };
  events: Record<string, Step[]>;
}

export const EVENTS: Record<string, Step[]> = {};
export const SPEAKERS: Record<string, SpeakerDef> = {};
/** The end screen after the slice. */
export const END_SCREEN = { title: '', text: '' };
/** Where a new game starts (see src/data/areas/index.ts). */
export const NEW_GAME = { area: '' };

/** Fills the exports in place, so everything holding them sees new content after a live update. */
function apply(file: StoryFile) {
  replaceAll(EVENTS, file.events);
  replaceAll(SPEAKERS, file.speakers);
  Object.assign(END_SCREEN, file.endScreen);
  Object.assign(NEW_GAME, file.newGame);
}

function replaceAll<T>(target: Record<string, T>, source: Record<string, T>) {
  for (const k of Object.keys(target)) delete target[k];
  Object.assign(target, source);
}

apply(storyFile as unknown as StoryFile);

if (import.meta.hot) {
  import.meta.hot.accept('./story.json', (mod) => {
    const next = mod?.default as StoryFile | undefined;
    if (!next) return;
    // New speakers or looks need new placeholder art, which is made at startup: reload the game for those.
    if (looks(next.speakers) !== looks(SPEAKERS)) return import.meta.hot?.invalidate('speakers changed');
    apply(next);
    console.info('[story] updated from story.json');
  });
}

function looks(speakers: Record<string, SpeakerDef>) {
  return JSON.stringify(Object.entries(speakers).map(([id, s]) => [id, s.color]));
}
