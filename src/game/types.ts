export type Side = 'party' | 'enemy';

/**
 * The read-only view of a fighter that tactics are evaluated against.
 * Combat code owns the real objects; tactics only ever look at this shape.
 */
export interface Combatant {
  id: string;
  name: string;
  side: Side;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  /** Id of the combatant this one is currently attacking (null if idle). */
  targetId: string | null;
  /** How dangerous this combatant is considered (used by "Most dangerous"). */
  threat: number;
  alive: boolean;
}

/** Everything a tactic row can look at when deciding whether to fire. */
export interface TacticContext<T extends Combatant = Combatant> {
  self: T;
  allies: T[]; // includes self
  enemies: T[];
}
