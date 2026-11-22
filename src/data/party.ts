import { type ActionId, type TacticRow, row } from './tactics';
import type { WeaponId } from './weapons';

export type ClassId = 'crusader' | 'cleric' | 'bane' | 'pikeman' | 'wizard';
export type Role = 'tank' | 'healer' | 'support' | 'melee' | 'magic';

export interface CharacterDef {
  id: string;
  name: string;
  classId: ClassId;
  className: string;
  role: Role;
  maxHp: number;
  /** Decides what the basic Attack does (melee strike or wand bolt). */
  weapon: WeaponId;
  /** Movement speed in pixels per second. */
  speed: number;
  /** Actions this character knows (the tactics editor only offers these). */
  actions: ActionId[];
  /** Starting tactic rows (max 10). */
  tactics: TacticRow[];
  /** Placeholder colour until real sprites exist. */
  color: number;
}

/** The character the rest of the party follows when moving. */
export const DEFAULT_LEADER_ID = 'yasmi';

// NOTE: stats are placeholders until balancing.
export const PARTY: CharacterDef[] = [
  {
    id: 'yasmi',
    name: 'Yasmi',
    classId: 'crusader',
    className: 'Crusader',
    role: 'tank',
    weapon: 'melee',
    maxHp: 300,
    speed: 60,
    actions: ['attack', 'taunt'],
    tactics: [row('taunt', 'enemy', 'notTargetingMe'), row('attack', 'enemy', 'targetingMe'), row('attack', 'enemy', 'any')],
    color: 0xd9c25b,
  },
  {
    id: 'hyne',
    name: 'Hyne',
    classId: 'cleric',
    className: 'Cleric',
    role: 'healer',
    weapon: 'melee',
    maxHp: 180,
    speed: 60,
    actions: ['attack', 'heal'],
    tactics: [row('heal', 'ally', 'hpBelow50'), row('attack', 'enemy', 'any')],
    color: 0xf2f2e9,
  },
  {
    id: 'oxleth',
    name: 'Oxleth',
    classId: 'bane',
    className: 'Bane',
    role: 'support',
    weapon: 'wand',
    maxHp: 200,
    speed: 60,
    actions: ['attack', 'hex', 'ward'],
    tactics: [row('ward', 'otherAlly', 'underAttack'), row('hex', 'enemy', 'mostDangerous'), row('attack', 'enemy', 'any')],
    color: 0x7b4fa8,
  },
  {
    id: 'arthur',
    name: 'Arthur',
    classId: 'pikeman',
    className: 'Pikeman',
    role: 'melee',
    weapon: 'melee',
    maxHp: 240,
    speed: 65,
    actions: ['attack', 'pierce'],
    tactics: [row('pierce', 'enemy', 'lowestHp'), row('attack', 'enemy', 'lowestHp')],
    color: 0x5b8fd9,
  },
  {
    id: 'telara',
    name: 'Telara',
    classId: 'wizard',
    className: 'Wizard',
    role: 'magic',
    weapon: 'wand',
    maxHp: 160,
    speed: 60,
    actions: ['attack', 'firebolt'],
    tactics: [row('firebolt', 'enemy', 'highestHp'), row('attack', 'enemy', 'any')],
    color: 0xd9542b,
  },
];
