/**
 * TACTICS — the single home for every tactic building block in the game.
 *
 * A tactic row reads:   Action | Target | Type
 *   e.g.                Heal   | Ally   | HP below 50%
 *
 *  - ACTION: what the character does (attack, spell, ability).
 *  - TARGET: which group to look in (self, allies, enemies).
 *  - TYPE:   the condition / selector that picks who in that group qualifies,
 *            and in what order of preference.
 *
 * To add a new tactic piece, add an entry to ACTIONS, TARGETS or TYPES below.
 * Design notes and the planned list live in docs/TACTICS.md.
 */
import type { Combatant, TacticContext } from '../game/types';

// ─────────────────────────────────────────────────────────────────────────────
// TARGETS — the group a row looks in
// ─────────────────────────────────────────────────────────────────────────────

export type TargetGroup = 'self' | 'ally' | 'enemy';

export interface TargetDef {
  id: string;
  label: string;
  group: TargetGroup;
  /** Returns everyone in the group that is alive. */
  pool: (ctx: TacticContext) => Combatant[];
}

export const TARGETS = {
  self: {
    id: 'self',
    label: 'Self',
    group: 'self',
    pool: (ctx) => (ctx.self.alive ? [ctx.self] : []),
  },
  ally: {
    id: 'ally',
    label: 'Any ally',
    group: 'ally',
    pool: (ctx) => ctx.allies.filter((a) => a.alive), // includes self
  },
  otherAlly: {
    id: 'otherAlly',
    label: 'Other ally',
    group: 'ally',
    pool: (ctx) => ctx.allies.filter((a) => a.alive && a.id !== ctx.self.id),
  },
  enemy: {
    id: 'enemy',
    label: 'Enemy',
    group: 'enemy',
    pool: (ctx) => ctx.enemies.filter((e) => e.alive),
  },
} satisfies Record<string, TargetDef>;

export type TargetId = keyof typeof TARGETS;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES — conditions / selectors applied to the target pool
// ─────────────────────────────────────────────────────────────────────────────

export interface TypeDef {
  id: string;
  label: string;
  /** Which target groups this type makes sense for (used by the tactics editor). */
  groups: TargetGroup[];
  /** Filter + sort the pool. First element is the preferred target; empty = row does not fire. */
  select: (pool: Combatant[], ctx: TacticContext) => Combatant[];
}

const hpPct = (c: Combatant) => c.hp / c.maxHp;
const dist = (a: Combatant, b: Combatant) => Math.hypot(a.x - b.x, a.y - b.y);
const byNearest = (ctx: TacticContext) => (a: Combatant, b: Combatant) =>
  dist(ctx.self, a) - dist(ctx.self, b);

const hpBelow = (pct: number): TypeDef => ({
  id: `hpBelow${pct}`,
  label: `HP below ${pct}%`,
  groups: ['self', 'ally', 'enemy'],
  select: (pool) => pool.filter((c) => hpPct(c) < pct / 100).sort((a, b) => hpPct(a) - hpPct(b)),
});

export const TYPES = {
  any: {
    id: 'any',
    label: 'Any (nearest)',
    groups: ['self', 'ally', 'enemy'],
    select: (pool, ctx) => [...pool].sort(byNearest(ctx)),
  },
  hpBelow25: hpBelow(25),
  hpBelow50: hpBelow(50),
  hpBelow75: hpBelow(75),
  lowestHp: {
    id: 'lowestHp',
    label: 'Lowest HP',
    groups: ['ally', 'enemy'],
    select: (pool) => [...pool].sort((a, b) => a.hp - b.hp),
  },
  highestHp: {
    id: 'highestHp',
    label: 'Highest HP',
    groups: ['ally', 'enemy'],
    select: (pool) => [...pool].sort((a, b) => b.hp - a.hp),
  },
  mostDangerous: {
    id: 'mostDangerous',
    label: 'Most dangerous',
    groups: ['enemy'],
    select: (pool) => [...pool].sort((a, b) => b.threat - a.threat),
  },
  notTargetingMe: {
    id: 'notTargetingMe',
    label: 'Not targeting me',
    groups: ['enemy'],
    select: (pool, ctx) =>
      pool.filter((e) => e.targetId !== null && e.targetId !== ctx.self.id).sort(byNearest(ctx)),
  },
  targetingMe: {
    id: 'targetingMe',
    label: 'Targeting me',
    groups: ['enemy'],
    select: (pool, ctx) => pool.filter((e) => e.targetId === ctx.self.id).sort(byNearest(ctx)),
  },
  underAttack: {
    id: 'underAttack',
    label: 'Under attack',
    groups: ['self', 'ally'],
    select: (pool, ctx) =>
      pool.filter((a) => ctx.enemies.some((e) => e.alive && e.targetId === a.id)).sort(byNearest(ctx)),
  },
} satisfies Record<string, TypeDef>;

export type TypeId = keyof typeof TYPES;

// ─────────────────────────────────────────────────────────────────────────────
// ACTIONS — what a character can do
// ─────────────────────────────────────────────────────────────────────────────

export type ActionEffect =
  | { kind: 'damage'; power: number }
  | { kind: 'heal'; power: number }
  | { kind: 'taunt' }
  | { kind: 'debuff'; status: string; duration: number }
  | { kind: 'buff'; status: string; duration: number };

export interface ActionDef {
  id: string;
  label: string;
  description: string;
  /** Which target groups this action may be pointed at. */
  groups: TargetGroup[];
  /** Range in pixels. */
  range: number;
  /** Seconds before the action can be used again. 0 = basic action. */
  cooldown: number;
  effect: ActionEffect;
}

// NOTE: numbers below are placeholders until balancing.
export const ACTIONS = {
  attack: {
    id: 'attack',
    label: 'Attack',
    description: 'Basic attack with the equipped weapon.',
    groups: ['enemy'],
    range: 20,
    cooldown: 0,
    effect: { kind: 'damage', power: 10 },
  },
  taunt: {
    id: 'taunt',
    label: 'Taunt',
    description: 'Forces the enemy to target the user.',
    groups: ['enemy'],
    range: 80,
    cooldown: 6,
    effect: { kind: 'taunt' },
  },
  heal: {
    id: 'heal',
    label: 'Heal',
    description: 'Restores HP to one target.',
    groups: ['self', 'ally'],
    range: 100,
    cooldown: 3,
    effect: { kind: 'heal', power: 30 },
  },
  hex: {
    id: 'hex',
    label: 'Hex',
    description: 'Curses an enemy so it takes more damage.',
    groups: ['enemy'],
    range: 100,
    cooldown: 8,
    effect: { kind: 'debuff', status: 'hexed', duration: 6 },
  },
  ward: {
    id: 'ward',
    label: 'Ward',
    description: 'Shields an ally so it takes less damage.',
    groups: ['self', 'ally'],
    range: 100,
    cooldown: 8,
    effect: { kind: 'buff', status: 'warded', duration: 6 },
  },
  pierce: {
    id: 'pierce',
    label: 'Pierce',
    description: 'A long-reaching pike thrust.',
    groups: ['enemy'],
    range: 32,
    cooldown: 4,
    effect: { kind: 'damage', power: 18 },
  },
  firebolt: {
    id: 'firebolt',
    label: 'Firebolt',
    description: 'Hurls a bolt of fire.',
    groups: ['enemy'],
    range: 120,
    cooldown: 2,
    effect: { kind: 'damage', power: 16 },
  },
} satisfies Record<string, ActionDef>;

export type ActionId = keyof typeof ACTIONS;

// ─────────────────────────────────────────────────────────────────────────────
// TACTIC ROWS
// ─────────────────────────────────────────────────────────────────────────────

export interface TacticRow {
  action: ActionId;
  target: TargetId;
  type: TypeId;
  enabled: boolean;
}

/** Shorthand for writing default tactic lists: row('heal', 'ally', 'hpBelow50'). */
export const row = (action: ActionId, target: TargetId, type: TypeId): TacticRow => ({
  action,
  target,
  type,
  enabled: true,
});
