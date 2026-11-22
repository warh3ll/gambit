# Gambit — notes for Claude

## Collaboration
- The user is the game designer; Claude is the developer. When a design choice is unclear, ask
  instead of guessing, and record the answer in `docs/PLAN.md` (Decisions log).
- Read `docs/PLAN.md` at the start of a session — the designer edits it between sessions.
- Work on a branch (`feature/…`, `setup/…`, `fix/…`). Never merge to `main` or push without the designer's go-ahead.

## Project
- Phaser 4 + TypeScript + Vite. `npm run dev`, `npm run build` (typecheck + build).
- Pixel art: 480×270 internal resolution, 16px tiles, `pixelArt: true`.
- All tactic building blocks (Actions, Targets, Types) live in `src/data/tactics.ts`.
  Keep `docs/TACTICS.md` in sync when adding or changing one.
- Build output must work from a relative path (itch.io embed) — keep `base: './'` in `vite.config.ts`.
