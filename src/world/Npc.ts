import Phaser from 'phaser';
import type { NpcDef } from '../data/npcs';
import type { Point } from '../systems/Pathfinder';

/** A character standing in the world that the party can talk to. Click to talk. */
export class Npc {
  readonly def: NpcDef;
  readonly x: number;
  readonly y: number;
  readonly sprite: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, def: NpcDef, x: number, y: number) {
    this.def = def;
    this.x = x;
    this.y = y;
    scene.add.ellipse(x, y + 2, 10, 4, 0x000000, 0.35).setDepth(1);
    this.sprite = scene.add
      .image(x, y + 3, `npc-${def.id}`)
      .setOrigin(0.5, 1)
      .setDepth(10 + y)
      .setInteractive({ useHandCursor: true });
    this.sprite.setData('npc', this);
  }

  faceTowards(p: Point) {
    this.sprite.setFlipX(p.x < this.x);
  }
}
