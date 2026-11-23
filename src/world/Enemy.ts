import Phaser from 'phaser';
import type { EnemyDef } from '../data/enemies';
import { WEAPONS } from '../data/weapons';
import type { Point } from '../systems/Pathfinder';
import { Unit } from './Unit';

/** A hostile unit in the world. Belongs to an encounter group. */
export class Enemy extends Unit {
  readonly def: EnemyDef;
  readonly groupId: string;
  /** Where this enemy was placed; it returns here if the party is defeated. */
  readonly home: Point;

  constructor(scene: Phaser.Scene, def: EnemyDef, id: string, groupId: string, x: number, y: number) {
    super(scene, {
      id,
      name: def.name,
      side: 'enemy',
      maxHp: def.maxHp,
      threat: def.threat,
      speed: def.speed,
      weapon: { ...WEAPONS[def.weapon], power: def.attackPower },
      tactics: def.tactics,
      texture: `enemy-${def.id}`,
      x,
      y,
    });
    this.def = def;
    this.groupId = groupId;
    this.home = { x, y };
  }

  /** Puts the enemy back at its starting spot with full HP (used when the party is defeated). */
  resetToHome() {
    this.stop();
    this.resetCombatState();
    this.cooldowns.clear();
    this.x = this.home.x;
    this.y = this.home.y;
    this.facing = Math.PI;
    this.revive(this.maxHp);
  }

  /** Removes an enemy that was already beaten (e.g. in a saved game) without the death animation. */
  despawn() {
    this.stop();
    this.hp = 0;
    this.sprite.setVisible(false);
    this.shadow.setVisible(false);
    this.sync();
  }

  protected die() {
    super.die();
    this.sprite.scene.time.delayedCall(450, () => {
      if (!this.alive) this.sprite.setVisible(false);
    });
  }
}
