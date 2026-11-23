import Phaser from 'phaser';
import { DEFAULT_LEADER_ID, PARTY } from '../data/party';
import { loadSavedTactics } from '../game/tacticsStore';
import type { Pathfinder, Point } from '../systems/Pathfinder';
import { PartyMember } from './PartyMember';

/**
 * Formation slots for followers, relative to the leader:
 * `back` = distance behind the leader, `side` = offset to the leader's right.
 * Followers fill the slots in party order (leader skipped).
 */
const FORMATION: { back: number; side: number }[] = [
  { back: 16, side: -10 },
  { back: 16, side: 10 },
  { back: 32, side: -10 },
  { back: 32, side: 10 },
];

/** How often followers re-check their formation slot (seconds). */
const FOLLOW_INTERVAL = 0.2;
/** Re-path only if a follower's slot moved more than this many pixels. */
const REPATH_DISTANCE = 6;
/** Followers further than this from their slot speed up to catch up. */
const CATCH_UP_DISTANCE = 40;
const CATCH_UP_SPEED = 1.4;

export class Party extends Phaser.Events.EventEmitter {
  readonly members: PartyMember[];
  leader: PartyMember;

  private readonly pathfinder: Pathfinder;
  /** The whole party walks at the speed of its slowest member. */
  private readonly speed: number;
  /** Smoothed leader facing, so the formation doesn't snap around on every turn. */
  private formationAngle = Math.PI / 2;
  private followTimer = 0;
  /** In combat the player can't move the party; tactics take over. */
  private inCombat = false;

  constructor(scene: Phaser.Scene, pathfinder: Pathfinder, spawn: Point) {
    super();
    this.pathfinder = pathfinder;
    this.members = PARTY.map((def) => new PartyMember(scene, def, spawn.x, spawn.y));
    loadSavedTactics(this.members);
    this.leader = this.members.find((m) => m.def.id === DEFAULT_LEADER_ID) ?? this.members[0];
    this.speed = Math.min(...PARTY.map((d) => d.speed));

    this.placeAt(spawn);
  }

  /** Puts the party in formation around `p` (no walking). */
  placeAt(p: Point) {
    this.leader.x = p.x;
    this.leader.y = p.y;
    this.leader.stop();
    this.leader.update(0, 0);
    this.followers.forEach((m, i) => {
      const slot = this.slotPosition(i);
      m.x = slot.x;
      m.y = slot.y;
      m.stop();
      m.update(0, 0);
    });
  }

  /** HP of each member, keyed by id (used for retrying a fight). */
  snapshotHp(): Map<string, number> {
    return new Map(this.members.map((m) => [m.id, m.hp]));
  }

  /** After a defeat: everyone back on their feet with the given HP (full if not given), at `p`. */
  restore(p: Point, hp?: Map<string, number>, facing = this.leader.facing) {
    for (const m of this.members) {
      m.revive(hp?.get(m.id) ?? m.maxHp);
      m.resetCombatState();
      m.cooldowns.clear();
    }
    this.face(facing);
    this.placeAt(p);
  }

  /** Turns the party (and its formation) to face `angle`, e.g. before placing it. */
  face(angle: number) {
    for (const m of this.members) m.facing = angle;
    this.formationAngle = angle;
  }

  get followers(): PartyMember[] {
    return this.members.filter((m) => m !== this.leader);
  }

  setLeader(id: string) {
    const next = this.members.find((m) => m.def.id === id);
    if (!next || next === this.leader) return;
    const destination = this.leader.goal;
    this.leader.stop();
    this.leader = next;
    this.leader.stop();
    this.formationAngle = this.leader.facing;
    if (destination) this.moveTo(destination); // keep heading where the old leader was going
    this.followTimer = FOLLOW_INTERVAL; // reshuffle the formation right away
    this.emit('leaderChanged', next);
  }

  enterCombat() {
    this.inCombat = true;
    for (const m of this.members) {
      m.stop();
      m.showHpBar = true;
    }
  }

  /** Fight over: the fallen get back up at 1 HP; damage carries over. */
  exitCombat() {
    this.inCombat = false;
    for (const m of this.members) {
      if (!m.alive) m.revive(1);
      m.resetCombatState();
      m.stop();
      m.showHpBar = false;
    }
    this.formationAngle = this.leader.facing;
    this.followTimer = FOLLOW_INTERVAL; // regroup right away
  }

  /** Sends the leader towards `target`. Returns the actual destination, or null if unreachable. */
  moveTo(target: Point): Point | null {
    if (this.inCombat) return null;
    const path = this.pathfinder.findPath(this.leader, target);
    if (!path || !path.length) return null;
    this.leader.setPath(path);
    return path[path.length - 1];
  }

  update(dt: number) {
    if (this.inCombat) {
      // In a fight, CombatSystem decides where each member walks.
      for (const m of this.members) m.update(dt, m.speed);
      return;
    }
    this.leader.update(dt, this.speed);
    this.formationAngle = lerpAngle(this.formationAngle, this.leader.facing, Math.min(1, dt * 4));

    this.followTimer += dt;
    const refresh = this.followTimer >= FOLLOW_INTERVAL;
    if (refresh) this.followTimer = 0;

    this.followers.forEach((m, i) => {
      const slot = this.slotPosition(i);
      if (refresh) this.updateFollowerPath(m, slot);
      const far = Math.hypot(slot.x - m.x, slot.y - m.y) > CATCH_UP_DISTANCE;
      m.update(dt, this.speed * (far ? CATCH_UP_SPEED : 1));
    });
  }

  private updateFollowerPath(m: PartyMember, slot: Point) {
    const atSlot = Math.hypot(slot.x - m.x, slot.y - m.y) < 2;
    if (atSlot) {
      m.stop();
      return;
    }
    if (m.goal && Math.hypot(slot.x - m.goal.x, slot.y - m.goal.y) < REPATH_DISTANCE) return;
    const path = this.pathfinder.findPath(m, slot);
    if (path) m.setPath(path);
  }

  /** World position of formation slot `i`, nudged onto walkable ground. */
  private slotPosition(i: number): Point {
    const f = FORMATION[i % FORMATION.length];
    const fx = Math.cos(this.formationAngle);
    const fy = Math.sin(this.formationAngle);
    // right-hand vector is the forward vector rotated 90° clockwise (screen y points down)
    const rx = -fy;
    const ry = fx;
    const p = {
      x: this.leader.x - fx * f.back + rx * f.side,
      y: this.leader.y - fy * f.back + ry * f.side,
    };
    if (this.pathfinder.lineOfSight(this.leader, p)) return p;
    return this.pathfinder.nearestWalkablePoint(p) ?? { x: this.leader.x, y: this.leader.y };
  }
}

function lerpAngle(a: number, b: number, t: number) {
  const diff = Phaser.Math.Angle.Wrap(b - a);
  return a + diff * t;
}
