import Phaser from 'phaser';
import type { ActionDef, TacticRow } from '../data/tactics';
import type { WeaponDef } from '../data/weapons';
import type { Combatant, Side } from '../game/types';
import type { Point } from '../systems/Pathfinder';

export interface UnitOptions {
  id: string;
  name: string;
  side: Side;
  maxHp: number;
  threat: number;
  speed: number;
  weapon: WeaponDef;
  tactics: TacticRow[];
  texture: string;
  x: number;
  y: number;
}

export interface Status {
  remaining: number;
  sourceId: string;
}

/** What a unit has decided to do, and to whom. */
export interface Intent {
  rowIndex: number;
  action: ActionDef;
  target: Unit;
}

const HP_BAR_WIDTH = 12;

/**
 * Anything that walks around and can fight: party members and enemies.
 * Implements `Combatant`, so tactics can read it directly.
 */
export class Unit implements Combatant {
  readonly id: string;
  readonly name: string;
  readonly side: Side;
  readonly sprite: Phaser.GameObjects.Image;
  readonly shadow: Phaser.GameObjects.Ellipse;
  readonly speed: number;
  readonly weapon: WeaponDef;
  /** Tactic rows, evaluated top to bottom. The list itself can be edited (M4). */
  tactics: TacticRow[];

  hp: number;
  maxHp: number;
  threat: number;
  targetId: string | null = null;

  x: number;
  y: number;
  /** Direction of travel in radians (0 = east, PI/2 = south). */
  facing = Math.PI / 2;
  /** Where this unit is currently heading (end of its path). */
  goal: Point | null = null;

  /** Force the HP bar on (e.g. during combat). It also shows whenever HP isn't full. */
  showHpBar = false;

  // ── combat state ──
  /** Seconds left on each action's cooldown. */
  readonly cooldowns = new Map<string, number>();
  readonly statuses = new Map<string, Status>();
  /** Seconds until this unit can act again after its last action. */
  busy = 0;
  /** Seconds until tactics are re-evaluated. */
  thinkTimer = 0;
  /** Seconds until the path to the current target is recalculated. */
  repathTimer = 0;
  intent: Intent | null = null;

  private path: Point[] = [];
  private walkTime = 0;
  private readonly hpBack: Phaser.GameObjects.Rectangle;
  private readonly hpFill: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, o: UnitOptions) {
    this.id = o.id;
    this.name = o.name;
    this.side = o.side;
    this.hp = o.maxHp;
    this.maxHp = o.maxHp;
    this.threat = o.threat;
    this.speed = o.speed;
    this.weapon = o.weapon;
    this.tactics = o.tactics.map((r) => ({ ...r }));
    this.x = o.x;
    this.y = o.y;
    this.shadow = scene.add.ellipse(o.x, o.y, 10, 4, 0x000000, 0.35).setDepth(1);
    this.sprite = scene.add.image(o.x, o.y, o.texture).setOrigin(0.5, 1);
    this.hpBack = scene.add.rectangle(0, 0, HP_BAR_WIDTH + 2, 3, 0x0d0b14).setOrigin(0.5, 0);
    const color = o.side === 'party' ? 0x6bd96b : 0xd94b4b;
    this.hpFill = scene.add.rectangle(0, 0, HP_BAR_WIDTH, 1, color).setOrigin(0, 0);
    this.sync();
  }

  get alive() {
    return this.hp > 0;
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

  faceTowards(p: Point) {
    if (p.x !== this.x || p.y !== this.y) this.facing = Math.atan2(p.y - this.y, p.x - this.x);
  }

  // ── cooldowns & statuses ──

  isReady(actionId: string) {
    return (this.cooldowns.get(actionId) ?? 0) <= 0;
  }

  startCooldown(actionId: string, seconds: number) {
    if (seconds > 0) this.cooldowns.set(actionId, seconds);
  }

  hasStatus(name: string) {
    return this.statuses.has(name);
  }

  addStatus(name: string, duration: number, sourceId: string) {
    this.statuses.set(name, { remaining: duration, sourceId });
  }

  /** Counts down cooldowns, statuses and timers. Runs in and out of combat. */
  tickTimers(dt: number) {
    for (const [id, t] of this.cooldowns) {
      if (t - dt <= 0) this.cooldowns.delete(id);
      else this.cooldowns.set(id, t - dt);
    }
    for (const [name, s] of this.statuses) {
      s.remaining -= dt;
      if (s.remaining <= 0) this.statuses.delete(name);
    }
    this.busy = Math.max(0, this.busy - dt);
    this.thinkTimer -= dt;
    this.repathTimer -= dt;
  }

  // ── health ──

  /** Reduce HP; returns true if this killed the unit. */
  takeDamage(amount: number): boolean {
    if (!this.alive) return false;
    this.hp = Math.max(0, this.hp - amount);
    if (!this.alive) this.die();
    else this.flash();
    return !this.alive;
  }

  heal(amount: number) {
    if (this.alive) this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  /** Brings a fallen unit back with the given HP. */
  revive(hp: number) {
    const scene = this.sprite.scene;
    scene.tweens.killTweensOf([this.sprite, this.shadow]);
    this.hp = Math.max(1, Math.min(this.maxHp, hp));
    this.sprite.setAlpha(1).setAngle(0).setVisible(true);
    this.shadow.setAlpha(1).setVisible(true);
    this.sync();
  }

  /** Clears combat state (target, intent, statuses). */
  resetCombatState() {
    this.targetId = null;
    this.intent = null;
    this.statuses.clear();
    this.busy = 0;
    this.thinkTimer = 0;
    this.repathTimer = 0;
  }

  update(dt: number, speed: number) {
    let budget = this.alive ? speed * dt : 0;
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
    this.sync();
  }

  protected die() {
    this.stop();
    this.resetCombatState();
    this.cooldowns.clear();
    this.sprite.scene.tweens.add({ targets: [this.sprite, this.shadow], alpha: 0, duration: 400 });
  }

  private flash() {
    const scene = this.sprite.scene;
    scene.tweens.add({ targets: this.sprite, alpha: 0.35, duration: 60, yoyo: true });
  }

  protected sync() {
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    const bob = this.walkTime > 0 ? Math.round(Math.abs(Math.sin(this.walkTime * 12))) : 0;
    this.sprite.setPosition(x, y + 3 - bob);
    this.sprite.setFlipX(Math.cos(this.facing) < -0.1);
    this.sprite.setDepth(10 + this.y); // lower on screen = drawn in front
    this.shadow.setPosition(x, y + 2);

    const barVisible = this.alive && (this.showHpBar || this.hp < this.maxHp);
    const top = y + 3 - this.sprite.height - 5;
    this.hpBack.setPosition(x, top).setVisible(barVisible).setDepth(5000);
    this.hpFill
      .setPosition(x - HP_BAR_WIDTH / 2, top + 1)
      .setSize(Math.max(0, Math.round((HP_BAR_WIDTH * this.hp) / this.maxHp)), 1)
      .setVisible(barVisible)
      .setDepth(5001);
  }
}
