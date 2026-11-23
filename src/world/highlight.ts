import Phaser from 'phaser';

/** Colour of hover highlights on interactive things (NPCs, doors). */
export const HIGHLIGHT_COLOR = 0xf2d16b;

/**
 * Returns the key of a 1px outline texture that traces the opaque pixels of `key` (made once, then reused).
 * The outline is 2px larger than the source in each dimension. Works with placeholder and real art alike.
 */
export function outlineTexture(scene: Phaser.Scene, key: string, color = HIGHLIGHT_COLOR): string {
  const outKey = `${key}__outline`;
  if (scene.textures.exists(outKey)) return outKey;
  const frame = scene.textures.getFrame(key);
  const src = frame.source.image as CanvasImageSource;
  const w = frame.cutWidth;
  const h = frame.cutHeight;
  const tex = scene.textures.createCanvas(outKey, w + 2, h + 2);
  if (!tex) return outKey;
  const ctx = tex.getContext();
  ctx.imageSmoothingEnabled = false;
  // Silhouette grown by 1px in each direction...
  for (const [dx, dy] of [
    [0, 1],
    [2, 1],
    [1, 0],
    [1, 2],
  ]) {
    ctx.drawImage(src, frame.cutX, frame.cutY, w, h, dx, dy, w, h);
  }
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
  ctx.fillRect(0, 0, w + 2, h + 2);
  // ...minus the sprite itself, leaving just the rim.
  ctx.globalCompositeOperation = 'destination-out';
  ctx.drawImage(src, frame.cutX, frame.cutY, w, h, 1, 1, w, h);
  ctx.globalCompositeOperation = 'source-over';
  tex.refresh();
  return outKey;
}

/** Draws a 1px border around a set of tiles (only on their outer edges), e.g. a door. */
export function drawTileBorder(
  g: Phaser.GameObjects.Graphics,
  tiles: { x: number; y: number }[],
  tileSize: number,
  color = HIGHLIGHT_COLOR,
) {
  const has = new Set(tiles.map((t) => `${t.x},${t.y}`));
  g.fillStyle(color, 1);
  for (const { x, y } of tiles) {
    const px = x * tileSize;
    const py = y * tileSize;
    if (!has.has(`${x},${y - 1}`)) g.fillRect(px, py, tileSize, 1);
    if (!has.has(`${x},${y + 1}`)) g.fillRect(px, py + tileSize - 1, tileSize, 1);
    if (!has.has(`${x - 1},${y}`)) g.fillRect(px, py, 1, tileSize);
    if (!has.has(`${x + 1},${y}`)) g.fillRect(px + tileSize - 1, py, 1, tileSize);
  }
}
