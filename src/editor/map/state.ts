/**
 * The map painter's own state (not part of the content): the tool in hand, the tile / NPC / enemy picked for it,
 * what's selected on the map, zoom and grid. Tool, picks, zoom and grid are remembered in the browser.
 */
import { useEffect, useState } from 'preact/hooks';
import { getNav, onNav } from '../nav';

export type Tool = 'select' | 'brush' | 'rect' | 'fill' | 'start' | 'exit' | 'npc' | 'enemy' | 'trigger' | 'play';

/** Something placed on the map. Starts are named; everything else is an index in its list. */
export type Selection = { kind: 'start'; name: string } | { kind: 'exit' | 'npc' | 'enemy' | 'trigger'; index: number };

export interface MapUi {
  tool: Tool;
  /** Map character of the tile the brush, rectangle and fill paint with. */
  tile: string;
  /** NPC id the NPC tool places. */
  npc: string;
  /** Enemy type the enemy tool places. */
  enemy: string;
  selection: Selection | null;
  zoom: number;
  grid: boolean;
  labels: boolean;
  /** A tile to scroll into view (set when jumping to a problem), consumed by the map view. */
  focus: { x: number; y: number } | null;
}

const PREFS_KEY = 'gambit-editor-map';
export const ZOOMS = [1, 2, 3, 4, 5, 6];

function loadPrefs(): Partial<MapUi> {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as Partial<MapUi>;
  } catch {
    return {};
  }
}

const prefs = loadPrefs();
let ui: MapUi = {
  tool: prefs.tool ?? 'select',
  tile: prefs.tile ?? '.',
  npc: prefs.npc ?? '',
  enemy: prefs.enemy ?? 'wolf',
  selection: null,
  zoom: ZOOMS.includes(prefs.zoom ?? 0) ? prefs.zoom! : 3,
  grid: prefs.grid ?? true,
  labels: prefs.labels ?? true,
  focus: null,
};

const listeners = new Set<() => void>();

export function setUi(patch: Partial<MapUi>) {
  ui = { ...ui, ...patch };
  try {
    const { tool, tile, npc, enemy, zoom, grid, labels } = ui;
    localStorage.setItem(PREFS_KEY, JSON.stringify({ tool, tile, npc, enemy, zoom, grid, labels }));
  } catch {
    // Storage unavailable: preferences are a convenience only.
  }
  for (const l of listeners) l();
}

export const getUi = () => ui;

export function useMapUi(): MapUi {
  const [, bump] = useState(0);
  useEffect(() => {
    const l = () => bump((n) => n + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  return ui;
}

export const select = (selection: Selection | null) => setUi({ selection });

// A selection belongs to one area: drop it when another area (or tab) is opened.
let opened = `${getNav().tab}/${getNav().id}`;
onNav(() => {
  const now = `${getNav().tab}/${getNav().id}`;
  if (now === opened) return;
  opened = now;
  if (ui.selection) setUi({ selection: null });
});

export const sameSelection = (a: Selection | null, b: Selection | null) =>
  !!a && !!b && a.kind === b.kind && (a.kind === 'start' ? a.name === (b as typeof a).name : a.index === (b as { index: number }).index);
