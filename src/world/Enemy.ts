import Phaser from 'phaser';
import type { EnemyDef } from '../data/enemies';
import { Unit } from './Unit';

/** A hostile unit in the world. Belongs to an encounter group. */
export class Enemy extends Unit {
  readonly def: EnemyDef;
  readonly groupId: string;

  constructor(scene: Phaser.Scene, def: EnemyDef, id: string, groupId: string, x: number, y: number) {
    super(scene, {
      id,
      name: def.name,
      side: 'enemy',
      maxHp: def.maxHp,
      threat: def.threat,
      texture: `enemy-${def.id}`,
      x,
      y,
    });
    this.def = def;
    this.groupId = groupId;
  }

  protected die() {
    super.die();
    this.sprite.scene.time.delayedCall(450, () => this.sprite.setVisible(false));
  }
}
