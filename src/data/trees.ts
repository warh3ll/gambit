/**
 * PROGRESSION TREES — one skill tree per class.
 *
 * The content lives in trees.json, next to this file. Edit it with the Gambit Editor:
 * run `npm run dev` and open http://localhost:8080/editor.html (Classes tab).
 *
 * A tree is a list of tiers. On each level-up a character gets one point and picks one node on the next tier,
 * but only a node that follows the node they picked on the tier before. Tier 1 opens at level 2, tier 2 at
 * level 3, and so on (a node can also ask for a higher level).
 *
 * Nodes can teach actions that aren't in the game yet: those are listed in `newActions` (name and description)
 * until they're built in src/data/tactics.ts. "Special" effects are described in words and also need building.
 * The game doesn't use trees yet: that's M14 (progression). Until then they're designed in the editor.
 */
import treesFile from './trees.json';

/** Numbers an upgrade can change on an action. */
export type UpgradeStat = 'power' | 'cooldown' | 'duration' | 'range';
/** Numbers a stat boost can raise on the character. */
export type CharacterStat = 'maxHp' | 'attack' | 'speed';

export type TreeEffect =
  /** Learn an action (one from tactics.ts, or a new one listed in `newActions`). */
  | { kind: 'learn'; action: string }
  /** Change a number of an action: power +5, cooldown −0.5 (seconds), duration +2 (seconds), range +16 (pixels). */
  | { kind: 'upgrade'; action: string; stat: UpgradeStat; amount: number }
  /** Raise one of the character's stats. */
  | { kind: 'stat'; stat: CharacterStat; amount: number }
  /** Anything else, in words (e.g. "Firebolt sets the target on fire"). Needs building. */
  | { kind: 'special'; text: string };

export interface TreeNode {
  /** Unique within the class's tree. */
  id: string;
  name: string;
  /** What the player reads about it. */
  text: string;
  /** Needs at least this level (besides the tier's own level). */
  minLevel?: number;
  /** Nodes on the tier before that lead here (empty on the first tier). */
  follows: string[];
  effects: TreeEffect[];
}

export interface ClassTree {
  tiers: TreeNode[][];
}

/** An action planned in a tree that isn't in the game yet. */
export interface NewAction {
  name: string;
  /** What it should do, for whoever builds it. */
  text: string;
}

/** The shape of trees.json. */
export interface TreesFile {
  newActions: Record<string, NewAction>;
  /** Class id (as in src/data/party.ts) → its tree. */
  classes: Record<string, ClassTree>;
}

/** Highest character level (M13 may move this). */
export const LEVEL_CAP = 10;

/** The level a tier opens at (tiers counted from 0): one point per level, from level 2. */
export const tierLevel = (tier: number) => tier + 2;

export const TREES: TreesFile = treesFile as unknown as TreesFile;

if (import.meta.hot) {
  import.meta.hot.accept('./trees.json', (mod) => {
    const next = mod?.default as TreesFile | undefined;
    if (next) Object.assign(TREES, next);
  });
}
