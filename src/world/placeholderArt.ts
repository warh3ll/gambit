/**
 * Placeholder pictures drawn from coloured rectangles, shared by the game (BootScene, with Phaser Graphics)
 * and the Gambit Editor (with a 2D canvas), so both show the same faces until real art replaces them.
 */

/** Headshot size in game pixels (art key `headshot-<speaker>`, see src/data/art.ts). */
export const HEADSHOT_SIZE = 40;

/** Draws one filled rectangle. */
export type Painter = (color: number, alpha: number, x: number, y: number, w: number, h: number) => void;
/** Draws one filled circle. */
export type CirclePainter = (color: number, x: number, y: number, r: number) => void;

import { TILE_SIZE } from '../config';
import { TILE_COUNT, Tile } from './tiles';

const INK = 0x0d0b14;

/** Speakers drawn as a hooded face instead of a coloured one. */
const HOODED = new Set(['stranger']);

/** A face for the dialogue box. */
export function paintHeadshot(fill: Painter, speaker: string, color: number) {
  const H = HEADSHOT_SIZE;
  fill(0x2a2438, 1, 0, 0, H, H);
  if (HOODED.has(speaker)) {
    fill(0x1a1424, 1, 6, 4, H - 12, H - 4);
    fill(0x4a3a5a, 1, 11, 12, H - 22, H - 12);
    fill(0xc58cff, 1, 14, 20, 4, 3);
    fill(0xc58cff, 1, H - 18, 20, 4, 3);
  } else {
    fill(color, 1, 8, 8, H - 16, H - 8); // head and shoulders
    fill(0x000000, 0.15, 8, 30, H - 16, H - 30);
    fill(INK, 1, 13, 18, 4, 5);
    fill(INK, 1, H - 17, 18, 4, 5);
    fill(INK, 0.6, 17, 27, H - 34, 2);
  }
}

/** An NPC standing in the world (12×16). */
export function paintNpc(fill: Painter, color: number) {
  fill(INK, 1, 0, 0, 12, 16);
  fill(color, 1, 1, 1, 10, 14);
  fill(0xe8dcc8, 1, 1, 1, 10, 3);
  fill(INK, 1, 3, 5, 2, 2);
  fill(INK, 1, 7, 5, 2, 2);
}

/** A party member standing in the world (12×16). */
export function paintCharacter(fill: Painter, color: number) {
  fill(INK, 1, 0, 0, 12, 16);
  fill(color, 1, 1, 1, 10, 14);
  fill(INK, 1, 3, 4, 2, 2);
  fill(INK, 1, 7, 4, 2, 2);
}

/** An enemy in the world: coloured body with red eyes, sized per type. */
export function paintEnemy(fill: Painter, color: number, w: number, h: number) {
  fill(INK, 1, 0, 0, w, h);
  fill(color, 1, 1, 1, w - 2, h - 2);
  fill(0xff3b3b, 1, w - 5, 3, 2, 2);
  fill(0xff3b3b, 1, w - 9, 3, 2, 2);
}

/** Draws every map tile side by side (16px each, in the order of src/world/tiles.ts): the 'tiles' strip. */
export function paintTiles(fill: Painter, circle: CirclePainter) {
  const T = TILE_SIZE;
  const grass = (ox: number) => {
    fill(0x355435, 1, ox, 0, T, T);
    for (const [x, y] of [[3, 4], [11, 9], [6, 13]]) fill(0x3d5f3b, 1, ox + x, y, 1, 1);
  };
  const forestFloor = (ox: number) => {
    fill(0x283d2c, 1, ox, 0, T, T);
    fill(0x31482f, 1, ox + 2, 3, 1, 1);
    fill(0x31482f, 1, ox + 12, 7, 1, 1);
    fill(0x31482f, 1, ox + 7, 12, 2, 1);
  };
  const water = (ox: number) => {
    fill(0x2b4f7a, 1, ox, 0, T, T);
    fill(0x3d6a9a, 1, ox + 2, 5, 5, 1);
    fill(0x3d6a9a, 1, ox + 9, 11, 4, 1);
  };
  for (let i = 0; i < TILE_COUNT; i++) {
    const ox = i * T;
    switch (i) {
      case Tile.Grass:
        grass(ox);
        break;
      case Tile.Flowers:
        grass(ox);
        fill(0xe8d36b, 1, ox + 4, 5, 2, 2);
        fill(0xd96b8a, 1, ox + 10, 10, 2, 2);
        break;
      case Tile.Tree:
        grass(ox);
        fill(0x4a3424, 1, ox + 7, 10, 2, 5);
        circle(0x1e3a1e, ox + 8, 7, 7);
        circle(0x2b4f28, ox + 7, 6, 5);
        break;
      case Tile.Rock:
        fill(0x4b4b55, 1, ox, 0, T, T);
        fill(0x6a6a76, 1, ox + 1, 1, T - 3, T - 4);
        fill(0x82828e, 1, ox + 3, 3, 5, 3);
        break;
      case Tile.Water:
        water(ox);
        break;
      case Tile.Path:
        fill(0x7a6544, 1, ox, 0, T, T);
        fill(0x6b573a, 1, ox + 4, 3, 2, 1);
        fill(0x6b573a, 1, ox + 10, 10, 2, 1);
        break;
      case Tile.ForestFloor:
        forestFloor(ox);
        break;
      case Tile.ForestTree:
        forestFloor(ox);
        fill(0x3a2a1c, 1, ox + 7, 11, 2, 5);
        circle(0x142a18, ox + 8, 7, 8);
        circle(0x1e3a22, ox + 7, 6, 5);
        break;
      case Tile.House:
        // Roof seen from above: tiles in rows, dark eaves.
        fill(0x5a2e26, 1, ox, 0, T, T);
        for (let r = 0; r < 4; r++) fill(0x7a3e30, 1, ox, r * 4, T, 3);
        fill(0x3a1e1a, 1, ox, T - 1, T, 1);
        break;
      case Tile.Fence:
        grass(ox);
        fill(0x6b5232, 1, ox, 6, T, 2);
        fill(0x6b5232, 1, ox, 11, T, 2);
        fill(0x4a3822, 1, ox + 2, 4, 2, 10);
        fill(0x4a3822, 1, ox + 11, 4, 2, 10);
        break;
      case Tile.Floor:
        fill(0x6b5038, 1, ox, 0, T, T);
        for (let r = 0; r < 4; r++) fill(0x5a4230, 1, ox, r * 4 + 3, T, 1);
        for (const [x, y] of [[5, 0], [11, 4], [3, 8], [9, 12]]) fill(0x5a4230, 1, ox + x, y, 1, 4);
        break;
      case Tile.Wall:
        fill(0x3a3046, 1, ox, 0, T, T);
        fill(0x4a3e58, 1, ox, 0, T, 10);
        fill(0x2a2234, 1, ox, 10, T, 1);
        fill(0x2a2234, 1, ox + 7, 0, 1, 10);
        break;
      case Tile.Furniture:
        fill(0x6b5038, 1, ox, 0, T, T);
        fill(0x3a2a1c, 1, ox + 1, 2, T - 2, T - 3);
        fill(0x8a6a44, 1, ox + 2, 3, T - 4, T - 6);
        break;
      case Tile.Door:
        fill(0x3a1e1a, 1, ox, 0, T, T);
        fill(0x7a5232, 1, ox + 2, 1, T - 4, T - 1);
        fill(0x5a3a22, 1, ox + 7, 1, 2, T - 1);
        fill(0xd9b45a, 1, ox + 10, 8, 2, 2);
        break;
      case Tile.Bridge:
        water(ox);
        fill(0x8a6a44, 1, ox, 1, T, T - 2);
        for (let c = 0; c < 4; c++) fill(0x6b5232, 1, ox + c * 4 + 3, 1, 1, T - 2);
        fill(0x4a3822, 1, ox, 0, T, 1);
        fill(0x4a3822, 1, ox, T - 1, T, 1);
        break;
    }
  }
}
