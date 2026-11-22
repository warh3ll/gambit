import Phaser from 'phaser';
import { ACTIONS, type ActionDef, type ActionId } from '../data/tactics';
import type { TacticContext } from '../game/types';
import type { Unit } from '../world/Unit';
import type { Pathfinder, Point } from './Pathfinder';
import { decide } from './TacticEngine';

/** Seconds between tactic re-evaluations. */
const THINK_INTERVAL = 0.25;
/** Seconds between path recalculations while chasing a target. */
const REPATH_INTERVAL = 0.4;
/** Seconds a unit is busy after performing any action. */
const ACTION_RECOVERY = 0.5;
/** Extra pixels allowed beyond an action's range. */
const RANGE_SLACK = 2;
/** With nothing to do in a fight, units stay within this distance of their allies. */
const REGROUP_DISTANCE = 36;
/** Fighters closer than this get nudged apart so they don't stack. */
const SEPARATION = 12;
const PROJECTILE_SPEED = 200;
const TAUNT_DURATION = 4;

/** Damage multipliers from statuses. */
const DAMAGE_TAKEN: Record<string, number> = { hexed: 1.25, warded: 0.75 };

const RING_COLORS = { heal: 0x6bd96b, taunt: 0xff5a5a, debuff: 0xa45ad9, buff: 0x5ab4ff } as const;

interface Projectile {
  sprite: Phaser.GameObjects.Image;
  target: Unit;
  onHit: () => void;
}

/**
 * Runs everyone's tactics.
 *
 * In combat: each fighter picks its first row that can fire, walks until the
 * target is in range, then acts. With no row to fire, it stays near its allies.
 * Out of combat: party members still run their tactics against allies
 * (e.g. healing), but only act on targets already in range and never move.
 */
export class CombatSystem {
  private readonly scene: Phaser.Scene;
  private readonly pathfinder: Pathfinder;
  private projectiles: Projectile[] = [];

  constructor(scene: Phaser.Scene, pathfinder: Pathfinder) {
    this.scene = scene;
    this.pathfinder = pathfinder;
  }

  update(dt: number, party: Unit[], enemies: Unit[], inCombat: boolean) {
    if (inCombat) {
      const fighters = [...party, ...enemies].filter((u) => u.alive);
      for (const u of fighters) {
        const ctx = this.contextFor(u, party, enemies);
        this.think(u, ctx);
        this.act(u, ctx);
      }
      this.separate(fighters);
    } else {
      this.supportOutOfCombat(party);
    }
    this.updateProjectiles(dt);
  }

  /** Remove in-flight projectiles (e.g. when a fight is reset). */
  clearProjectiles() {
    for (const p of this.projectiles) p.sprite.destroy();
    this.projectiles = [];
  }

  // ── decision making ──

  private contextFor(u: Unit, party: Unit[], enemies: Unit[]): TacticContext<Unit> {
    const mine = u.side === 'party' ? party : enemies;
    const theirs = u.side === 'party' ? enemies : party;
    let foes = theirs.filter((t) => t.alive);
    // A taunted unit can only see the one who taunted it.
    const taunt = u.statuses.get('taunted');
    const taunter = taunt && foes.find((f) => f.id === taunt.sourceId);
    if (taunter) foes = [taunter];
    return { self: u, allies: mine.filter((a) => a.alive), enemies: foes };
  }

  private think(u: Unit, ctx: TacticContext<Unit>) {
    if (u.thinkTimer > 0 && (!u.intent || u.intent.target.alive)) return;
    u.thinkTimer = THINK_INTERVAL;

    const d = decide(u.tactics, ctx, (id) => this.rowReady(u, id));
    const prevTarget = u.intent?.target;
    u.intent = d ? { rowIndex: d.rowIndex, action: d.action, target: d.target } : null;
    if (u.intent?.target !== prevTarget) u.repathTimer = 0;

    if (!d) u.targetId = null;
    else if (d.target.side !== u.side) u.targetId = d.target.id;
  }

  private act(u: Unit, ctx: TacticContext<Unit>) {
    const intent = u.intent;
    if (!intent) {
      this.regroup(u, ctx.allies);
      return;
    }
    const { action, target } = intent;
    if (!target.alive) {
      u.intent = null;
      u.thinkTimer = 0; // pick a new target right away
      return;
    }

    const range = this.actionRange(u, action);
    if (target !== u && dist(u, target) > range + RANGE_SLACK) {
      this.chase(u, target);
      return;
    }

    u.stop();
    if (target !== u) u.faceTowards(target);
    if (u.busy > 0 || !u.isReady(action.id)) return;
    this.perform(u, action, target);
  }

  private supportOutOfCombat(party: Unit[]) {
    const alive = party.filter((u) => u.alive);
    for (const u of alive) {
      if (u.thinkTimer > 0) continue;
      u.thinkTimer = THINK_INTERVAL;
      if (u.busy > 0) continue;
      const d = decide(u.tactics, { self: u, allies: alive, enemies: [] }, (id) => this.rowReady(u, id));
      if (!d) continue;
      if (d.target !== u && dist(u, d.target) > this.actionRange(u, d.action) + RANGE_SLACK) continue;
      this.perform(u, d.action, d.target);
    }
  }

  /**
   * Can a row with this action be picked? Skills on cooldown are skipped so lower rows get a turn.
   * The basic Attack is paced by its weapon instead: the row stays picked and the unit waits for its next swing.
   */
  private rowReady(u: Unit, actionId: ActionId) {
    return ACTIONS[actionId].cooldown === 'weapon' || u.isReady(actionId);
  }

  // ── movement ──

  private chase(u: Unit, target: Point) {
    const goalDrift = u.goal ? dist(u.goal, target) : Infinity;
    if (u.repathTimer > 0 && goalDrift < 8) return;
    u.repathTimer = REPATH_INTERVAL;
    const path = this.pathfinder.findPath(u, target);
    if (path) u.setPath(path);
  }

  private regroup(u: Unit, allies: Unit[]) {
    const others = allies.filter((a) => a !== u);
    if (!others.length) {
      u.stop();
      return;
    }
    const center = {
      x: others.reduce((s, a) => s + a.x, 0) / others.length,
      y: others.reduce((s, a) => s + a.y, 0) / others.length,
    };
    if (dist(u, center) <= REGROUP_DISTANCE) {
      u.stop();
      return;
    }
    this.chase(u, center);
  }

  /** Nudges overlapping fighters apart so they don't stand on top of each other. */
  private separate(units: Unit[]) {
    for (let i = 0; i < units.length; i++) {
      for (let j = i + 1; j < units.length; j++) {
        const a = units[i];
        const b = units[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        if (d >= SEPARATION) continue;
        if (d < 0.01) {
          dx = Math.random() - 0.5;
          dy = Math.random() - 0.5;
          d = Math.hypot(dx, dy);
        }
        const push = (SEPARATION - d) / 4;
        const nx = (dx / d) * push;
        const ny = (dy / d) * push;
        this.nudge(a, -nx, -ny);
        this.nudge(b, nx, ny);
      }
    }
  }

  private nudge(u: Unit, dx: number, dy: number) {
    if (this.pathfinder.isWalkableWorld(u.x + dx, u.y + dy)) {
      u.x += dx;
      u.y += dy;
    }
  }

  // ── actions ──

  private actionRange(u: Unit, action: ActionDef) {
    return action.range === 'weapon' ? u.weapon.range : action.range;
  }

  private actionCooldown(u: Unit, action: ActionDef) {
    return action.cooldown === 'weapon' ? u.weapon.interval : action.cooldown;
  }

  private perform(u: Unit, action: ActionDef, target: Unit) {
    u.startCooldown(action.id, this.actionCooldown(u, action));
    u.busy = ACTION_RECOVERY;
    u.thinkTimer = 0; // re-evaluate right after acting

    const e = action.effect;
    switch (e.kind) {
      case 'weaponAttack': {
        const hit = () => this.dealDamage(target, u.weapon.power);
        if (u.weapon.projectile) this.launch(u, target, `proj-${u.weapon.id}`, hit);
        else hit();
        break;
      }
      case 'damage': {
        const hit = () => this.dealDamage(target, e.power);
        if (action.projectile) this.launch(u, target, `proj-${action.id}`, hit);
        else hit();
        break;
      }
      case 'heal':
        target.heal(e.power);
        this.ring(target, RING_COLORS.heal);
        break;
      case 'taunt':
        target.addStatus('taunted', TAUNT_DURATION, u.id);
        target.targetId = u.id;
        target.thinkTimer = 0;
        this.ring(target, RING_COLORS.taunt);
        break;
      case 'debuff':
        target.addStatus(e.status, e.duration, u.id);
        this.ring(target, RING_COLORS.debuff);
        break;
      case 'buff':
        target.addStatus(e.status, e.duration, u.id);
        this.ring(target, RING_COLORS.buff);
        break;
    }
  }

  private dealDamage(target: Unit, power: number) {
    let amount = power;
    for (const [status, mult] of Object.entries(DAMAGE_TAKEN)) if (target.hasStatus(status)) amount *= mult;
    target.takeDamage(Math.max(1, Math.round(amount)));
  }

  // ── visuals ──

  private launch(from: Unit, target: Unit, texture: string, onHit: () => void) {
    const key = this.scene.textures.exists(texture) ? texture : 'proj-wand';
    const sprite = this.scene.add.image(from.x, from.y - 8, key).setDepth(6000);
    this.projectiles.push({ sprite, target, onHit });
  }

  private updateProjectiles(dt: number) {
    this.projectiles = this.projectiles.filter((p) => {
      if (!p.target.alive) {
        p.sprite.destroy();
        return false;
      }
      const tx = p.target.x;
      const ty = p.target.y - 8;
      const dx = tx - p.sprite.x;
      const dy = ty - p.sprite.y;
      const d = Math.hypot(dx, dy);
      const step = PROJECTILE_SPEED * dt;
      if (d <= step) {
        p.sprite.destroy();
        p.onHit();
        return false;
      }
      p.sprite.setPosition(p.sprite.x + (dx / d) * step, p.sprite.y + (dy / d) * step);
      p.sprite.setRotation(Math.atan2(dy, dx));
      return true;
    });
  }

  private ring(target: Unit, color: number) {
    const ring = this.scene.add.image(target.x, target.y - 6, 'click-marker').setTint(color).setDepth(6000).setScale(0.6);
    this.scene.tweens.add({ targets: ring, scale: 1.8, alpha: 0, duration: 400, onComplete: () => ring.destroy() });
  }
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
