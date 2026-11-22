import { type ActionId, type TacticRow, row } from './tactics';

export type ClassId = 'crusader' | 'cleric' | 'bane' | 'pikeman' | 'wizard';
export type Role = 'tank' | 'healer' | 'support' | 'melee' | 'magic';

export interface CharacterDef {
  id: string;
  name: string;
  classId: ClassId;
  className: string;
  role: Role;
  maxHp: number;
  /** Movement speed in pixels per second. */
  speed: number;
  /** Actions this character knows (the tactics editor only offers these). */
  actions: ActionId[];
  /** Starting tactic rows (max 10). */
  tactics: TacticRow[];
  /** Placeholder colour until real sprites exist. */
  color: number;
}

// NOTE: stats are placeholders until balancing.
export const PARTY: CharacterDef[] = [
  {
    id: 'yasmi',
    name: 'Yasmi',
    classId: 'crusader',
    className: 'Crusader',
    role: 'tank',
    maxHp: 160,
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
    maxHp: 90,
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
    maxHp: 100,
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
    maxHp: 120,
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
    maxHp: 80,
    speed: 60,
    actions: ['attack', 'firebolt'],
    tactics: [row('firebolt', 'enemy', 'highestHp'), row('attack', 'enemy', 'any')],
    color: 0xd9542b,
  },
];
