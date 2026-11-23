import { MAX_TACTIC_ROWS } from '../config';
import { ACTIONS, type TacticRow, type TargetGroup, TARGETS, TYPES } from '../data/tactics';
import type { PartyMember } from '../world/PartyMember';

/**
 * Keeps edited tactics in the browser (localStorage) so they survive a reload.
 * Placeholder until there is a real save system.
 */
const STORAGE_KEY = 'gambit.tactics.v1';

type Saved = Record<string, TacticRow[]>;

/** Replaces each member's tactics with their saved rows, if any were saved. */
export function loadSavedTactics(members: PartyMember[]) {
  const saved = read();
  if (!saved) return;
  for (const m of members) {
    const rows = saved[m.id];
    if (!Array.isArray(rows)) continue;
    m.tactics = rows.filter((r) => isValidRow(m, r)).slice(0, MAX_TACTIC_ROWS).map((r) => ({ ...r }));
  }
}

/** Saves every member's current tactics. */
export function saveTactics(members: PartyMember[]) {
  const data: Saved = {};
  for (const m of members) data[m.id] = m.tactics;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage blocked or full: edits still apply for this session.
  }
}

function read(): Saved | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? (parsed as Saved) : null;
  } catch {
    return null;
  }
}

/** Drops rows that no longer make sense (e.g. a skill was renamed or removed since saving). */
function isValidRow(m: PartyMember, r: unknown): r is TacticRow {
  if (!r || typeof r !== 'object') return false;
  const { action, target, type, enabled } = r as Record<string, unknown>;
  if (typeof action !== 'string' || typeof target !== 'string' || typeof type !== 'string') return false;
  if (typeof enabled !== 'boolean') return false;
  if (!(action in ACTIONS) || !(target in TARGETS) || !(type in TYPES)) return false;
  if (!(m.def.actions as string[]).includes(action)) return false;
  const group = TARGETS[target as keyof typeof TARGETS].group;
  const actionGroups = ACTIONS[action as keyof typeof ACTIONS].groups as readonly TargetGroup[];
  const typeGroups = TYPES[type as keyof typeof TYPES].groups as readonly TargetGroup[];
  return actionGroups.includes(group) && typeGroups.includes(group);
}
