import Phaser from 'phaser';
import { TILE_SIZE } from '../config';
import { ENEMIES } from '../data/enemies';
import { CombatManager, type CombatResult } from '../systems/CombatManager';
import { CombatSystem } from '../systems/CombatSystem';
import { Pathfinder } from '../systems/Pathfinder';
import { Enemy } from '../world/Enemy';
import { Party } from '../world/Party';
import { ENCOUNTERS, MAP_HEIGHT, MAP_WIDTH, SPAWN, buildTestMap, isBlocking } from '../world/testMap';
import { pixelCamera } from '../view';
import type { UIScene } from './UIScene';

/** The explorable world: map, party movement, enemies and camera. */
export class WorldScene extends Phaser.Scene {
  party!: Party;
  combat!: CombatManager;
  private combatSystem!: CombatSystem;
  private spawnPoint!: { x: number; y: number };
  private enemies: Enemy[] = [];
  private leaderMarker!: Phaser.GameObjects.Image;
  private aggroDebug!: Phaser.GameObjects.Graphics;

  constructor() {
    super('World');
  }

  create() {
    const data = buildTestMap();
    const map = this.make.tilemap({ data, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const tileset = map.addTilesetImage('tiles');
    if (!tileset) throw new Error('tileset "tiles" missing');
    map.createLayer(0, tileset, 0, 0)?.setDepth(0);

    const pathfinder = new Pathfinder(MAP_WIDTH, MAP_HEIGHT, TILE_SIZE, (tx, ty) => !isBlocking(data[ty][tx]));
    this.spawnPoint = pathfinder.tileCenter(SPAWN.x, SPAWN.y);
    this.party = new Party(this, pathfinder, this.spawnPoint);
    this.enemies = this.spawnEncounters(pathfinder);
    this.combat = new CombatManager(this.party, this.enemies);
    this.combatSystem = new CombatSystem(this, pathfinder);
    this.combat.on('combatEnd', (result: CombatResult, fought: Enemy[]) => this.onCombatEnd(result, fought));

    this.leaderMarker = this.add.image(0, 0, 'leader-marker').setDepth(10_000);
    this.aggroDebug = this.add.graphics().setDepth(2).setVisible(false);

    pixelCamera(this, false);
    const cam = this.cameras.main;
    cam.setBounds(0, 0, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE);
    cam.startFollow(this.party.leader.sprite, true, 0.12, 0.12);
    this.party.on('leaderChanged', () => cam.startFollow(this.party.leader.sprite, true, 0.12, 0.12));

    this.input.mouse?.disableContextMenu();
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onClick(pointer));

    // Debug keys (temporary).
    this.input.keyboard?.on('keydown-K', () => this.combat.debugDefeatEngaged());
    this.input.keyboard?.on('keydown-V', () => this.aggroDebug.setVisible(!this.aggroDebug.visible));
    this.input.keyboard?.on('keydown-T', () => this.openTactics());

    this.scene.launch('UI', { party: this.party, combat: this.combat });
  }

  update(_time: number, deltaMs: number) {
    const dt = Math.min(deltaMs / 1000, 0.1); // clamp so a hitch doesn't teleport anyone
    for (const u of this.party.members) u.tickTimers(dt);
    for (const e of this.enemies) e.tickTimers(dt);

    this.combat.update(); // start / end fights
    this.combatSystem.update(dt, this.party.members, [...this.combat.engaged], this.combat.inCombat);
    this.party.update(dt);
    for (const e of this.enemies) e.update(dt, e.speed);

    const s = this.party.leader.sprite;
    this.leaderMarker.setPosition(s.x, s.y - s.height - 4);
    if (this.aggroDebug.visible) this.drawAggroRanges();
  }

  /** Opens the tactics editor; the world (and combat) pauses while it's open. */
  private openTactics() {
    this.scene.pause();
    this.scene.pause('UI');
    this.scene.launch('Tactics', { party: this.party });
  }

  private onCombatEnd(result: CombatResult, fought: Enemy[]) {
    this.combatSystem.clearProjectiles();
    if (result !== 'defeat') return;
    // Placeholder until defeat is designed: retry from the start, fight reset.
    for (const e of fought) e.resetToHome();
    this.party.respawn(this.spawnPoint);
    this.cameras.main.fadeIn(800, 13, 11, 20);
  }

  private spawnEncounters(pathfinder: Pathfinder): Enemy[] {
    const out: Enemy[] = [];
    for (const group of ENCOUNTERS) {
      group.enemies.forEach((spec, i) => {
        const tile = pathfinder.nearestWalkableTile(spec.x, spec.y);
        if (!tile) throw new Error(`no walkable tile near enemy ${group.id}#${i}`);
        const p = pathfinder.tileCenter(tile.x, tile.y);
        const enemy = new Enemy(this, ENEMIES[spec.type], `${group.id}-${i}`, group.id, p.x, p.y);
        enemy.facing = Math.PI; // face west, towards where the party comes from
        out.push(enemy);
      });
    }
    return out;
  }

  private onClick(pointer: Phaser.Input.Pointer) {
    if (!pointer.leftButtonDown()) return;
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

  private drawAggroRanges() {
    const g = this.aggroDebug.clear();
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const engaged = this.combat.engaged.has(e);
      g.lineStyle(1, engaged ? 0xff5a5a : 0xffd966, 0.6).strokeCircle(e.x, e.y, e.def.aggroRadius);
    }
  }
}
