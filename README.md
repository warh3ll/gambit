# Gambit

A short, story-driven fantasy game where you don't fight — you **program your party**.
Each character follows up to 10 tactic rows (`Action | Target | Type`) once combat starts.

Built with Phaser 4, TypeScript and Vite. Target platform: itch.io (HTML5).

## Getting started

```bash
npm install
npm run dev       # dev server at http://localhost:8080
npm run build     # typecheck + production build into dist/
npm run preview   # serve the production build
```

## Debug keys (temporary)

| Key | Effect |
|---|---|
| V | Show / hide enemy aggro ranges |
| K | Defeat all enemies in the current fight (until real combat lands in M3) |

## Docs

- [docs/PLAN.md](docs/PLAN.md) — milestones, decisions, open questions
- [docs/TACTICS.md](docs/TACTICS.md) — every tactic Action, Target and Type
