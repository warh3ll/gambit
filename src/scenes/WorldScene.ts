import Phaser from 'phaser';
import { TILE_SIZE } from '../config';
import { ENEMIES } from '../data/enemies';
import { getArea } from '../data/areas';
import type { AreaDef } from '../data/areas/types';
import { NPCS } from '../data/npcs';
import { ENDING, INTRO, type Line, TRIGGERS } from '../data/story';
import { session } from '../game/session';
import { CombatManager, type CombatResult } from '../systems/CombatManager';
import { CombatSystem } from '../systems/CombatSystem';
import { Pathfinder, type Point } from '../systems/Pathfinder';
import { pixelCamera, type ViewSize } from '../view';
import { Enemy } from '../world/Enemy';
import { type LoadedMap, loadMap } from '../world/mapLoader';
import { drawTileBorder } from '../world/highlight';
import { Npc } from '../world/Npc';
import { Party } from '../world/Party';
import { isBlocking } from '../world/tiles';
import type { DialogData } from './DialogScene';
import type { UIScene } from './UIScene';

/** How the world scene is started: a specific area/arrival point, or (by default) wherever the save says. */
export interface WorldData {
  area?: string;
  /** Start point name in that area (set when arriving through an exit). */
  entry?: string;
}

/** Talking range: the leader stops and talks once this close to an NPC. */
const TALK_DISTANCE = 20;
const FADE_MS = 250;

/** How often (seconds) the leader's position is remembered, for retry checkpoints. */
const TRAIL_INTERVAL = 0.25;
const TRAIL_LENGTH = 80;
/** A retry checkpoint must be at least this far outside every enemy's aggro radius. */
const CHECKPOINT_MARGIN = 24;

interface Checkpoint {
  pos: Point;
  hp: Map<string, number>;
}

/**
 * The explorable world: one area at a time (map, party, enemies, NPCs, exits, story triggers, camera).
 * Going through an exit restarts this scene with the next area; every area load respawns its enemies.
 */
export class WorldScene extends Phaser.Scene {
  party!: Party;
  combat!: CombatManager;
  private area!: AreaDef;
  private entry: string | undefined;
  private map!: LoadedMap;
  /** NPC the party is walking up to, to talk. */
  private talkTarget: Npc | null = null;
  private transitioning = false;
  private pathfinder!: Pathfinder;
  private combatSystem!: CombatSystem;
  private enemies: Enemy[] = [];
  private leaderMarker!: Phaser.GameObjects.Image;
  private aggroDebug!: Phaser.GameObjects.Graphics;
  /** Border drawn around the exit (door) under the mouse. */
  private exitHover!: Phaser.GameObjects.Graphics;
  private hoveredExit: string | null = null;
  private npcs: Npc[] = [];

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

  init(data: WorldData) {
    this.area = getArea(data?.area ?? session.data.area);
    this.entry = data?.entry;
    this.enemies = [];
    this.talkTarget = null;
    this.transitioning = false;
    this.trail = [];
    this.trailTimer = 0;
    this.ended = false;
  }

  create() {
    this.map = loadMap(this.area);
    const { width, height, tiles } = this.map;
    const tilemap = this.make.tilemap({ data: tiles, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const tileset = tilemap.addTilesetImage('tiles');
    if (!tileset) throw new Error('tileset "tiles" missing');
    tilemap.createLayer(0, tileset, 0, 0)?.setDepth(0);

    this.pathfinder = new Pathfinder(width, height, TILE_SIZE, (tx, ty) => !isBlocking(tiles[ty][tx]));
    const startTile = this.map.starts.get('default') ?? [...this.map.starts.values()][0];
    const spawn = this.pathfinder.tileCenter(startTile.x, startTile.y);
    this.party = new Party(this, this.pathfinder, spawn);
    this.enemies = this.spawnEncounters();
    this.npcs = this.map.npcs.map((n) => {
      const def = NPCS[n.id];
      if (!def) throw new Error(`${this.area.id}: unknown NPC "${n.id}"`);
      const p = this.pathfinder.tileCenter(n.x, n.y);
      return new Npc(this, def, p.x, p.y);
    });
    const start = this.applySave(spawn);
    this.combat = new CombatManager(this.party, this.enemies);
    this.combatSystem = new CombatSystem(this, this.pathfinder);
    this.checkpoint = { pos: start, hp: this.party.snapshotHp() };
    this.combat.on('combatStart', () => this.saveCheckpoint());
    this.combat.on('combatEnd', (result: CombatResult, fought: Enemy[]) => this.onCombatEnd(result, fought));

    this.leaderMarker = this.add.image(0, 0, 'leader-marker').setDepth(10_000);
    this.aggroDebug = this.add.graphics().setDepth(2).setVisible(false);
    this.exitHover = this.add.graphics().setDepth(3);
    this.hoveredExit = null;

    const cam = this.cameras.main;
    if (this.area.kind !== 'outdoor') cam.setBackgroundColor('#0d0b14');
    pixelCamera(this, false, (view) => this.fitCamera(view));
    cam.fadeIn(FADE_MS, 13, 11, 20);
    cam.startFollow(this.party.leader.sprite, true, 0.12, 0.12);
    this.party.on('leaderChanged', () => {
      cam.startFollow(this.party.leader.sprite, true, 0.12, 0.12);
      if (!this.combat.inCombat) this.saveGame();
    });

    this.input.mouse?.disableContextMenu();
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) =>
      this.onClick(pointer, over),
    );
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
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      document.removeEventListener('visibilitychange', onHide);
      this.input.setDefaultCursor('default');
    });

    this.scene.launch('UI', { party: this.party, combat: this.combat, areaName: this.area.name });
    if (this.entry) this.saveGame(); // arrived through an exit: save the new area
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
    // Only unique groups stay beaten; everything else respawned with this area load.
    for (const e of this.enemies) if (save.beaten.includes(this.encounterKey(e.groupId))) e.despawn();

    let start = spawn;
    let facing = 0; // east
    const entryTile = this.entry ? this.map.starts.get(this.entry) : undefined;
    if (entryTile) {
      start = this.pathfinder.tileCenter(entryTile.x, entryTile.y);
      // Face the door you came through, so the followers line up behind the leader, away from it.
      facing = this.towardsNearestExit(start);
    } else if (save.area === this.area.id && save.position) {
      start = save.position;
    }
    this.party.face(facing);
    this.party.placeAt(start);
    return start;
  }

  /** Copies the party into the save data (without writing it). */
  private captureParty() {
    const save = session.data;
    save.leaderId = this.party.leader.id;
    for (const m of this.party.members) {
      const saved = save.members[m.id];
      if (!saved) continue;
      saved.hp = m.hp;
      saved.tactics = m.tactics.map((r) => ({ ...r }));
    }
  }

  /** Copies the world into the save and writes it (autosave). */
  private saveGame() {
    const l = this.party.leader;
    this.captureParty();
    session.data.area = this.area.id;
    session.data.position = { x: Math.round(l.x), y: Math.round(l.y) };
    session.autosave();
  }

  private encounterKey(groupId: string) {
    return `${this.area.id}/${groupId}`;
  }

  update(_time: number, deltaMs: number) {
    const dt = Math.min(deltaMs / 1000, 0.1); // clamp so a hitch doesn't teleport anyone
    for (const u of this.party.members) u.tickTimers(dt);
    for (const e of this.enemies) e.tickTimers(dt);

    if (this.transitioning) return;
    if (!this.combat.inCombat) {
      this.recordTrail(dt);
      if (this.checkTriggers()) return; // a story beat just paused the world
      if (this.checkExit()) return;
      this.checkTalk();
    }

    this.combat.update(); // start / end fights
    this.combatSystem.update(dt, this.party.members, [...this.combat.engaged], this.combat.inCombat);
    this.party.update(dt);
    for (const e of this.enemies) e.update(dt, e.speed);

    const s = this.party.leader.sprite;
    this.leaderMarker.setPosition(s.x, s.y - s.height - 4);
    this.updateExitHover();
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
    const id = this.map.triggers.get(tileKey(l));
    const flag = `story.${id}`;
    if (!id || session.flag(flag)) return false;
    const trigger = TRIGGERS[id];
    if (!trigger?.lines.length) return false;
    this.playStory(trigger.lines, () => {
      session.setFlag(flag); // only once read, so reloading mid-dialogue plays it again
      if (trigger.startsFight) this.nearestGroupAttacks();
    });
    return true;
  }

  // ── travel & talking ──

  /** Goes through an exit when the leader steps on one. Returns true if leaving. */
  private checkExit(): boolean {
    const exit = this.map.exits.get(tileKey(this.party.leader));
    if (!exit) return false;
    this.transitioning = true;
    this.talkTarget = null;
    for (const m of this.party.members) m.stop();
    this.captureParty(); // the next area rebuilds the party from the save data
    const cam = this.cameras.main;
    cam.fadeOut(FADE_MS, 13, 11, 20);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () =>
      this.scene.restart({ area: exit.to, entry: exit.at } satisfies WorldData),
    );
    return true;
  }

  /** Highlights the door (exit) under the mouse, with a hand cursor. Hidden during fights. */
  private updateExitHover() {
    const pointer = this.input.activePointer;
    const ui = this.scene.get('UI') as UIScene;
    let key: string | null = null;
    if (!this.combat.inCombat && !this.transitioning && !ui.isOverUI(pointer)) {
      const p = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
      const k = tileKey(p);
      if (this.map.exits.has(k)) key = k;
    }
    if (this.combat.inCombat) for (const n of this.npcs) n.setHighlight(false);
    const hand = key !== null || this.npcs.some((n) => n.highlighted);
    const cursor = hand ? 'pointer' : 'default';
    if (this.input.manager.defaultCursor !== cursor) this.input.setDefaultCursor(cursor);
    if (key === this.hoveredExit) return;
    this.hoveredExit = key;
    this.exitHover.clear();
    if (key) drawTileBorder(this.exitHover, this.connectedExitTiles(key), TILE_SIZE);
  }

  /** The exit tiles that belong together with `key` (touching, same destination), e.g. a double door. */
  private connectedExitTiles(key: string): { x: number; y: number }[] {
    const target = this.map.exits.get(key);
    const out: { x: number; y: number }[] = [];
    const seen = new Set<string>([key]);
    const queue = [key];
    while (queue.length) {
      const k = queue.shift()!;
      const [x, y] = k.split(',').map(Number);
      out.push({ x, y });
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = `${x + dx},${y + dy}`;
        const e = this.map.exits.get(n);
        if (!seen.has(n) && e && e.to === target?.to && e.at === target?.at) {
          seen.add(n);
          queue.push(n);
        }
      }
    }
    return out;
  }

  private talkTo(npc: Npc) {
    this.talkTarget = npc;
    if (dist(this.party.leader, npc) > TALK_DISTANCE) this.party.moveTo(npc);
  }

  /** Starts the conversation once the leader has walked up to the NPC (or gives up if they stopped short). */
  private checkTalk() {
    const npc = this.talkTarget;
    if (!npc) return;
    const l = this.party.leader;
    if (dist(l, npc) <= TALK_DISTANCE) {
      this.talkTarget = null;
      npc.setHighlight(false);
      l.stop();
      l.faceTowards(npc);
      npc.faceTowards(l);
      this.playStory(npc.def.lines);
    } else if (!l.moving) {
      this.talkTarget = null;
    }
  }

  /** Direction from `p` towards the closest exit. */
  private towardsNearestExit(p: Point): number {
    let best: Point | null = null;
    for (const key of this.map.exits.keys()) {
      const [tx, ty] = key.split(',').map(Number);
      const c = this.pathfinder.tileCenter(tx, ty);
      if (!best || dist(p, c) < dist(p, best)) best = c;
    }
    return best ? Math.atan2(best.y - p.y, best.x - p.x) : 0;
  }

  /** Camera limits: the map, centred when it's smaller than the screen (e.g. a small house). */
  private fitCamera(view: ViewSize) {
    const w = this.map.width * TILE_SIZE;
    const h = this.map.height * TILE_SIZE;
    const x = w < view.width ? Math.floor((w - view.width) / 2) : 0;
    const y = h < view.height ? Math.floor((h - view.height) / 2) : 0;
    this.cameras.main.setBounds(x, y, Math.max(w, view.width), Math.max(h, view.height));
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
    // Unique groups (story/boss fights) stay beaten; the rest respawn next time the area loads.
    for (const groupId of new Set(fought.map((e) => e.groupId))) {
      const unique = this.map.encounters.find((g) => g.id === groupId)?.unique;
      const key = this.encounterKey(groupId);
      if (unique && !session.data.beaten.includes(key)) session.data.beaten.push(key);
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

  private onClick(pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) {
    if (!pointer.leftButtonDown()) return;
    if (performance.now() < this.ignoreClicksUntil || this.transitioning) return;
    const ui = this.scene.get('UI') as UIScene;
    if (ui.isOverUI(pointer)) return;
    if (this.combat.inCombat) return; // the party follows its tactics in a fight

    const npc = over.map((o) => o.getData('npc') as Npc | undefined).find(Boolean);
    if (npc) {
      this.talkTo(npc);
      return;
    }
    this.talkTarget = null;

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
const tileKey = (p: Point) => `${Math.floor(p.x / TILE_SIZE)},${Math.floor(p.y / TILE_SIZE)}`;
const avg = (units: Point[], k: 'x' | 'y') => units.reduce((s, u) => s + u[k], 0) / units.length;
