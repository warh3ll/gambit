/**
 * Pictures for the map painter: real art where src/data/art.ts lists a file, otherwise the game's own
 * placeholders (drawn by the same code as in BootScene), so the map looks like it does in the game.
 */
import { TILE_SIZE } from '../../config';
import { ART_FILES } from '../../data/art';
import { ENEMIES } from '../../data/enemies';
import { type CirclePainter, type Painter, paintCharacter, paintEnemy, paintNpc, paintTiles } from '../../world/placeholderArt';
import { TILE_COUNT } from '../../world/tiles';

export type Picture = { img: CanvasImageSource; w: number; h: number };

const listeners = new Set<() => void>();
/** Calls `fn` when a real art file has finished loading (to redraw). */
export function onArtLoaded(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const images = new Map<string, HTMLImageElement>();
function realArt(key: string): Picture | null {
  const file = ART_FILES[key];
  if (!file) return null;
  let img = images.get(key);
  if (!img) {
    img = new Image();
    img.onload = () => listeners.forEach((l) => l());
    img.src = file;
    images.set(key, img);
  }
  return img.complete && img.naturalWidth ? { img, w: img.naturalWidth, h: img.naturalHeight } : null;
}

const placeholders = new Map<string, Picture>();
function placeholder(cacheKey: string, w: number, h: number, paint: (fill: Painter, circle: CirclePainter) => void): Picture {
  let pic = placeholders.get(cacheKey);
  if (!pic) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    const css = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
    const fill: Painter = (color, alpha, x, y, rw, rh) => {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = css(color);
      ctx.fillRect(x, y, rw, rh);
      ctx.globalAlpha = 1;
    };
    // Circles as whole pixels (every pixel whose centre is inside), to stay crisp.
    const circle: CirclePainter = (color, cx, cy, r) => {
      ctx.fillStyle = css(color);
      for (let py = Math.floor(cy - r); py < cy + r; py++) {
        const dy = py + 0.5 - cy;
        const half = Math.sqrt(Math.max(0, r * r - dy * dy));
        const x0 = Math.ceil(cx - half - 0.5);
        const x1 = Math.floor(cx + half - 0.5);
        if (x1 >= x0) ctx.fillRect(x0, py, x1 - x0 + 1, 1);
      }
    };
    paint(fill, circle);
    pic = { img: canvas, w, h };
    placeholders.set(cacheKey, pic);
  }
  return pic;
}

/** All tiles side by side (16px each, in tile id order). */
export const tileset = (): Picture => realArt('tiles') ?? placeholder('tiles', TILE_SIZE * TILE_COUNT, TILE_SIZE, paintTiles);

export function enemyPicture(type: string): Picture | null {
  const def = ENEMIES[type as keyof typeof ENEMIES];
  if (!def) return null;
  return realArt(`enemy-${type}`) ?? placeholder(`enemy-${type}`, def.size.w, def.size.h, (f) => paintEnemy(f, def.color, def.size.w, def.size.h));
}

export const npcPicture = (id: string, color: number): Picture =>
  realArt(`npc-${id}`) ?? placeholder(`npc-${id}-${color}`, 12, 16, (f) => paintNpc(f, color));

export const characterPicture = (id: string, color: number): Picture =>
  realArt(`char-${id}`) ?? placeholder(`char-${id}`, 12, 16, (f) => paintCharacter(f, color));
