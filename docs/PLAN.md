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
| `src/systems/Pathfinder.ts` | A* pathfinding on the tile grid + path smoothing |
| `src/data/weapons.ts` | Weapon types (melee, wand, bow) that define the basic Attack |
| `src/data/enemies.ts` | Enemy types: stats, aggro radius, preset tactics |
| `src/systems/CombatManager.ts` | Starts fights on proximity, pulls in groups, ends fights |
| `src/systems/CombatSystem.ts` | Runs tactics: picks rows, walks into range, performs actions, projectiles |
| `src/world/` | Units (party members, enemies), party formation, placeholder test map + encounters |
| `src/scenes/` | Phaser scenes: Boot (placeholder art), World (map + movement), UI (HUD/portraits) |
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

### M1 — World & movement ✅ *(branch `feature/world-movement`)*
- Placeholder tile map with obstacles, camera follows the party.
- Click to move the designated leader; the rest of the party follows in formation, with pathfinding around obstacles.
- Click marker / feedback.
- Party portraits on screen; clicking a portrait makes that character the leader.
- *Notes:* the party walks at its slowest member's speed; followers sprint to catch up when far behind.
  The map is generated in code for now; we switch to Tiled maps when building real slice content (M6).

### M2 — Enemies & engagement ✅ *(branch `feature/enemies-engagement`)*
- Enemies placed in the world, with an aggro radius.
- Entering the radius starts combat for that group; combat ends when one side is dead.
- HP bars over everyone.
- *Notes:* placeholder enemy types Wolf, Bandit and Bandit Archer, each with preset tactic rows.
  HP bars show during combat (and whenever someone is hurt). The player can't move the party during a fight.
  Until M3 nobody acts in combat — use the debug key **K** to win a fight, **V** to show aggro ranges.

### M3 — Combat driven by tactics ✅ *(branch `feature/combat-tactics`)*
- Each party member re-evaluates tactics on a short tick, moves into range, performs the action.
- Resolve effects: weapon attacks (melee strike / wand projectile), damage, heal, taunt, buffs/debuffs, cooldowns, death.
- Enemies run on the same tactic system (with their own rows).
- *Notes:* projectiles for wand, bow and Firebolt; coloured rings for heal / taunt / hex / ward.
  HP numbers were roughly doubled so fights last long enough to watch (all placeholder).
  Defeat is a placeholder: the party respawns at the start at full HP and that fight resets.

### M4 — Tactics editor
- Per character: 10 rows of `Action | Target | Type` with dropdowns, an on/off toggle and reordering.
- Only offers actions the character knows and types that fit the chosen target.
- Can be opened at any time, including mid-fight; combat pauses while it is open.

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
| 2026-11-22 | Tactic rows are evaluated top to bottom; the first row that is on, off cooldown and has a valid target fires. |
| 2026-11-22 | Every skill has a short cooldown. The basic Attack is paced by the weapon's attack interval. |
| 2026-11-22 | The basic Attack depends on weapon type: **melee** for Yasmi, Hyne and Arthur; **ranged wand** for Oxleth and Telara. |
| 2026-11-22 | Tactics can be edited during a fight, not only between fights. |
| 2026-11-22 | The party follows a designated leader in formation. Default leader: Yasmi. The player switches leader by clicking a character's portrait. |
| 2026-11-22 | Combat pauses while the tactics editor is open. |
| 2026-11-22 | Oxleth the Bane: buffs for allies, debilitating debuffs for enemies. More abilities to come. |
| 2026-11-22 | "Any ally" includes the character itself; "Other ally" excludes it. |
| 2026-11-22 | Fights start on proximity: when a party member gets within an enemy's aggro radius, that enemy's group joins. Any other group the party gets close to mid-fight joins too. |
| 2026-11-22 | Each enemy type has preset tactic rows, built from the same Action/Target/Type pieces as the party. |
| 2026-11-22 | No escaping fights for now: the party is locked in until one side is defeated. *(revisit later)* |
| 2026-11-22 | In combat, characters walk to get their row's target in range (ranged stop at their range); no kiting. |
| 2026-11-22 | Damage carries over between fights. Fallen characters get back up at 1 HP when a fight is won. |
| 2026-11-22 | Tactics also run outside combat (e.g. healing), with the same cooldowns, on targets already in range. |
| 2026-11-22 | If no row fires, the character stays with the party and does nothing. |
| 2026-11-22 | Skills on cooldown are skipped (next row gets a turn); the basic Attack waits for its next swing instead. |

## Open questions for the designer

1. **Progression** — are new Actions/Types unlocked over time (found, learned, bought), or all available from the start?
2. **Defeat** — what happens when the party wipes? (Placeholder: respawn at the start at full HP, the fight resets.)
3. **Art** — will you provide art, or should we start from a free placeholder pack?
4. **Slice setting** — where and when in the story does the vertical slice happen?
5. **Escape** — should the party ever be able to flee a fight? *(parked for later)*
