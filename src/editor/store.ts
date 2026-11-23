/**
 * The editor's state: the content being edited (story.json + npcs.json), undo/redo, saving to the dev server,
 * and a draft in the browser so unsaved work survives a reload.
 */
import { useEffect, useState } from 'preact/hooks';
import type { NpcFile } from '../data/npcs';
import type { StoryFile } from '../data/story';
import type { Step } from '../game/script';

export interface Content {
  story: StoryFile;
  npcs: NpcFile;
}
export type FileKey = keyof Content;
const FILE_KEYS: FileKey[] = ['story', 'npcs'];
export const FILE_NAMES: Record<FileKey, string> = { story: 'src/data/story.json', npcs: 'src/data/npcs.json' };

/** Whose steps: an event in story.json or an NPC's conversation. */
export type Owner = { kind: 'event'; id: string } | { kind: 'npc'; id: string };
/** Path from an owner's step list to a nested list: e.g. [] (top), [2, 'then'], [1, 'options', 0, 'steps']. */
export type ListPath = (string | number)[];

export type Banner = { kind: 'info' | 'error' | 'conflict' | 'draft'; text: string; files?: FileKey[] } | null;

interface State {
  status: 'loading' | 'ready' | 'saving' | 'failed';
  content: Content;
  /** What's on disk (JSON text per file), to know what's unsaved. */
  saved: Record<FileKey, string>;
  hashes: Record<FileKey, string>;
  past: Content[];
  future: Content[];
  banner: Banner;
  /** A draft found in the browser at startup, waiting for the designer to restore or discard it. */
  pendingDraft: Content | null;
}

const empty: Content = { story: { speakers: {}, endScreen: { title: '', text: '' }, events: {} }, npcs: {} };
let state: State = {
  status: 'loading',
  content: empty,
  saved: { story: '', npcs: '' },
  hashes: { story: '', npcs: '' },
  past: [],
  future: [],
  banner: null,
  pendingDraft: null,
};

const listeners = new Set<() => void>();
function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

/** Re-renders the component whenever the state changes. */
export function useStore(): State {
  const [, bump] = useState(0);
  useEffect(() => {
    const l = () => bump((n) => n + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  return state;
}
export const getState = () => state;

// ── changes & undo ──

let lastKey: string | undefined;
let lastTime = 0;

/**
 * Changes the content. `fn` gets a copy to change in place.
 * Changes with the same `coalesce` key in quick succession (typing) become one undo step.
 */
export function commit(fn: (c: Content) => void, coalesce?: string) {
  const next = structuredClone(state.content);
  fn(next);
  const now = performance.now();
  const merge = coalesce !== undefined && coalesce === lastKey && now - lastTime < 1500;
  lastKey = coalesce;
  lastTime = now;
  const past = merge ? state.past : [...state.past, state.content].slice(-300);
  set({ content: next, past, future: [] });
  writeDraft();
}

export function undo() {
  const prev = state.past.at(-1);
  if (!prev) return;
  lastKey = undefined;
  set({ content: prev, past: state.past.slice(0, -1), future: [state.content, ...state.future] });
  writeDraft();
}

export function redo() {
  const next = state.future[0];
  if (!next) return;
  lastKey = undefined;
  set({ content: next, past: [...state.past, state.content], future: state.future.slice(1) });
  writeDraft();
}

export const dirtyFiles = (s: State = state): FileKey[] => FILE_KEYS.filter((k) => JSON.stringify(s.content[k]) !== s.saved[k]);

export const setBanner = (banner: Banner) => set({ banner });

// ── loading & saving ──

type Loaded = Record<FileKey, { data: unknown; hash: string }>;

async function fetchContent(): Promise<Loaded> {
  const res = await fetch('/__editor/content', { cache: 'no-store' });
  if (!res.ok) throw new Error(`The dev server said ${res.status}. Is it running (npm run dev)?`);
  return ((await res.json()) as { files: Loaded }).files;
}

export async function load() {
  try {
    const files = await fetchContent();
    const content = { story: files.story.data, npcs: files.npcs.data } as Content;
    const saved = { story: JSON.stringify(content.story), npcs: JSON.stringify(content.npcs) };
    const hashes = { story: files.story.hash, npcs: files.npcs.hash };
    set({ status: 'ready', content, saved, hashes, past: [], future: [] });
    offerDraft();
  } catch (err) {
    set({ status: 'failed', banner: { kind: 'error', text: `Couldn't load the game's content. ${message(err)}` } });
  }
}

/** Saves every changed file. With `overwrite`, saves even if a file was changed outside the editor. */
export async function save(overwrite = false) {
  const dirty = dirtyFiles();
  if (!dirty.length || state.status === 'saving') return;
  set({ status: 'saving' });
  try {
    const hashes = { ...state.hashes };
    if (overwrite) {
      const disk = await fetchContent();
      for (const k of dirty) hashes[k] = disk[k].hash;
    }
    const files = Object.fromEntries(dirty.map((k) => [k, { data: state.content[k], base: hashes[k] }]));
    const res = await fetch('/__editor/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files }),
    });
    const body = (await res.json()) as { files?: Record<string, { hash: string }>; conflicts?: FileKey[]; error?: string };
    if (res.status === 409 && body.conflicts) {
      const names = body.conflicts.map((k) => FILE_NAMES[k]).join(' and ');
      set({
        status: 'ready',
        banner: {
          kind: 'conflict',
          files: body.conflicts,
          text: `${names} changed outside the editor since you opened it. Saving now would overwrite those changes.`,
        },
      });
      return;
    }
    if (!res.ok || !body.files) throw new Error(body.error ?? `the dev server said ${res.status}`);
    const saved = { ...state.saved };
    for (const k of dirty) {
      saved[k] = JSON.stringify(state.content[k]);
      hashes[k] = body.files[k].hash;
    }
    set({ status: 'ready', saved, hashes, banner: null });
    writeDraft();
  } catch (err) {
    set({ status: 'ready', banner: { kind: 'error', text: `Saving failed: ${message(err)}` } });
  }
}

/** Throws away unsaved changes and loads what's on disk. */
export async function reloadFromDisk() {
  clearDraft();
  set({ banner: null, pendingDraft: null });
  await load();
}

// ── draft in the browser ──

const DRAFT_KEY = 'gambit-editor-draft';

function writeDraft() {
  try {
    if (dirtyFiles().length) localStorage.setItem(DRAFT_KEY, JSON.stringify({ content: state.content, hashes: state.hashes }));
    else localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Storage unavailable: the draft is a convenience only.
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

/** At startup: if the browser holds unsaved changes from last time, restore them (or ask, if the files changed since). */
function offerDraft() {
  let draft: { content: Content; hashes: Record<FileKey, string> } | null = null;
  try {
    draft = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null');
  } catch {
    draft = null;
  }
  if (!draft?.content?.story || !draft.content.npcs) return;
  const differs = FILE_KEYS.some((k) => JSON.stringify(draft.content[k]) !== state.saved[k]);
  if (!differs) return clearDraft();
  const sameBase = FILE_KEYS.every((k) => draft.hashes?.[k] === state.hashes[k]);
  if (sameBase) {
    set({ content: draft.content, past: [state.content], banner: { kind: 'info', text: 'Restored your unsaved changes from last time.' } });
  } else {
    set({
      pendingDraft: draft.content,
      banner: { kind: 'draft', text: 'You have unsaved changes from last time, but the files have changed since then.' },
    });
  }
}

export function restoreDraft() {
  if (!state.pendingDraft) return;
  set({ content: state.pendingDraft, past: [state.content], future: [], pendingDraft: null, banner: null });
  writeDraft();
}

export function discardDraft() {
  clearDraft();
  set({ pendingDraft: null, banner: null });
}

// ── step lists ──

/** The top-level steps of an owner (an event or an NPC's conversation). */
export function rootSteps(c: Content, owner: Owner): Step[] {
  return owner.kind === 'event' ? (c.story.events[owner.id] ?? []) : (c.npcs[owner.id]?.talk ?? []);
}

/** The list at `path` inside `root`. */
export function listAt(root: Step[], path: ListPath): Step[] {
  let cur: unknown = root;
  for (const seg of path) cur = (cur as Record<string | number, unknown>)?.[seg];
  return Array.isArray(cur) ? (cur as Step[]) : [];
}

export function editSteps(owner: Owner, fn: (root: Step[]) => void, coalesce?: string) {
  commit((c) => fn(rootSteps(c, owner)), coalesce);
}

/** Moves a step, also between nested lists (but never into itself). */
export function moveStep(owner: Owner, from: { path: ListPath; index: number }, to: { path: ListPath; index: number }) {
  const own = [...from.path, from.index];
  if (own.every((seg, i) => to.path[i] === seg) && to.path.length >= own.length) return;
  if (samePath(from.path, to.path) && (to.index === from.index || to.index === from.index + 1)) return;
  editSteps(owner, (root) => {
    const src = listAt(root, from.path);
    const dst = listAt(root, to.path);
    const [item] = src.splice(from.index, 1);
    let index = to.index;
    if (src === dst && from.index < index) index--;
    dst.splice(index, 0, item);
  });
}

export const samePath = (a: ListPath, b: ListPath) => a.length === b.length && a.every((s, i) => s === b[i]);

/** Calls `fn` for every step in a list, nested ones included, with the path of the list each sits in. */
export function walkSteps(steps: Step[], fn: (step: Step, path: ListPath, index: number) => void, path: ListPath = []) {
  steps.forEach((step, i) => {
    fn(step, path, i);
    if (step.do === 'choice') step.options.forEach((o, j) => walkSteps(o.steps, fn, [...path, i, 'options', j, 'steps']));
    if (step.do === 'if') {
      walkSteps(step.then, fn, [...path, i, 'then']);
      walkSteps(step.else, fn, [...path, i, 'else']);
    }
  });
}

/** Every step list in the content, with its owner. */
export function allOwners(c: Content): { owner: Owner; steps: Step[] }[] {
  return [
    ...Object.entries(c.story.events).map(([id, steps]) => ({ owner: { kind: 'event', id } as Owner, steps })),
    ...Object.entries(c.npcs).map(([id, n]) => ({ owner: { kind: 'npc', id } as Owner, steps: n.talk })),
  ];
}

function message(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}
