import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/700.css';
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
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
    scene: [BootScene, WorldScene, UIScene],
  });

  // Dev builds only: expose the game for debugging in the browser console / automated tests.
  if (import.meta.env.DEV) (window as unknown as { __game: Phaser.Game }).__game = game;
}

// Wait for the UI font so the first frame of text doesn't render in a fallback font.
Promise.all([document.fonts.load('8px "Pixelify Sans"'), document.fonts.load('bold 8px "Pixelify Sans"')])
  .catch(() => undefined)
  .then(start);
