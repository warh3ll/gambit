import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths so the build works inside itch.io's iframe/CDN.
  base: './',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0, // keep pixel-art PNGs as real files
    chunkSizeWarningLimit: 2000, // Phaser alone is ~1.3 MB
  },
  server: {
    // Always 8080 so an open browser tab keeps working across restarts:
    // fail loudly instead of silently moving to another port, and don't open new tabs.
    port: 8080,
    strictPort: true,
    open: false,
  },
});
