import Phaser from 'phaser';
import type { CharacterDef } from '../data/party';
import { WEAPONS } from '../data/weapons';
import { Unit } from './Unit';

/** One of the player's characters. */
export class PartyMember extends Unit {
  readonly def: CharacterDef;

  constructor(scene: Phaser.Scene, def: CharacterDef, x: number, y: number) {
    super(scene, {
      id: def.id,
      name: def.name,
      side: 'party',
      maxHp: def.maxHp,
      threat: 0,
      speed: def.speed,
      weapon: WEAPONS[def.weapon],
      tactics: def.tactics,
      texture: `char-${def.id}`,
      x,
      y,
    });
    this.def = def;
  }

  /** Fallen party members lie down and fade, rather than disappearing. */
  protected die() {
    this.stop();
    this.resetCombatState();
    this.sprite.scene.tweens.add({ targets: this.sprite, angle: -90, alpha: 0.5, duration: 300 });
  }
}
