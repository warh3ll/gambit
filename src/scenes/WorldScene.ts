import Phaser from 'phaser';
import { TILE_SIZE } from '../config';
import { ENEMIES } from '../data/enemies';
import { BARRELSBY_ROAD } from '../data/maps/barrelsbyRoad';
import { ENDING, INTRO, type Line, TRIGGERS } from '../data/story';
import { session } from '../game/session';
import { CombatManager, type CombatResult } from '../systems/CombatManager';
import { CombatSystem } from '../systems/CombatSystem';
import { Pathfinder, type Point } from '../systems/Pathfinder';
import { pixelCamera } from '../view';
import { Enemy } from '../world/Enemy';
import { type LoadedMap, loadMap } from '../world/mapLoader';
import { Party } from '../world/Party';
import { isBlocking } from '../world/tiles';
import type { DialogData } from './DialogScene';
import type { UIScene } from './UIScene';

/** The area this scene shows. (Only one area until M10.) */
const AREA_ID = 'barrelsbyRoad';

/** How often (seconds) the leader's position is remembered, for retry checkpoints. */
const TRAIL_INTERVAL = 0.25;
const TRAIL_LENGTH = 80;
/** A retry checkpoint must be at least this far outside every enemy's aggro radius. */
const CHECKPOINT_MARGIN = 24;

interface Checkpoint {
  pos: Point;
  hp: Map<string, number>;
}

/** The explorable world: map, party movement, enemies, story triggers and camera. */
export class WorldScene extends Phaser.Scene {
  party!: Party;
  combat!: CombatManager;
  private map!: LoadedMap;
  private pathfinder!: Pathfinder;
  private combatSystem!: CombatSystem;
  private enemies: Enemy[] = [];
  private leaderMarker!: Phaser.GameObjects.Image;
  private aggroDebug!: Phaser.GameObjects.Graphics;

  /** Recent leader positions, newest last. */
  private trail: Point[] = [];
  private trailTimer = 0;
  /** Where (and with what HP) the party retries after a defeat. */
  private checkpoint!: Checkpoint;
  /** Clicks are ignored until this time (ms), so the click that closes an overlay doesn't move the party. */
  private ignoreClicksUntil = 0;
  /** The slice's ending has played. */
  private ended = false;

  constructor() {
    super('World');
  }

  create() {
    this.map = loadMap(BARRELSBY_ROAD);
    const { width, height, tiles } = this.map;
    const tilemap = this.make.tilemap({ data: tiles, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const tileset = tilemap.addTilesetImage('tiles');
    if (!tileset) throw new Error('tileset "tiles" missing');
    tilemap.createLayer(0, tileset, 0, 0)?.setDepth(0);

    this.pathfinder = new Pathfinder(width, height, TILE_SIZE, (tx, ty) => !isBlocking(tiles[ty][tx]));
    const spawn = this.pathfinder.tileCenter(this.map.spawn.x, this.map.spawn.y);
    this.party = new Party(this, this.pathfinder, spawn);
    this.enemies = this.spawnEncounters();
    const start = this.applySave(spawn);
    this.combat = new CombatManager(this.party, this.enemies);
    this.combatSystem = new CombatSystem(this, this.pathfinder);
    this.checkpoint = { pos: start, hp: this.party.snapshotHp() };
    this.combat.on('combatStart', () => this.saveCheckpoint());
    this.combat.on('combatEnd', (result: CombatResult, fought: Enemy[]) => this.onCombatEnd(result, fought));

    this.leaderMarker = this.add.image(0, 0, 'leader-marker').setDepth(10_000);
    this.aggroDebug = this.add.graphics().setDepth(2).setVisible(false);

    pixelCamera(this, false);
    const cam = this.cameras.main;
    cam.setBounds(0, 0, width * TILE_SIZE, height * TILE_SIZE);
    cam.startFollow(this.party.leader.sprite, true, 0.12, 0.12);
    this.party.on('leaderChanged', () => {
      cam.startFollow(this.party.leader.sprite, true, 0.12, 0.12);
      if (!this.combat.inCombat) this.saveGame();
    });

    this.input.mouse?.disableContextMenu();
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onClick(pointer));
    this.events.on(Phaser.Scenes.Events.RESUME, () => (this.ignoreClicksUntil = performance.now() + 150));
    this.input.keyboard?.on('keydown-T', () => this.openTactics());

    if (import.meta.env.DEV) {
      // Debug keys (dev builds only).
      this.input.keyboard?.on('keydown-K', () => this.combat.debugDefeatEngaged());
      this.input.keyboard?.on('keydown-V', () => this.aggroDebug.setVisible(!this.aggroDebug.visible));
      this.input.keyboard?.on('keydown-J', () => this.jumpToNextFight());
    }

    // Save when the tab is hidden or closed, unless mid-fight or mid-dialogue (then the last autosave stands).
    const onHide = () => {
      if (document.visibilityState === 'hidden' && !this.combat.inCombat && !this.scene.isPaused()) this.saveGame();
    };
    document.addEventListener('visibilitychange', onHide);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => document.removeEventListener('visibilitychange', onHide));

    this.scene.launch('UI', { party: this.party, combat: this.combat });
    if (!session.flag('introPlayed')) {
      this.time.delayedCall(400, () => this.playStory(INTRO, () => session.setFlag('introPlayed')));
    }
  }

  // ── saving ──

  /** Puts the saved game into the world. Returns where the party starts. */
  private applySave(spawn: Point): Point {
    const save = session.data;
    for (const m of this.party.members) {
      const saved = save.members[m.id];
      if (!saved) continue;
      m.hp = Math.max(1, Math.min(m.maxHp, saved.hp));
      m.tactics = saved.tactics.map((r) => ({ ...r }));
    }
    this.party.setLeader(save.leaderId);
    for (const e of this.enemies) if (save.beaten.includes(`${AREA_ID}/${e.groupId}`)) e.despawn();

    const start = save.area === AREA_ID && save.position ? save.position : spawn;
    this.party.face(0); // face east, down the road
    this.party.placeAt(start);
    return start;
  }

  /** Copies the world into the save and writes it (autosave). */
  private saveGame() {
    const save = session.data;
    const l = this.party.leader;
    save.area = AREA_ID;
    save.position = { x: Math.round(l.x), y: Math.round(l.y) };
    save.leaderId = l.id;
    for (const m of this.party.members) {
      const saved = save.members[m.id];
      if (!saved) continue;
      saved.hp = m.hp;
      saved.tactics = m.tactics.map((r) => ({ ...r }));
    }
    session.autosave();
  }

  update(_time: number, deltaMs: number) {
    const dt = Math.min(deltaMs / 1000, 0.1); // clamp so a hitch doesn't teleport anyone
    for (const u of this.party.members) u.tickTimers(dt);
    for (const e of this.enemies) e.tickTimers(dt);

    if (!this.combat.inCombat) {
      this.recordTrail(dt);
      if (this.checkTriggers()) return; // a story beat just paused the world
    }

    this.combat.update(); // start / end fights
    this.combatSystem.update(dt, this.party.members, [...this.combat.engaged], this.combat.inCombat);
    this.party.update(dt);
    for (const e of this.enemies) e.update(dt, e.speed);

    const s = this.party.leader.sprite;
    this.leaderMarker.setPosition(s.x, s.y - s.height - 4);
    if (this.aggroDebug.visible) this.drawAggroRanges();
  }

  // ── overlays ──

  /** Opens the tactics editor; the world (and combat) pauses while it's open. */
  private openTactics() {
    this.scene.pause();
    this.scene.pause('UI');
    this.scene.launch('Tactics', { party: this.party });
  }

  /** Shows story lines; the world pauses until they're read. Autosaves afterwards. */
  private playStory(lines: Line[], onDone?: () => void) {
    const done = () => {
      onDone?.();
      if (!this.combat.inCombat && !this.ended) this.saveGame();
    };
    if (!lines.length) {
      done();
      return;
    }
    this.scene.pause();
    this.scene.pause('UI');
    this.scene.launch('Dialog', { lines, onDone: done } satisfies DialogData);
  }

  /** Plays a story trigger when the leader steps on one. Returns true if one started. */
  private checkTriggers(): boolean {
    const l = this.party.leader;
    const digit = this.map.triggers.get(`${Math.floor(l.x / TILE_SIZE)},${Math.floor(l.y / TILE_SIZE)}`);
    const flag = `trigger.${AREA_ID}.${digit}`;
    if (!digit || session.flag(flag)) return false;
    const trigger = TRIGGERS[digit];
    if (!trigger?.lines.length) return false;
    this.playStory(trigger.lines, () => {
      session.setFlag(flag); // only once read, so reloading mid-dialogue plays it again
      if (trigger.startsFight) this.nearestGroupAttacks();
    });
    return true;
  }

  // ── fights ──

  private nearestGroupAttacks() {
    const l = this.party.leader;
    const alive = this.enemies.filter((e) => e.alive);
    if (!alive.length) return;
    const nearest = alive.reduce((a, b) => (dist(l, a) < dist(l, b) ? a : b));
    this.combat.engageGroup(nearest.groupId);
  }

  /** Remembers where to retry from: a recent spot outside every enemy's reach, and the party's HP right now. */
  private saveCheckpoint() {
    const alive = this.enemies.filter((e) => e.alive);
    const safe = (p: Point) => alive.every((e) => dist(p, e) > e.def.aggroRadius + CHECKPOINT_MARGIN);
    let pos: Point | null = null;
    for (let i = this.trail.length - 1; i >= 0 && !pos; i--) if (safe(this.trail[i])) pos = this.trail[i];
    this.checkpoint = { pos: pos ?? this.checkpoint.pos, hp: this.party.snapshotHp() };
  }

  private onCombatEnd(result: CombatResult, fought: Enemy[]) {
    this.combatSystem.clearProjectiles();
    if (result === 'defeat') {
      // Retry from just before the fight, with the HP the party had when it started.
      for (const e of fought) e.resetToHome();
      const c = this.checkpoint.pos;
      const facing = Math.atan2(avg(fought, 'y') - c.y, avg(fought, 'x') - c.x); // towards the fight
      this.party.restore(c, this.checkpoint.hp, facing);
      this.trail = [{ ...this.checkpoint.pos }];
      this.cameras.main.fadeIn(800, 13, 11, 20);
      this.saveGame();
      return;
    }
    for (const groupId of new Set(fought.map((e) => e.groupId))) {
      const id = `${AREA_ID}/${groupId}`;
      if (!session.data.beaten.includes(id)) session.data.beaten.push(id);
    }
    this.saveGame();
    if (fought.some((e) => e.def.id === 'stranger')) {
      this.time.delayedCall(1500, () => this.playStory(ENDING, () => this.finish()));
    }
  }

  private finish() {
    this.ended = true;
    session.setFlag('sliceComplete');
    this.saveGame();
    this.scene.pause();
    this.scene.pause('UI');
    this.scene.launch('End');
  }

  private recordTrail(dt: number) {
    this.trailTimer -= dt;
    if (this.trailTimer > 0) return;
    this.trailTimer = TRAIL_INTERVAL;
    const l = this.party.leader;
    this.trail.push({ x: l.x, y: l.y });
    if (this.trail.length > TRAIL_LENGTH) this.trail.shift();
  }

  private spawnEncounters(): Enemy[] {
    const out: Enemy[] = [];
    for (const group of this.map.encounters) {
      group.enemies.forEach((spec, i) => {
        const p = this.pathfinder.tileCenter(spec.x, spec.y);
        const enemy = new Enemy(this, ENEMIES[spec.type], `${group.id}-${i}`, group.id, p.x, p.y);
        enemy.facing = Math.PI; // face west, towards where the party comes from
        out.push(enemy);
      });
    }
    return out;
  }

  // ── input ──

  private onClick(pointer: Phaser.Input.Pointer) {
    if (!pointer.leftButtonDown()) return;
    if (performance.now() < this.ignoreClicksUntil) return;
    const ui = this.scene.get('UI') as UIScene;
    if (ui.isOverUI(pointer)) return;
    if (this.combat.inCombat) return; // the party follows its tactics in a fight

    // Convert via this scene's camera explicitly (worldX may come from the UI scene's camera).
    const world = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
    const dest = this.party.moveTo({ x: world.x, y: world.y });
    if (dest) this.showClickMarker(dest.x, dest.y);
  }

  private showClickMarker(x: number, y: number) {
    const ring = this.add.image(x, y, 'click-marker').setDepth(2).setScale(1.4).setAlpha(0.9);
    this.tweens.add({
      targets: ring,
      scale: 0.4,
      alpha: 0,
      duration: 450,
      ease: 'Quad.easeIn',
      onComplete: () => ring.destroy(),
    });
  }

  // ── debug ──

  /** Dev key J: puts the party just west of the next group still standing. */
  private jumpToNextFight() {
    if (this.combat.inCombat) return;
    const next = this.map.encounters
      .map((g) => this.enemies.filter((e) => e.groupId === g.id && e.alive))
      .find((g) => g.length);
    if (!next) return;
    const front = next.reduce((a, b) => (a.x < b.x ? a : b));
    const target = { x: front.x - front.def.aggroRadius - 40, y: front.y };
    const p = this.pathfinder.nearestWalkablePoint(target);
    if (!p) return;
    this.party.face(0);
    this.party.placeAt(p);
    this.trail = [{ ...p }];
  }

  private drawAggroRanges() {
    const g = this.aggroDebug.clear();
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const engaged = this.combat.engaged.has(e);
      g.lineStyle(1, engaged ? 0xff5a5a : 0xffd966, 0.6).strokeCircle(e.x, e.y, e.def.aggroRadius);
    }
  }
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const avg = (units: Point[], k: 'x' | 'y') => units.reduce((s, u) => s + u[k], 0) / units.length;
