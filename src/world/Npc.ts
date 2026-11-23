import Phaser from 'phaser';
import type { NpcDef } from '../data/npcs';
import type { Point } from '../systems/Pathfinder';
import { outlineTexture } from './highlight';

/** A character standing in the world that the party can talk to. Click to talk; hovering shows an outline. */
export class Npc {
  readonly def: NpcDef;
  readonly x: number;
  readonly y: number;
  readonly sprite: Phaser.GameObjects.Image;
  private readonly outline: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, def: NpcDef, x: number, y: number) {
    this.def = def;
    this.x = x;
    this.y = y;
    scene.add.ellipse(x, y + 2, 10, 4, 0x000000, 0.35).setDepth(1);
    const key = `npc-${def.id}`;
    this.sprite = scene.add
      .image(x, y + 3, key)
      .setOrigin(0.5, 1)
      .setDepth(10 + y)
      .setInteractive(); // the world scene sets the hand cursor while one is highlighted
    this.sprite.setData('npc', this);

    // Outline: 1px larger on every side, lined up with the sprite's feet.
    const h = this.sprite.height;
    this.outline = scene.add
      .image(x, y + 3, outlineTexture(scene, key))
      .setOrigin(0.5, (h + 1) / (h + 2))
      .setDepth(10 + y + 0.01)
      .setVisible(false);
    this.sprite.on('pointerover', () => this.setHighlight(true));
    this.sprite.on('pointerout', () => this.setHighlight(false));
  }

  get highlighted() {
    return this.outline.visible;
  }

  setHighlight(on: boolean) {
    this.outline.setVisible(on);
  }

  faceTowards(p: Point) {
    const flip = p.x < this.x;
    this.sprite.setFlipX(flip);
    this.outline.setFlipX(flip);
  }
}
