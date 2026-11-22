import Phaser from 'phaser';
import type { CharacterDef } from '../data/party';
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
      texture: `char-${def.id}`,
      x,
      y,
    });
    this.def = def;
  }
}
