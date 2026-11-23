import Phaser from 'phaser';
import { TILE_SIZE } from '../config';
import { ENEMIES } from '../data/enemies';
import { NPCS } from '../data/npcs';
import { PARTY } from '../data/party';
import { ART_FILES } from '../data/art';
import { TILE_COUNT, Tile } from '../world/tiles';

export const PORTRAIT_SIZE = 22;

/**
 * Loads real art listed in src/data/art.ts, then generates placeholder art
 * (drawn with Graphics) for every key that wasn't loaded.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    for (const [key, file] of Object.entries(ART_FILES)) this.load.image(key, file);
  }

  create() {
    const g = this.add.graphics();
    const ink = 0x0d0b14;
    // Only generate a placeholder if no real art was loaded for that key.
    const make = (key: string, w: number, h: number) => {
      if (!this.textures.exists(key)) g.generateTexture(key, w, h);
    };

    // Characters: coloured body with outline and eyes.
    for (const c of PARTY) {
      g.clear();
      g.fillStyle(ink).fillRect(0, 0, 12, 16);
      g.fillStyle(c.color).fillRect(1, 1, 10, 14);
      g.fillStyle(ink).fillRect(3, 4, 2, 2).fillRect(7, 4, 2, 2);
      make(`char-${c.id}`, 12, 16);
    }

    // Enemies: coloured body with red eyes, sized per type.
    for (const e of Object.values(ENEMIES)) {
      const { w, h } = e.size;
      g.clear();
      g.fillStyle(ink).fillRect(0, 0, w, h);
      g.fillStyle(e.color).fillRect(1, 1, w - 2, h - 2);
      g.fillStyle(0xff3b3b).fillRect(w - 5, 3, 2, 2).fillRect(w - 9, 3, 2, 2);
      make(`enemy-${e.id}`, w, h);
    }

    // NPCs: coloured body with a lighter head band.
    for (const n of Object.values(NPCS)) {
      g.clear();
      g.fillStyle(ink).fillRect(0, 0, 12, 16);
      g.fillStyle(n.color).fillRect(1, 1, 10, 14);
      g.fillStyle(0xe8dcc8).fillRect(1, 1, 10, 3);
      g.fillStyle(ink).fillRect(3, 5, 2, 2).fillRect(7, 5, 2, 2);
      make(`npc-${n.id}`, 12, 16);
    }

    // Portraits: face crop of the same placeholder.
    const p = PORTRAIT_SIZE - 4;
    for (const c of PARTY) {
      g.clear();
      g.fillStyle(0x2a2438).fillRect(0, 0, p, p);
      g.fillStyle(c.color).fillRect(3, 4, p - 6, p - 4);
      g.fillStyle(ink).fillRect(6, 9, 2, 3).fillRect(p - 8, 9, 2, 3);
      make(`portrait-${c.id}`, p, p);
    }
    for (const n of Object.values(NPCS)) {
      g.clear();
      g.fillStyle(0x2a2438).fillRect(0, 0, p, p);
      g.fillStyle(n.color).fillRect(3, 4, p - 6, p - 4);
      g.fillStyle(0xe8dcc8).fillRect(3, 4, p - 6, 3);
      g.fillStyle(ink).fillRect(6, 10, 2, 3).fillRect(p - 8, 10, 2, 3);
      make(`portrait-${n.id}`, p, p);
    }
    // The Stranger's portrait: hooded face.
    {
      g.clear();
      g.fillStyle(0x2a2438).fillRect(0, 0, p, p);
      g.fillStyle(0x1a1424).fillRect(2, 2, p - 4, p - 2);
      g.fillStyle(0x4a3a5a).fillRect(5, 6, p - 10, p - 6);
      g.fillStyle(0xc58cff).fillRect(6, 10, 2, 2).fillRect(p - 8, 10, 2, 2);
      make('portrait-stranger', p, p);
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
      make(key, PORTRAIT_SIZE, PORTRAIT_SIZE);
    }

    // Leader marker: small gold chevron.
    g.clear();
    g.fillStyle(ink).fillTriangle(0, 0, 8, 0, 4, 5);
    g.fillStyle(0xf2d16b).fillTriangle(1, 1, 7, 1, 4, 4);
    make('leader-marker', 8, 5);

    // Click marker: ring.
    g.clear();
    g.lineStyle(1, 0xffffff).strokeCircle(6, 6, 5);
    make('click-marker', 12, 12);

    // Projectiles: wand bolt, arrow, firebolt.
    g.clear();
    g.fillStyle(0xc9a6ff).fillRect(0, 0, 4, 4);
    g.fillStyle(0xffffff).fillRect(1, 1, 2, 2);
    make('proj-wand', 4, 4);
    g.clear();
    g.fillStyle(0x8a6a44).fillRect(0, 1, 6, 1);
    g.fillStyle(0xd9d9d9).fillRect(6, 0, 2, 3);
    make('proj-bow', 8, 3);
    g.clear();
    g.fillStyle(0xd9542b).fillCircle(3, 3, 3);
    g.fillStyle(0xffd27a).fillCircle(3, 3, 1.5);
    make('proj-firebolt', 6, 6);
    g.clear();
    g.fillStyle(0x3a1a4a).fillCircle(3, 3, 3);
    g.fillStyle(0xc58cff).fillCircle(3, 3, 1.5);
    make('proj-shadowBolt', 6, 6);

    this.makeTileset(g);
    g.destroy();
    this.scene.start('Title');
  }

  /** Draws all map tiles side by side into one 'tiles' texture. */
  private makeTileset(g: Phaser.GameObjects.Graphics) {
    const T = TILE_SIZE;
    g.clear();
    const grass = (ox: number) => {
      g.fillStyle(0x355435).fillRect(ox, 0, T, T);
      g.fillStyle(0x3d5f3b).fillRect(ox + 3, 4, 1, 1).fillRect(ox + 11, 9, 1, 1).fillRect(ox + 6, 13, 1, 1);
    };
    const forestFloor = (ox: number) => {
      g.fillStyle(0x283d2c).fillRect(ox, 0, T, T);
      g.fillStyle(0x31482f).fillRect(ox + 2, 3, 1, 1).fillRect(ox + 12, 7, 1, 1).fillRect(ox + 7, 12, 2, 1);
    };
    const water = (ox: number) => {
      g.fillStyle(0x2b4f7a).fillRect(ox, 0, T, T);
      g.fillStyle(0x3d6a9a).fillRect(ox + 2, 5, 5, 1).fillRect(ox + 9, 11, 4, 1);
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
          water(ox);
          break;
        case Tile.Path:
          g.fillStyle(0x7a6544).fillRect(ox, 0, T, T);
          g.fillStyle(0x6b573a).fillRect(ox + 4, 3, 2, 1).fillRect(ox + 10, 10, 2, 1);
          break;
        case Tile.ForestFloor:
          forestFloor(ox);
          break;
        case Tile.ForestTree:
          forestFloor(ox);
          g.fillStyle(0x3a2a1c).fillRect(ox + 7, 11, 2, 5);
          g.fillStyle(0x142a18).fillCircle(ox + 8, 7, 8);
          g.fillStyle(0x1e3a22).fillCircle(ox + 7, 6, 5);
          break;
        case Tile.House:
          // Roof seen from above: tiles in rows, dark eaves.
          g.fillStyle(0x5a2e26).fillRect(ox, 0, T, T);
          g.fillStyle(0x7a3e30);
          for (let r = 0; r < 4; r++) g.fillRect(ox, r * 4, T, 3);
          g.fillStyle(0x3a1e1a).fillRect(ox, T - 1, T, 1);
          break;
        case Tile.Fence:
          grass(ox);
          g.fillStyle(0x6b5232).fillRect(ox, 6, T, 2).fillRect(ox, 11, T, 2);
          g.fillStyle(0x4a3822).fillRect(ox + 2, 4, 2, 10).fillRect(ox + 11, 4, 2, 10);
          break;
        case Tile.Floor:
          g.fillStyle(0x6b5038).fillRect(ox, 0, T, T);
          g.fillStyle(0x5a4230);
          for (let r = 0; r < 4; r++) g.fillRect(ox, r * 4 + 3, T, 1);
          g.fillRect(ox + 5, 0, 1, 4).fillRect(ox + 11, 4, 1, 4).fillRect(ox + 3, 8, 1, 4).fillRect(ox + 9, 12, 1, 4);
          break;
        case Tile.Wall:
          g.fillStyle(0x3a3046).fillRect(ox, 0, T, T);
          g.fillStyle(0x4a3e58).fillRect(ox, 0, T, 10);
          g.fillStyle(0x2a2234).fillRect(ox, 10, T, 1).fillRect(ox + 7, 0, 1, 10);
          break;
        case Tile.Furniture:
          g.fillStyle(0x6b5038).fillRect(ox, 0, T, T);
          g.fillStyle(0x3a2a1c).fillRect(ox + 1, 2, T - 2, T - 3);
          g.fillStyle(0x8a6a44).fillRect(ox + 2, 3, T - 4, T - 6);
          break;
        case Tile.Door:
          g.fillStyle(0x3a1e1a).fillRect(ox, 0, T, T);
          g.fillStyle(0x7a5232).fillRect(ox + 2, 1, T - 4, T - 1);
          g.fillStyle(0x5a3a22).fillRect(ox + 7, 1, 2, T - 1);
          g.fillStyle(0xd9b45a).fillRect(ox + 10, 8, 2, 2);
          break;
        case Tile.Bridge:
          water(ox);
          g.fillStyle(0x8a6a44).fillRect(ox, 1, T, T - 2);
          g.fillStyle(0x6b5232);
          for (let c = 0; c < 4; c++) g.fillRect(ox + c * 4 + 3, 1, 1, T - 2);
          g.fillStyle(0x4a3822).fillRect(ox, 0, T, 1).fillRect(ox, T - 1, T, 1);
          break;
      }
    }
    if (!this.textures.exists('tiles')) g.generateTexture('tiles', T * TILE_COUNT, T);
  }
}
