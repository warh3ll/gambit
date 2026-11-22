import Phaser from 'phaser';
import type { CharacterDef } from '../data/party';
import type { Point } from '../systems/Pathfinder';

/** One character walking around the world. */
export class PartyMember {
  readonly def: CharacterDef;
  readonly sprite: Phaser.GameObjects.Image;
  readonly shadow: Phaser.GameObjects.Ellipse;

  x: number;
  y: number;
  /** Direction of travel in radians (0 = east, PI/2 = south). */
  facing = Math.PI / 2;

  /** Where this member is currently heading (end of its path). */
  goal: Point | null = null;
  private path: Point[] = [];
  private walkTime = 0;

  constructor(scene: Phaser.Scene, def: CharacterDef, x: number, y: number) {
    this.def = def;
    this.x = x;
    this.y = y;
    this.shadow = scene.add.ellipse(x, y, 10, 4, 0x000000, 0.35);
    this.sprite = scene.add.image(x, y, `char-${def.id}`).setOrigin(0.5, 1);
    this.sync(0);
  }

  get moving() {
    return this.path.length > 0;
  }

  setPath(path: Point[]) {
    this.path = path;
    this.goal = path.length ? path[path.length - 1] : null;
  }

  stop() {
    this.path = [];
    this.goal = null;
  }

  update(dt: number, speed: number) {
    let budget = speed * dt;
    while (budget > 0 && this.path.length) {
      const next = this.path[0];
      const dx = next.x - this.x;
      const dy = next.y - this.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.01) this.facing = Math.atan2(dy, dx);
      if (d <= budget) {
        this.x = next.x;
        this.y = next.y;
        budget -= d;
        this.path.shift();
      } else {
        this.x += (dx / d) * budget;
        this.y += (dy / d) * budget;
        budget = 0;
      }
    }
    if (!this.path.length) this.goal = null;
    this.walkTime = this.moving ? this.walkTime + dt : 0;
    this.sync(this.walkTime);
  }

  private sync(walkTime: number) {
    const bob = walkTime > 0 ? Math.round(Math.abs(Math.sin(walkTime * 12))) : 0;
    this.sprite.setPosition(Math.round(this.x), Math.round(this.y) + 3 - bob);
    this.sprite.setFlipX(Math.cos(this.facing) < -0.1);
    this.sprite.setDepth(10 + this.y); // lower on screen = drawn in front
    this.shadow.setPosition(Math.round(this.x), Math.round(this.y) + 2).setDepth(1);
  }
}
