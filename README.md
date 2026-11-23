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

## Controls

| Input | Effect |
|---|---|
| Left click (map) | Move the party (outside combat) |
| Click a portrait | Make that character the leader |
| T | Open / close the tactics editor (pauses the game). Edits are saved in the browser. |
| Click / Space / Enter | Next line of dialogue |

The game autosaves (one save, in the browser). The title screen offers *Continue* or *New game*.

## Debug keys (dev server only, not in the built game)

| Key | Effect |
|---|---|
| J | Jump to just before the next fight |
| V | Show / hide enemy aggro ranges |
| K | Instantly win the current fight |

## Editing content

- Story text: [src/data/story.ts](src/data/story.ts)
- The map: [src/data/maps/barrelsbyRoad.ts](src/data/maps/barrelsbyRoad.ts) (ASCII, legend at the top)
- Enemies: [src/data/enemies.ts](src/data/enemies.ts) · Party: [src/data/party.ts](src/data/party.ts)
- Real art: drop PNGs in `public/art/` and list them in [src/data/art.ts](src/data/art.ts)

## Docs

- [docs/PLAN.md](docs/PLAN.md) — milestones, decisions, open questions
- [docs/TACTICS.md](docs/TACTICS.md) — every tactic Action, Target and Type
