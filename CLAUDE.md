# Gambit — notes for Claude

## Collaboration
- The user is the game designer; Claude is the developer. When a design choice is unclear, ask
  instead of guessing, and record the answer in `docs/PLAN.md` (Decisions log).
- Read `docs/PLAN.md` at the start of a session — the designer edits it between sessions.
- Work on a branch (`feature/…`, `setup/…`, `fix/…`). Never merge to `main` without the designer's go-ahead.
  Every merge into `main` is pushed to GitHub (`origin`) right away.
  After a branch is merged into `main`, delete it (`git branch -d`, and on GitHub too if it was pushed).

## Project
- Phaser 4 + TypeScript + Vite. `npm run dev`, `npm run build` (typecheck + build).
- Dev server is always http://localhost:8080 (strictPort) and the designer keeps a tab open on it.
  Reuse that server for browser testing; if it isn't running, start `npm run dev` in the background
  and leave it running. Never start a second dev server on another port, and never kill the 8080 one.
- In dev builds the Phaser game is exposed as `window.__game` (for console debugging / automated checks).
- Pixel art: canvas fills the window; scenes use `pixelCamera()` (src/view.ts) for a whole-number zoom
  (~360 game px tall). Lay out UI in game pixels from the view size, never fixed screen sizes. 16px tiles.
- All tactic building blocks (Actions, Targets, Types) live in `src/data/tactics.ts`.
  Keep `docs/TACTICS.md` in sync when adding or changing one.
- Designer-editable content: story events in `src/data/story.json`, NPCs in `src/data/npcs.json`, skill trees in
  `src/data/trees.json` and areas in `src/data/areas/<id>.json`, all made with the Gambit Editor (http://localhost:8080/editor.html; code in
  `src/editor/`, the map painter in `src/editor/map/`, the tree editor in `src/editor/trees/`, saving via `tools/editorPlugin.ts`). Real art overrides in
  `src/data/art.ts`. Keep these readable for a non-programmer. The editor lays the JSON out one step per line; keep
  that layout when editing it by hand.
- Adding a map tile: `Tile` and `TILE_CHARS` in `src/world/tiles.ts` (its map character), and its placeholder in
  `paintTiles` (`src/world/placeholderArt.ts`, shared by the game and the editor).
- Adding or changing an event step type: `Step` in `src/game/script.ts`, `EventRunner`, and in the editor
  `STEP_KINDS` (steps.ts), the card in `StepList.tsx`, and the checks in `validate.ts`.
- The editor (editor.html, Preact) and the game bridge (`src/game/editorBridge.ts`) are dev-only and must stay out of
  the build: `build.rolldownOptions.input` is only `index.html`.
- The save game lives in `src/game/save.ts`. When its shape changes, bump `SAVE_VERSION` and add a step to
  `migrate()` so the designer's existing save keeps working.
- Debug keys (J/K/V) are dev-only (`import.meta.env.DEV`); never ship them.
- The repo is in a OneDrive folder and Vite's watcher can miss rapid successive writes (it once served an empty or
  half-edited file). Prefer writing a file in one go; if the browser shows stale code, `touch` the file.
- Build output must work from a relative path (itch.io embed) — keep `base: './'` in `vite.config.ts`.
