# Gambit — Development Plan

> Living document. Edit it freely: add notes under any milestone, reorder, strike things out.
> Claude reads this at the start of each work session.

## Vision

A short, story-driven fantasy game in a top-down pixel-art world. The player never controls
fights directly. Instead they **program the party**: each character has up to **10 tactic rows**
(`Action | Target | Type`) that are evaluated during combat. The fun is in writing, testing and
refining those tactics.

- Outside combat: click on the map to move the party.
- Combat starts when the party gets close enough to enemies; everyone then follows their tactics.
- Published as a browser game on **itch.io**.

## Roles & workflow

- **Designer (you).** Owns the design, decides on open questions, approves merges.
- **Claude — developer.** Builds features, asks when a design choice isn't clear.
- Work happens on feature branches (`feature/<name>`, `setup/<name>`, `fix/<name>`).
  Nothing merges to `main` until the designer says so.
- Every milestone ends with something playable in `npm run dev`.

## Tech

| | |
|---|---|
| Engine | Phaser 4 (`phaser@4.2.1`) |
| Language | TypeScript, bundled with Vite |
| Resolution | 480×270 internal, scaled to fit the window (pixel-perfect) |
| Tile size | 16×16 |
| Maps | Tiled (`.tmj`) once we move past placeholder maps |
| Release | `npm run build` → zip `dist/` → upload as HTML5 game on itch.io |

### Code map

| Path | What lives there |
|---|---|
| `src/data/tactics.ts` | **All tactic pieces**: Actions, Targets, Types, tactic row format |
| `src/data/party.ts` | The party: stats, known actions, default tactics |
| `src/systems/TacticEngine.ts` | Picks which tactic row fires (top to bottom, first match) |
| `src/scenes/` | Phaser scenes (Boot, World, …) |
| `docs/TACTICS.md` | Designer-facing list of tactics, planned and implemented |

## Party (first iteration)

| Character | Class | Role |
|---|---|---|
| Yasmi | Crusader | Tank |
| Hyne | Cleric | Healer |
| Oxleth | Bane | Support |
| Arthur | Pikeman | Melee damage |
| Telara | Wizard | Magic damage |

More classes and characters can be found later in the game.

## Milestones (vertical slice)

### M0 — Project setup ✅ *(branch `setup/project-scaffold`)*
- Vite + TypeScript + Phaser 4, itch-friendly build (relative paths).
- Tactics data model + first-match tactic engine.
- Party data with placeholder stats and default tactics.
- Placeholder scene showing the party.

### M1 — World & movement
- Placeholder tile map with obstacles, camera follows the party.
- Click to move; the party follows the leader in formation, with pathfinding around obstacles.
- Click marker / feedback.

### M2 — Enemies & engagement
- Enemies placed in the world, with an aggro radius.
- Entering the radius starts combat for that group; combat ends when one side is dead.
- HP bars over everyone.

### M3 — Combat driven by tactics
- Each party member re-evaluates tactics on a short tick, moves into range, performs the action.
- Resolve effects: damage, heal, taunt, buffs/debuffs, cooldowns, death.
- Enemies run on the same tactic system (with their own rows).

### M4 — Tactics editor
- Per character: 10 rows of `Action | Target | Type` with dropdowns, an on/off toggle and reordering.
- Only offers actions the character knows and types that fit the chosen target.
- Opened from a menu outside combat (and maybe in combat, see open questions).

### M5 — Readability of combat
- Highlight which row fired for each character (key for debugging your "program").
- Floating damage/heal numbers, a simple combat log.

### M6 — Slice content
- A small area with 3–4 escalating encounters and a final fight that tests the player's tactics.
- Defeat → retry the encounter; victory → end-of-slice screen.

### M7 — Art & audio pass
- Real sprites, tileset, UI skin, sounds and music.

### M8 — itch.io release
- Build + zip script, itch page, test in the itch embed.

## Decisions log

| Date | Decision |
|---|---|
| 2026-11-22 | Phaser 4 + TypeScript + Vite. 480×270 internal resolution, 16px tiles. |
| 2026-11-22 | Tactic rows are evaluated top to bottom; the first row that can fire wins. *(to confirm)* |
| 2026-11-22 | "Any ally" includes the character itself; "Other ally" excludes it. *(to confirm)* |

## Open questions for the designer

1. **Row priority** — is "top row wins, first match fires" the rule you want?
2. **Pausing** — can the player pause during combat and edit tactics, or only between fights?
3. **Movement** — does the party follow one leader in formation? Who leads, and can the player change it?
4. **Oxleth the Bane** — what is the support identity? (Placeholder: Hex debuffs enemies, Ward shields allies.)
5. **Progression** — are new Actions/Types unlocked over time (found, learned, bought), or all available from the start?
6. **Defeat** — what happens when the party wipes? (Placeholder: retry the encounter.)
7. **Art** — will you provide art, or should we start from a free placeholder pack?
8. **Enemies** — should enemies use the same tactic system? (Recommended: yes — it lets us design enemies by writing rows.)
9. **Slice setting** — where and when in the story does the vertical slice happen?
