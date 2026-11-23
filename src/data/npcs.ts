/**
 * NPCS — characters in the world you can talk to (click them).
 *
 * The content lives in npcs.json, next to this file. Edit it with the Gambit Editor:
 * run `npm run dev` and open http://localhost:8080/editor.html (NPCs tab).
 *
 * Place an NPC on a map with the editor's NPC tool (Map tab); the area file lists them under `npcs`.
 * Their conversation (`talk`) is an event that plays each time you talk to them.
 */
import type { Step } from '../game/script';
import npcFile from './npcs.json';

export interface NpcDef {
  id: string;
  name: string;
  /** Placeholder look until real sprites exist. */
  color: number;
  talk: Step[];
}

/** The shape of npcs.json: id → NPC (colour as '#rrggbb'). */
export type NpcFile = Record<string, { name: string; color: string; talk: Step[] }>;

export const NPCS: Record<string, NpcDef> = {};

/**
 * Fills NPCS in place. Existing NPC objects are updated rather than replaced, so NPCs standing in the world
 * use the new conversation after a live update.
 */
function apply(file: NpcFile) {
  for (const id of Object.keys(NPCS)) if (!file[id]) delete NPCS[id];
  for (const [id, n] of Object.entries(file)) {
    const def: NpcDef = { id, name: n.name, color: parseInt(n.color.replace('#', ''), 16), talk: n.talk };
    if (NPCS[id]) Object.assign(NPCS[id], def);
    else NPCS[id] = def;
  }
}

apply(npcFile as unknown as NpcFile);

if (import.meta.hot) {
  import.meta.hot.accept('./npcs.json', (mod) => {
    const next = mod?.default as NpcFile | undefined;
    if (!next) return;
    // New NPCs or looks need new placeholder art, which is made at startup: reload the game for those.
    const looks = (f: Record<string, { color: string | number }>) =>
      JSON.stringify(Object.entries(f).map(([id, n]) => [id, typeof n.color === 'number' ? n.color : parseInt(n.color.slice(1), 16)]));
    if (looks(next) !== looks(NPCS)) return import.meta.hot?.invalidate('NPCs changed');
    apply(next);
    console.info('[npcs] updated from npcs.json');
  });
}
