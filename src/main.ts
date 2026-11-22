import '@fontsource/jersey-10/400.css';
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { TacticsScene } from './scenes/TacticsScene';
import { UIScene } from './scenes/UIScene';
import { WorldScene } from './scenes/WorldScene';

function start() {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#1a1626',
    pixelArt: true,
    roundPixels: true,
    scale: {
      // The canvas fills the browser window; scenes pick a whole-number zoom (see view.ts).
      mode: Phaser.Scale.RESIZE,
      width: window.innerWidth,
      height: window.innerHeight,
    },
    scene: [BootScene, WorldScene, UIScene, TacticsScene],
  });

  // Dev builds only: expose the game for debugging in the browser console / automated tests.
  if (import.meta.env.DEV) (window as unknown as { __game: Phaser.Game }).__game = game;
}

// Wait for the UI font so the first frame of text doesn't render in a fallback font.
document.fonts
  .load('10px "Jersey 10"')
  .catch(() => undefined)
  .then(start);
