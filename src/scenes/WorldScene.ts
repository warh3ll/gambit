import Phaser from 'phaser';
import { TILE_SIZE } from '../config';
import { Pathfinder } from '../systems/Pathfinder';
import { Party } from '../world/Party';
import { MAP_HEIGHT, MAP_WIDTH, SPAWN, buildTestMap, isBlocking } from '../world/testMap';
import type { UIScene } from './UIScene';

/** The explorable world: map, party movement and camera. */
export class WorldScene extends Phaser.Scene {
  party!: Party;
  private leaderMarker!: Phaser.GameObjects.Image;

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
    const spawn = pathfinder.tileCenter(SPAWN.x, SPAWN.y);
    this.party = new Party(this, pathfinder, spawn);

    this.leaderMarker = this.add.image(0, 0, 'leader-marker').setDepth(10_000);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE);
    cam.startFollow(this.party.leader.sprite, true, 0.12, 0.12);
    this.party.on('leaderChanged', () => cam.startFollow(this.party.leader.sprite, true, 0.12, 0.12));

    this.input.mouse?.disableContextMenu();
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onClick(pointer));

    this.scene.launch('UI', { party: this.party });
  }

  update(_time: number, deltaMs: number) {
    const dt = Math.min(deltaMs / 1000, 0.1); // clamp so a hitch doesn't teleport anyone
    this.party.update(dt);
    const s = this.party.leader.sprite;
    this.leaderMarker.setPosition(s.x, s.y - s.height - 4);
  }

  private onClick(pointer: Phaser.Input.Pointer) {
    if (!pointer.leftButtonDown()) return;
    const ui = this.scene.get('UI') as UIScene;
    if (ui.isOverUI(pointer.x, pointer.y)) return;

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
}
