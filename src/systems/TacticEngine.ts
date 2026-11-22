import { MAX_TACTIC_ROWS } from '../config';
import type { Combatant, TacticContext } from '../game/types';
import { ACTIONS, type ActionDef, type TacticRow, TARGETS, TYPES } from '../data/tactics';

export interface TacticDecision {
  rowIndex: number;
  action: ActionDef;
  target: Combatant;
}

/**
 * Walks the rows top to bottom and returns the first one that can fire.
 * A row fires when it is enabled, its action is off cooldown, and its
 * Target + Type produce at least one valid combatant.
 */
export function decide(
  rows: TacticRow[],
  ctx: TacticContext,
  isReady: (actionId: string) => boolean,
): TacticDecision | null {
  const limit = Math.min(rows.length, MAX_TACTIC_ROWS);
  for (let i = 0; i < limit; i++) {
    const r = rows[i];
    if (!r.enabled || !isReady(r.action)) continue;
    const pool = TARGETS[r.target].pool(ctx);
    const [target] = TYPES[r.type].select(pool, ctx);
    if (target) return { rowIndex: i, action: ACTIONS[r.action], target };
  }
  return null;
}
