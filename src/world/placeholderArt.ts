/**
 * Placeholder pictures drawn from coloured rectangles, shared by the game (BootScene, with Phaser Graphics)
 * and the Gambit Editor (with a 2D canvas), so both show the same faces until real art replaces them.
 */

/** Headshot size in game pixels (art key `headshot-<speaker>`, see src/data/art.ts). */
export const HEADSHOT_SIZE = 40;

/** Draws one filled rectangle. */
export type Painter = (color: number, alpha: number, x: number, y: number, w: number, h: number) => void;

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
