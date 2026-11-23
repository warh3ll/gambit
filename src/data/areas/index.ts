/**
 * AREAS — every area of the world, one file per area in this folder (<id>.json).
 *
 * Make and change areas with the Gambit Editor: run `npm run dev` and open http://localhost:8080/editor.html (Map tab).
 * Any .json file in this folder is an area; the file name is its id. Where a new game starts is set in story.json
 * (`newGame`), also from the editor.
 *
 * In dev, saving an area updates the running game: if the party is in that area, it reloads in place
 * (once no fight or dialogue is going on).
 */
import { NEW_GAME } from '../story';
import type { AreaDef, AreaFile } from './types';

const files = import.meta.glob<AreaFile>('./*.json', { eager: true, import: 'default' });

/** Kept across live updates (dev), so everything holding these sees the new maps. */
const kept = import.meta.hot?.data as { areas?: Record<string, AreaDef>; listeners?: Set<(id: string) => void> } | undefined;

/** This run is a live update (not the first load). */
const isUpdate = !!kept?.areas;

export const AREAS: Record<string, AreaDef> = kept?.areas ?? {};
const listeners: Set<(id: string) => void> = kept?.listeners ?? new Set();

function apply() {
  const before = new Map(Object.entries(AREAS).map(([id, a]) => [id, JSON.stringify(a)]));
  for (const id of Object.keys(AREAS)) delete AREAS[id];
  for (const [path, file] of Object.entries(files)) {
    const id = path.slice(2, -'.json'.length);
    AREAS[id] = { ...file, id };
  }
  const changed = [...new Set([...before.keys(), ...Object.keys(AREAS)])].filter((id) => before.get(id) !== JSON.stringify(AREAS[id]));
  return changed;
}

const changed = apply();

/** The area a new game starts in. */
export const startArea = () => (AREAS[NEW_GAME.area] ? NEW_GAME.area : Object.keys(AREAS)[0]);

export function getArea(id: string): AreaDef {
  return AREAS[id] ?? AREAS[startArea()];
}

/** Calls `fn` with an area's id when its file changes (dev only). Returns a function that stops listening. */
export function onAreaChanged(fn: (id: string) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

if (import.meta.hot) {
  // Written out in full: Vite looks for exactly `import.meta.hot.accept(` to know this module updates itself.
  import.meta.hot.accept();
  import.meta.hot.data.areas = AREAS;
  import.meta.hot.data.listeners = listeners;
  if (isUpdate && changed.length) {
    console.info(`[areas] updated: ${changed.join(', ')}`);
    for (const id of changed) for (const l of listeners) l(id);
  }
}
