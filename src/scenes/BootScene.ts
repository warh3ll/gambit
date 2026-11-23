import Phaser from 'phaser';
import { TILE_SIZE } from '../config';
import { ENEMIES } from '../data/enemies';
import { NPCS } from '../data/npcs';
import { PARTY } from '../data/party';
import { SPEAKERS } from '../data/story';
import { ART_FILES } from '../data/art';
import { HEADSHOT_SIZE, type Painter, paintCharacter, paintEnemy, paintHeadshot, paintNpc, paintTiles } from '../world/placeholderArt';
import { TILE_COUNT } from '../world/tiles';

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
    const paint: Painter = (color, alpha, x, y, w, h) => g.fillStyle(color, alpha).fillRect(x, y, w, h);

    // Characters: coloured body with outline and eyes.
    for (const c of PARTY) {
      g.clear();
      paintCharacter(paint, c.color);
      make(`char-${c.id}`, 12, 16);
    }

    // Enemies: coloured body with red eyes, sized per type.
    for (const e of Object.values(ENEMIES)) {
      const { w, h } = e.size;
      g.clear();
      paintEnemy(paint, e.color, w, h);
      make(`enemy-${e.id}`, w, h);
    }

    // NPCs: coloured body with a lighter head band.
    for (const n of Object.values(NPCS)) {
      g.clear();
      paintNpc(paint, n.color);
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

    // Headshots for dialogue: a bigger face per speaker.
    const headshot = (id: string, color: number) => {
      g.clear();
      paintHeadshot(paint, id, color);
      make(`headshot-${id}`, HEADSHOT_SIZE, HEADSHOT_SIZE);
    };
    for (const c of PARTY) headshot(c.id, c.color);
    for (const n of Object.values(NPCS)) headshot(n.id, n.color);
    for (const [id, s] of Object.entries(SPEAKERS)) headshot(id, parseInt(s.color.replace('#', ''), 16));

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
    g.clear();
    paintTiles(
      (color, alpha, x, y, w, h) => g.fillStyle(color, alpha).fillRect(x, y, w, h),
      (color, x, y, r) => g.fillStyle(color).fillCircle(x, y, r),
    );
    if (!this.textures.exists('tiles')) g.generateTexture('tiles', TILE_SIZE * TILE_COUNT, TILE_SIZE);
  }
}
