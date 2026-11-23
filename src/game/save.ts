import { MAX_TACTIC_ROWS } from '../config';
import { START_AREA } from '../data/areas';
import { type CharacterDef, DEFAULT_LEADER_ID, PARTY } from '../data/party';
import { ACTIONS, type TacticRow, type TargetGroup, TARGETS, TYPES } from '../data/tactics';

/**
 * THE SAVE GAME — everything that changes during play, autosaved to the browser (localStorage).
 * One save. Bump SAVE_VERSION and add a step to `migrate` whenever the shape changes,
 * so existing saves keep working.
 */
export const SAVE_VERSION = 2;
const STORAGE_KEY = 'gambit.save';
/** M5 stored only tactics under this key; it's folded into the save on first load. */
const OLD_TACTICS_KEY = 'gambit.tactics.v1';

export type FlagValue = boolean | number | string;

export interface MemberSave {
  /** Met and available (roster). */
  unlocked: boolean;
  /** In the active party (vs. on the sidelines). */
  active: boolean;
  hp: number;
  /** Placeholders until XP & levels (M13). */
  xp: number;
  level: number;
  tactics: TacticRow[];
}

export interface SaveData {
  version: number;
  /** When it was written (ms since epoch). */
  savedAt: number;
  /** Which area the party is in. */
  area: string;
  /** Leader position in that area, or null for the area's start point. */
  position: { x: number; y: number } | null;
  leaderId: string;
  /** Story flags: e.g. 'introPlayed', 'story.meetStranger', 'sliceComplete'. */
  flags: Record<string, FlagValue>;
  /** Unique encounter groups beaten for good, as '<area>/<group id>'. (Other groups respawn.) */
  beaten: string[];
  members: Record<string, MemberSave>;
}

/** A fresh game: the starting party, nothing done yet. */
export function newSaveData(): SaveData {
  const members: Record<string, MemberSave> = {};
  for (const def of PARTY) members[def.id] = defaultMember(def);
  return {
    version: SAVE_VERSION,
    savedAt: 0,
    area: START_AREA,
    position: null,
    leaderId: DEFAULT_LEADER_ID,
    flags: {},
    beaten: [],
    members,
  };
}

export function hasSave(): boolean {
  return readRaw(STORAGE_KEY) !== null;
}

/** Reads the save, upgraded to the current version and cleaned up. Null if there is none (or it's unreadable). */
export function loadSave(): SaveData | null {
  const raw = readRaw(STORAGE_KEY);
  if (raw === null) return null;
  try {
    return sanitize(migrate(JSON.parse(raw)));
  } catch {
    return null;
  }
}

/** Starts over: erases the save. Tactics saved by an older build (M5) carry over into the new game. */
export function startNewGame(): SaveData {
  const data = newSaveData();
  const oldTactics = readRaw(OLD_TACTICS_KEY);
  if (oldTactics) {
    try {
      const saved = JSON.parse(oldTactics) as Record<string, unknown>;
      for (const def of PARTY) {
        if (Array.isArray(saved[def.id])) data.members[def.id].tactics = validTactics(def, saved[def.id] as unknown[]);
      }
    } catch {
      // ignore a broken old save
    }
    removeRaw(OLD_TACTICS_KEY);
  }
  writeSave(data);
  return data;
}

export function writeSave(data: SaveData) {
  data.version = SAVE_VERSION;
  data.savedAt = Date.now();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage blocked or full: the game keeps running, it just won't be saved.
  }
}

/** Keeps only tactic rows that are valid for this character (drops rows for removed or unknown skills). */
export function validTactics(def: CharacterDef, rows: unknown[]): TacticRow[] {
  return rows.filter((r): r is TacticRow => isValidRow(def, r)).slice(0, MAX_TACTIC_ROWS).map((r) => ({ ...r }));
}

// ── internals ──

/** Upgrades older saves step by step. Add a case for each new version. */
function migrate(data: { version?: number }): SaveData {
  const version = data.version ?? 0;
  if (version > SAVE_VERSION) throw new Error('save is from a newer version of the game');
  const d = data as SaveData;
  if (version < 2) {
    // v2: story triggers are named instead of numbered.
    const renamed: Record<string, string> = {
      'trigger.barrelsbyRoad.1': 'story.forestEdge',
      'trigger.barrelsbyRoad.2': 'story.meetStranger',
    };
    for (const [from, to] of Object.entries(renamed)) {
      if (d.flags?.[from] !== undefined) {
        d.flags[to] = d.flags[from];
        delete d.flags[from];
      }
    }
  }
  return d;
}

/** Fills in anything missing and drops anything invalid, so a damaged or outdated save still loads. */
function sanitize(d: SaveData): SaveData {
  const fresh = newSaveData();
  const members: Record<string, MemberSave> = {};
  for (const def of PARTY) {
    const m = d.members?.[def.id];
    const base = fresh.members[def.id];
    members[def.id] = m
      ? {
          unlocked: typeof m.unlocked === 'boolean' ? m.unlocked : base.unlocked,
          active: typeof m.active === 'boolean' ? m.active : base.active,
          hp: typeof m.hp === 'number' ? Math.max(0, Math.min(def.maxHp, m.hp)) : base.hp,
          xp: typeof m.xp === 'number' ? m.xp : 0,
          level: typeof m.level === 'number' ? m.level : 1,
          tactics: Array.isArray(m.tactics) ? validTactics(def, m.tactics) : base.tactics,
        }
      : base;
  }
  return {
    version: SAVE_VERSION,
    savedAt: typeof d.savedAt === 'number' ? d.savedAt : 0,
    area: typeof d.area === 'string' ? d.area : fresh.area,
    position: d.position && typeof d.position.x === 'number' && typeof d.position.y === 'number' ? d.position : null,
    leaderId: PARTY.some((p) => p.id === d.leaderId) ? d.leaderId : fresh.leaderId,
    flags: d.flags && typeof d.flags === 'object' ? d.flags : {},
    beaten: Array.isArray(d.beaten) ? d.beaten.filter((b) => typeof b === 'string') : [],
    members,
  };
}

function defaultMember(def: CharacterDef): MemberSave {
  return { unlocked: true, active: true, hp: def.maxHp, xp: 0, level: 1, tactics: def.tactics.map((r) => ({ ...r })) };
}

function isValidRow(def: CharacterDef, r: unknown): r is TacticRow {
  if (!r || typeof r !== 'object') return false;
  const { action, target, type, enabled } = r as Record<string, unknown>;
  if (typeof action !== 'string' || typeof target !== 'string' || typeof type !== 'string') return false;
  if (typeof enabled !== 'boolean') return false;
  if (!(action in ACTIONS) || !(target in TARGETS) || !(type in TYPES)) return false;
  if (!(def.actions as string[]).includes(action)) return false;
  const group = TARGETS[target as keyof typeof TARGETS].group;
  const actionGroups = ACTIONS[action as keyof typeof ACTIONS].groups as readonly TargetGroup[];
  const typeGroups = TYPES[type as keyof typeof TYPES].groups as readonly TargetGroup[];
  return actionGroups.includes(group) && typeGroups.includes(group);
}

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function removeRaw(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
