import Phaser from 'phaser';
import { TILE_SIZE } from '../config';
import { ENEMIES } from '../data/enemies';
import { PARTY } from '../data/party';
import { TILE_COUNT, Tile } from '../world/testMap';

export const PORTRAIT_SIZE = 22;

/**
 * Loads (or, for now, generates) assets and hands over to the world.
 * Everything here is placeholder art drawn with Graphics.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    const g = this.add.graphics();
    const ink = 0x0d0b14;

    // Characters: coloured body with outline and eyes.
    for (const c of PARTY) {
      g.clear();
      g.fillStyle(ink).fillRect(0, 0, 12, 16);
      g.fillStyle(c.color).fillRect(1, 1, 10, 14);
      g.fillStyle(ink).fillRect(3, 4, 2, 2).fillRect(7, 4, 2, 2);
      g.generateTexture(`char-${c.id}`, 12, 16);
    }

    // Enemies: coloured body with red eyes, sized per type.
    for (const e of Object.values(ENEMIES)) {
      const { w, h } = e.size;
      g.clear();
      g.fillStyle(ink).fillRect(0, 0, w, h);
      g.fillStyle(e.color).fillRect(1, 1, w - 2, h - 2);
      g.fillStyle(0xff3b3b).fillRect(w - 5, 3, 2, 2).fillRect(w - 9, 3, 2, 2);
      g.generateTexture(`enemy-${e.id}`, w, h);
    }

    // Portraits: face crop of the same placeholder.
    const p = PORTRAIT_SIZE - 4;
    for (const c of PARTY) {
      g.clear();
      g.fillStyle(0x2a2438).fillRect(0, 0, p, p);
      g.fillStyle(c.color).fillRect(3, 4, p - 6, p - 4);
      g.fillStyle(ink).fillRect(6, 9, 2, 3).fillRect(p - 8, 9, 2, 3);
      g.generateTexture(`portrait-${c.id}`, p, p);
    }

    // Portrait frames: normal and leader.
    for (const [key, color] of [
      ['frame', 0x4a4060],
      ['frame-leader', 0xf2d16b],
    ] as const) {
      g.clear();
      g.fillStyle(ink).fillRect(0, 0, PORTRAIT_SIZE, PORTRAIT_SIZE);
      g.fillStyle(color).fillRect(1, 1, PORTRAIT_SIZE - 2, PORTRAIT_SIZE - 2);
      g.fillStyle(ink).fillRect(2, 2, PORTRAIT_SIZE - 4, PORTRAIT_SIZE - 4);
      g.generateTexture(key, PORTRAIT_SIZE, PORTRAIT_SIZE);
    }

    // Leader marker: small gold chevron.
    g.clear();
    g.fillStyle(ink).fillTriangle(0, 0, 8, 0, 4, 5);
    g.fillStyle(0xf2d16b).fillTriangle(1, 1, 7, 1, 4, 4);
    g.generateTexture('leader-marker', 8, 5);

    // Click marker: ring.
    g.clear();
    g.lineStyle(1, 0xffffff).strokeCircle(6, 6, 5);
    g.generateTexture('click-marker', 12, 12);

    // Projectiles: wand bolt, arrow, firebolt.
    g.clear();
    g.fillStyle(0xc9a6ff).fillRect(0, 0, 4, 4);
    g.fillStyle(0xffffff).fillRect(1, 1, 2, 2);
    g.generateTexture('proj-wand', 4, 4);
    g.clear();
    g.fillStyle(0x8a6a44).fillRect(0, 1, 6, 1);
    g.fillStyle(0xd9d9d9).fillRect(6, 0, 2, 3);
    g.generateTexture('proj-bow', 8, 3);
    g.clear();
    g.fillStyle(0xd9542b).fillCircle(3, 3, 3);
    g.fillStyle(0xffd27a).fillCircle(3, 3, 1.5);
    g.generateTexture('proj-firebolt', 6, 6);

    this.makeTileset(g);
    g.destroy();
    this.scene.start('World');
  }

  /** Draws all map tiles side by side into one 'tiles' texture. */
  private makeTileset(g: Phaser.GameObjects.Graphics) {
    const T = TILE_SIZE;
    g.clear();
    const grass = (ox: number) => {
      g.fillStyle(0x355435).fillRect(ox, 0, T, T);
      g.fillStyle(0x3d5f3b).fillRect(ox + 3, 4, 1, 1).fillRect(ox + 11, 9, 1, 1).fillRect(ox + 6, 13, 1, 1);
    };
    for (let i = 0; i < TILE_COUNT; i++) {
      const ox = i * T;
      switch (i) {
        case Tile.Grass:
          grass(ox);
          break;
        case Tile.Flowers:
          grass(ox);
          g.fillStyle(0xe8d36b).fillRect(ox + 4, 5, 2, 2);
          g.fillStyle(0xd96b8a).fillRect(ox + 10, 10, 2, 2);
          break;
        case Tile.Tree:
          grass(ox);
          g.fillStyle(0x4a3424).fillRect(ox + 7, 10, 2, 5);
          g.fillStyle(0x1e3a1e).fillCircle(ox + 8, 7, 7);
          g.fillStyle(0x2b4f28).fillCircle(ox + 7, 6, 5);
          break;
        case Tile.Rock:
          g.fillStyle(0x4b4b55).fillRect(ox, 0, T, T);
          g.fillStyle(0x6a6a76).fillRect(ox + 1, 1, T - 3, T - 4);
          g.fillStyle(0x82828e).fillRect(ox + 3, 3, 5, 3);
          break;
        case Tile.Water:
          g.fillStyle(0x2b4f7a).fillRect(ox, 0, T, T);
          g.fillStyle(0x3d6a9a).fillRect(ox + 2, 5, 5, 1).fillRect(ox + 9, 11, 4, 1);
          break;
        case Tile.Path:
          g.fillStyle(0x7a6544).fillRect(ox, 0, T, T);
          g.fillStyle(0x6b573a).fillRect(ox + 4, 3, 2, 1).fillRect(ox + 10, 10, 2, 1);
          break;
      }
    }
    g.generateTexture('tiles', T * TILE_COUNT, T);
  }
}
