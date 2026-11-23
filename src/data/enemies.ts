/**
 * Enemy types. Each type has a preset list of tactic rows, written with the
 * same Action | Target | Type pieces the party uses (src/data/tactics.ts).
 * From an enemy's point of view, "Enemy" means the player's party.
 */
import { type ActionId, type TacticRow, row } from './tactics';
import type { WeaponId } from './weapons';

export interface EnemyDef {
  id: string;
  name: string;
  maxHp: number;
  speed: number;
  weapon: WeaponId;
  /** Damage of the basic Attack (overrides the weapon's power). */
  attackPower: number;
  /** How dangerous this enemy is rated (used by the "Most dangerous" type). */
  threat: number;
  /** Distance in pixels at which this enemy notices the party and a fight starts. */
  aggroRadius: number;
  actions: ActionId[];
  tactics: TacticRow[];
  /** Placeholder look until real sprites exist. */
  color: number;
  size: { w: number; h: number };
}

// NOTE: all enemies and numbers are placeholders for testing.
export const ENEMIES = {
  wolf: {
    id: 'wolf',
    name: 'Wolf',
    maxHp: 90,
    speed: 75,
    weapon: 'melee',
    attackPower: 9,
    threat: 1,
    aggroRadius: 72,
    actions: ['attack'],
    tactics: [row('attack', 'enemy', 'lowestHp')], // pack hunters go for the weakest
    color: 0x8a8a96,
    size: { w: 14, h: 10 },
  },
  bandit: {
    id: 'bandit',
    name: 'Bandit',
    maxHp: 140,
    speed: 55,
    weapon: 'melee',
    attackPower: 13,
    threat: 2,
    aggroRadius: 64,
    actions: ['attack'],
    tactics: [row('attack', 'enemy', 'any')],
    color: 0x8a5a3a,
    size: { w: 12, h: 16 },
  },
  banditArcher: {
    id: 'banditArcher',
    name: 'Bandit Archer',
    maxHp: 100,
    speed: 55,
    weapon: 'bow',
    attackPower: 11,
    threat: 3,
    aggroRadius: 96,
    actions: ['attack'],
    tactics: [row('attack', 'enemy', 'hpBelow50'), row('attack', 'enemy', 'any')],
    color: 0x4f7a3a,
    size: { w: 12, h: 16 },
  },
  acolyte: {
    id: 'acolyte',
    name: 'Acolyte',
    maxHp: 110,
    speed: 55,
    weapon: 'wand',
    attackPower: 8,
    threat: 3,
    aggroRadius: 80,
    actions: ['heal', 'attack'],
    // The Stranger's followers: keep their side alive, otherwise pelt the party.
    tactics: [row('heal', 'ally', 'hpBelow50'), row('attack', 'enemy', 'any')],
    color: 0x6a4a8a,
    size: { w: 12, h: 16 },
  },
  stranger: {
    id: 'stranger',
    name: 'The Stranger',
    maxHp: 650,
    speed: 50,
    weapon: 'wand',
    attackPower: 12,
    threat: 5,
    aggroRadius: 110,
    actions: ['shadowBolt', 'hex', 'attack'],
    tactics: [
      row('shadowBolt', 'enemy', 'hpBelow50'), // finish off the weak
      row('hex', 'enemy', 'highestHp'), // curse the toughest
      row('shadowBolt', 'enemy', 'any'),
      row('attack', 'enemy', 'any'),
    ],
    color: 0x2a2236,
    size: { w: 14, h: 20 },
  },
} satisfies Record<string, EnemyDef>;

export type EnemyTypeId = keyof typeof ENEMIES;
