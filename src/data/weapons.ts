/**
 * Weapon types decide what a character's basic Attack does:
 * its range, damage, and how often it can be used.
 */
export interface WeaponDef {
  id: string;
  label: string;
  /** Reach in pixels. */
  range: number;
  power: number;
  /** Seconds between basic attacks. */
  interval: number;
  /** Ranged weapons fire a projectile instead of striking directly. */
  projectile: boolean;
}

// NOTE: numbers are placeholders until balancing.
export const WEAPONS = {
  melee: {
    id: 'melee',
    label: 'Melee',
    range: 20,
    power: 10,
    interval: 1.2,
    projectile: false,
  },
  wand: {
    id: 'wand',
    label: 'Wand',
    range: 110,
    power: 7,
    interval: 1.6,
    projectile: true,
  },
  bow: {
    id: 'bow',
    label: 'Bow',
    range: 130,
    power: 8,
    interval: 1.8,
    projectile: true,
  },
} satisfies Record<string, WeaponDef>;

export type WeaponId = keyof typeof WEAPONS;
