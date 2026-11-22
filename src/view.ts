import Phaser from 'phaser';
import { TARGET_VIEW_HEIGHT } from './config';

/**
 * Font used for all UI text (bundled via @fontsource, see main.ts).
 * Jersey 10 is drawn on a 10px grid: use sizes 10 or 20 (game pixels) to keep it crisp.
 */
export const FONT = '"Jersey 10", monospace';

/** Whole-number pixel zoom for a screen of this height. */
export const pixelZoom = (screenHeight: number) => Math.max(1, Math.round(screenHeight / TARGET_VIEW_HEIGHT));

export interface ViewSize {
  /** Visible size in game pixels (screen size divided by zoom). */
  width: number;
  height: number;
  zoom: number;
}

/**
 * Keeps a scene's main camera at a whole-number zoom that fits the window, and
 * re-applies it when the window resizes.
 *
 * - `topLeft: true` (UI scenes): game pixel (0,0) is the top-left of the screen.
 * - `topLeft: false` (world): the camera zooms around its centre and follows things normally.
 *
 * Text objects get their resolution matched to the zoom so they stay sharp.
 */
export function pixelCamera(scene: Phaser.Scene, topLeft: boolean, onResize?: (view: ViewSize) => void): ViewSize {
  const view: ViewSize = { width: 0, height: 0, zoom: 1 };
  const apply = () => {
    const { width, height } = scene.scale.gameSize;
    const cam = scene.cameras.main;
    view.zoom = pixelZoom(height);
    view.width = Math.ceil(width / view.zoom);
    view.height = Math.ceil(height / view.zoom);
    cam.setSize(width, height);
    if (topLeft) cam.setOrigin(0, 0).setScroll(0, 0);
    cam.setZoom(view.zoom);
    sharpenText(scene, view.zoom);
    onResize?.(view);
  };
  apply();
  scene.scale.on(Phaser.Scale.Events.RESIZE, apply);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.scale.off(Phaser.Scale.Events.RESIZE, apply));
  return view;
}

/** Sets every Text object in the scene (including inside containers) to render at `resolution`. */
export function sharpenText(scene: Phaser.Scene, resolution: number) {
  const visit = (objects: Phaser.GameObjects.GameObject[]) => {
    for (const o of objects) {
      if (o instanceof Phaser.GameObjects.Text) o.setResolution(resolution);
      else if (o instanceof Phaser.GameObjects.Container) visit(o.list);
    }
  };
  visit(scene.children.list);
}

/** Standard UI text style. Sizes are in game pixels. */
export function textStyle(size = 10, color = '#ffffff', extra: Phaser.Types.GameObjects.Text.TextStyle = {}) {
  return { fontFamily: FONT, fontSize: `${size}px`, color, ...extra } satisfies Phaser.Types.GameObjects.Text.TextStyle;
}
