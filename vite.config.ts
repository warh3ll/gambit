import { defineConfig } from 'vite';
import { editorPlugin } from './tools/editorPlugin.ts';

export default defineConfig({
  // Relative asset paths so the build works inside itch.io's iframe/CDN.
  base: './',
  // The Gambit Editor (editor.html, dev server only) is written with Preact.
  oxc: { jsx: { runtime: 'automatic', importSource: 'preact' } },
  // Lets the editor read and save the game's content files. Dev server only; never part of the build.
  plugins: [editorPlugin()],
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0, // keep pixel-art PNGs as real files
    chunkSizeWarningLimit: 2000, // Phaser alone is ~1.3 MB
    // Only the game. (editor.html is a dev-server tool and must not ship.)
    rolldownOptions: { input: 'index.html' },
  },
  server: {
    // Always 8080 so an open browser tab keeps working across restarts:
    // fail loudly instead of silently moving to another port, and don't open new tabs.
    port: 8080,
    strictPort: true,
    open: false,
    // The project lives in a OneDrive folder: wait until a file has finished being written before reloading it,
    // otherwise a half-written (or empty) file can get served.
    watch: { awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 } },
  },
});
