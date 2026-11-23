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
| Resolution | Canvas fills the browser window (any aspect, incl. ultrawide). Whole-number pixel zoom so ~360 world px fit top to bottom (1080p → 3×, 1440p → 4×); wider screens see more. UI text at full resolution. |
| Tile size | 16×16 |
| Maps | Areas in `src/data/areas/`: an ASCII map (one character per tile) plus a legend for exits, NPCs, enemies and story triggers. A map painter in the Gambit Editor comes next (E2); Tiled import stays possible for later. |
| Content editor | **The Gambit Editor**: http://localhost:8080/editor.html while `npm run dev` runs. Dev server only, never in the itch build. |
| Release | `npm run build` → zip `dist/` → upload as HTML5 game on itch.io |

### Code map

| Path | What lives there |
|---|---|
| `src/data/tactics.ts` | **All tactic pieces**: Actions, Targets, Types, tactic row format |
| `src/data/party.ts` | The party: stats, known actions, default tactics |
| `src/data/story.json` | **Story events** (intro, story triggers, fight-won events), extra speakers, end screen. Made in the Gambit Editor; `story.ts` loads it |
| `src/game/script.ts` | **Event steps** (`say`, `narrate`, `choice`, `setFlag`, `ifFlag` / `ifNotFlag`, `fight`, `heal`, `wait`, `teleport`, `endGame`) |
| `src/systems/EventRunner.ts` | Runs event steps one after another |
| `src/data/areas/` | **Areas**: one file per area (map + legend); list new areas in `index.ts` |
| `src/data/npcs.json` | **NPCs**: name, look, conversation. Made in the Gambit Editor; `npcs.ts` loads it |
| `src/data/art.ts` | **Replacing placeholder art**: list real PNGs here, key → file in `public/art/` |
| `src/systems/TacticEngine.ts` | Picks which tactic row fires (top to bottom, first match) |
| `src/systems/Pathfinder.ts` | A* pathfinding on the tile grid + path smoothing |
| `src/data/weapons.ts` | Weapon types (melee, wand, bow) that define the basic Attack |
| `src/data/enemies.ts` | Enemy types: stats, aggro radius, preset tactics |
| `src/systems/CombatManager.ts` | Starts fights on proximity, pulls in groups, ends fights |
| `src/systems/CombatSystem.ts` | Runs tactics: picks rows, walks into range, performs actions, projectiles |
| `src/systems/CombatText.ts` | Floating combat text: damage, heals, buff/debuff names |
| `src/game/save.ts` | **The save game**: what's saved, versioning/migration, loading and writing (localStorage) |
| `src/game/session.ts` | The game being played: current save data, story flags, autosave |
| `src/world/` | Units (party members, enemies), NPCs, party formation, tiles, area map loader |
| `src/scenes/` | Phaser scenes: Boot (art), World (map, movement, story triggers, retry), UI (HUD), Tactics (editor), Dialog, End |
| `src/view.ts` | Full-window pixel camera (whole-number zoom), UI font and text style |
| `editor.html`, `src/editor/` | **The Gambit Editor** (Preact): events & dialogue, NPCs, speakers, problems, test in game |
| `tools/editorPlugin.ts` | Dev-server side of the editor: reads and saves the content JSON files |
| `src/game/editorBridge.ts` | Dev only: lets the editor play events and change flags in the open game tab |
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

### M4 — Tactics editor ✅ *(branch `feature/tactics-editor`)*
- Per character: 10 rows of `Action | Target | Type` with dropdowns, an on/off toggle and reordering.
- Only offers actions the character knows and types that fit the chosen target.
- Can be opened at any time, including mid-fight; combat pauses while it is open.
- *Notes:* **T** opens/closes (also Esc). One character per tab (click a tab, keys 1–5 or ←/→).
  Click a cell to pick from a list; drag the dots to reorder; the box switches a row on/off; x removes it.
  Edits apply to the live party immediately, and are saved in the browser (see M5).

### M5 — Readability of combat ✅ *(branch `feature/combat-readability`)*
- Floating text over the unit it happens to: **white** damage numbers, **green** heal numbers,
  **gold** ability name on an ally that gets a buff (Ward), **purple** ability name on an enemy that gets a debuff (Hex, Taunt).
- Edited tactics are saved in the browser (localStorage) and survive a reload. "Reset to defaults" in the
  editor puts the shown character back to their starting rows.
- *Not doing:* showing which row fired during a fight (designer's call). A combat log is not planned for now.

### M6 — Slice content ✅ *(branch `feature/slice-content`)*
- A small area with 3–4 escalating encounters and a final fight that tests the player's tactics.
- Defeat → retry the encounter; victory → end-of-slice screen.
- *Notes:* **The road from Barrelsby**: the town's edge (start) → fields → a bridge → into the woods → a clearing.
  1. 2 Wolves by the road (warm-up).
  2. 2 Bandits + Bandit Archer guarding the bridge.
  3. 2 Bandits + an **Acolyte** (ranged, wand) at a forest clearing.
  4. **The Stranger** + Bandit guard + 2 Acolytes (final fight).
- Story: an intro, two story triggers on the road (forest edge; meeting the Stranger), an ending, an end screen.
  All text is placeholder writing in `src/data/story.ts`. Dialogue pauses the game; click / Space / Enter to continue.
- Defeat: the party retries from a spot on its path just outside the fight, with the HP it had when the fight started.
  The enemies in that fight reset; groups already beaten stay beaten.
- Art: still generated placeholders. Real art can replace them one image at a time via `src/data/art.ts`.
- Enemies now have their own attack damage (not the weapon's). Debug keys only exist on the dev server; **J** jumps to the next fight.
- Meeting the Stranger (story trigger 2) starts the final fight as soon as the dialogue ends.
- *Balance (placeholder numbers, from automated runs):* fights 1–3 are won with the default tactics, slowly wearing the party down.
  The final fight is won with the default tactics: comfortably at full HP, narrowly (often with most of the party down)
  at the HP you typically arrive with. Acolytes don't heal for now (see decisions log).

### M7 — Art & audio pass ⏸ *(on hiatus)*
- Real sprites, tileset, UI skin, sounds and music.
- *On hiatus:* the designer replaces placeholder art as it gets made (via `src/data/art.ts`).

### M8 — itch.io release ⏸ *(on hiatus)*
- Build + zip script, itch page, test in the itch embed.

## Next: game systems

Plans and questions for the full game's systems are in [SYSTEMS.md](SYSTEMS.md): game state & saving,
areas & travel, event scripting, party roster & manager, character creation, XP & levels, progression trees.
Proposed milestones **M9–M17** are listed there. **M12 is on hold** until the designer's editor work is done.

### M9 — Game state & saving ✅ *(branch `feature/game-state`)*
- One save game holding everything that changes: area + position, leader, story flags, beaten encounters,
  and per character: unlocked / in party, HP, XP + level (unused until M13), tactics.
- **Autosave** after every fight (won or lost), after story dialogue, when tactics are edited, when the leader changes,
  and when the browser tab is hidden or closed (unless mid-fight or mid-dialogue). A small "Saved" note shows in the corner.
- **Title screen**: *Continue* (if there's a save) and *New game* (asks before erasing the save).
  The end screen now goes back to the title.
- Saves are versioned so older saves keep working as the game grows. Tactics saved by M5 carry over into a new game.
- *Note:* beaten encounters are remembered by their group number on the map; editing the map (adding/removing
  enemy groups) can shift which groups an existing save thinks are beaten. Start a new game after big map edits.

### M10 — Areas & travel ✅ *(branch `feature/areas`)*
- The world is made of **areas** (`src/data/areas/`): outdoor areas, plus instanced interiors and dungeons.
  Each area file has its map and a **legend** for its exits, start points, NPCs, enemies and story triggers.
- **Exits**: stepping on one fades to the linked area, arriving at a named start point
  (the party faces the door it came through, followers behind). The area's name shows briefly on arrival.
- **NPCs** (`src/data/npcs.ts`): click one and the leader walks up and talks. Until M11 they just say their lines.
- **Respawn**: every time an area loads, its enemies are back. Groups marked `unique` (the Stranger) stay beaten.
- Small areas (houses) are centred on screen with a dark surround.
- **Hover highlight**: NPCs get a 1px gold outline (traced from the sprite, so it works with real art too) and doors
  a gold border, plus a hand cursor. Hidden during fights.
- Placeholder content: **Marta's House** in Barrelsby (door on one of the houses), Old Marta inside,
  a Worried Villager by the road.
- Story triggers are now named (`forestEdge`, `meetStranger`) instead of numbered; old saves are upgraded (save v2).

### M11 — Event scripting ✅ *(branch `feature/events`)*
- **Events** are lists of steps written in data (`src/game/script.ts` has the steps and how to use them):
  `say` / `narrate`, `choice` (answers with their own steps), `setFlag`, `ifFlag` / `ifNotFlag`, `fight`, `heal`,
  `teleport`, `wait`, `endGame`. Join/leave, XP, items and quests get their steps in M12–M16.
- **Where events start**: `intro` once per new game; **story triggers** on the map (once, remembered when finished);
  an area's **`onEnter`**; a fight's **`onWin`** (named enemy groups in an area's `encounters`); and **NPCs'** `talk`.
- **After a fight**: the `fight` step ends the event, and what happens after winning goes in the group's `onWin` event.
  That way it also works when the fight is retried, or started by walking into the enemies.
- **Dialogue box**: 40×40 **headshot** of whoever talks (placeholder; art key `headshot-<id>`), choices picked by
  click, ↑/↓ + Enter, or number keys.
- Placeholder content: Marta now greets you differently the second time, and can let the party **rest (full heal)**.
  The Stranger's ending is his fight's `onWin` event.
- Save v3: intro flag renamed, the Stranger's group is saved by name.

## The Gambit Editor

A visual editor for the game's content, built into the dev server: open http://localhost:8080/editor.html
next to the game tab. It saves straight into the project's data files, and the game picks up new text without reloading.

### E1 — Event & dialogue editor ✅ *(branch `feature/editor`)*
- **Events tab**: every story event as a list of steps (line, narration, choice, if flag, set flag, start fight,
  heal party, pause, move party, end game). Add a step with **+** (between steps or at the end), drag the ⠿ handle
  to move it (also into and out of choice answers and if/otherwise branches), duplicate or delete it.
  Speakers, fights, areas and start points are picked from lists, so they can't be misspelled.
  Each event shows where it plays from (new game, a map trigger, after a fight, on arrival). Also: the end screen.
- **NPCs tab**: name, look (placeholder colour), and their conversation, with the same step editor.
- **Speakers tab**: the party, the NPCs, and other speakers such as the Stranger (name and headshot colour).
- **Preview**: click a line or choice to see it in the game's dialogue box, with the headshot.
- **Test in game**: plays the open event (or from a chosen step) in the game tab, saved or not.
  **Flags in your game** shows what the running game remembers; clear a flag to see an event again.
- **Problems**: unknown speakers, flags that are checked but never set, fights that aren't in the area where an
  event plays, a map trigger with no event, steps that never run, and so on. Click one to jump to it.
- **Save** (Ctrl+S) writes `src/data/story.json` and `src/data/npcs.json`. Undo / redo with Ctrl+Z / Ctrl+Y.
  Unsaved work is kept in the browser if the tab closes. If a file was changed outside the editor
  since it was opened, the editor asks before overwriting it.
- *Notes:* names the map refers to (an event used by a trigger, an NPC placed on a map) can't be renamed in the
  editor yet; that comes with the map painter. "If flag" can now also check that a flag is *not* set.
  New speakers or new looks reload the game tab (their placeholder art is made at startup); text changes don't.

### E2 — Map painter *(next)*
- Paint tiles; place NPCs, exits, start points, enemies and story triggers; link them to events in the editor.
- Areas move from `src/data/areas/*.ts` to editor-owned files, like events did.

## Decisions log

| Date | Decision |
|---|---|
| 2026-11-22 | Phaser 4 + TypeScript + Vite. 16px tiles. |
| 2026-11-22 | Full-window canvas with whole-number pixel zoom (~360 world px tall); crisp UI text in the Jersey 10 pixel font. Replaces the fixed 480×270 canvas, which felt too pixelly. |
| 2026-11-23 | Tactics editor opens with T; one character at a time; rows reorder by drag and drop. |
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
| 2026-11-22 | In combat, characters walk to get their row's target in range; ranged stop at their range. |
| 2026-11-22 | Ranged attackers keep their distance: they step back when an enemy gets close (max once per 2s), staying in range. |
| 2026-11-22 | Damage carries over between fights. Fallen characters get back up at 1 HP when a fight is won. |
| 2026-11-22 | Tactics also run outside combat (e.g. healing), with the same cooldowns, on targets already in range. |
| 2026-11-22 | If no row fires, the character stays with the party and does nothing. |
| 2026-11-22 | Skills on cooldown are skipped (next row gets a turn); the basic Attack waits for its next swing instead. |
| 2026-11-23 | No in-fight indicator of which tactic row fired. |
| 2026-11-23 | Floating combat text: white damage, green heals, gold ability name on buffed allies, purple ability name on debuffed enemies. Taunt counts as a debuff. |
| 2026-11-23 | Edited tactics are saved in the browser (localStorage) for now, until there is a real save system. |
| 2026-11-23 | Slice setting: the party is on its way to confront the mysterious stranger seen around Barrelsby, who coaxes townsfolk into the woods with promises of riches. |
| 2026-11-23 | Defeat: retry from just before the last encounter started. |
| 2026-11-23 | Art: Claude provides placeholders until the designer replaces them with real art (art is the main bottleneck). |
| 2026-11-23 | The final fight should be winnable with the default tactics (there aren't enough tactics yet to demand more). Enemy Acolytes don't heal, for now. |
| 2026-11-23 | M7 (art & audio) and M8 (itch release) are on hiatus; art is updated as the designer makes it. Next up: game systems (SYSTEMS.md). |
| 2026-11-23 | The main story follows one path (no branching); there will be side quests. |
| 2026-11-23 | XP is per character: the active party gets full XP from a fight, characters on the sidelines get 50%. |
| 2026-11-23 | Progression trees teach new skills or upgrade existing ones per character. They don't unlock tactic Types or Targets. |
| 2026-11-23 | All tactic Types, Targets and all 10 rows are available from the start. |
| 2026-11-23 | Saving: autosave, one save. Title screen with Continue / New game. |
| 2026-11-23 | World: a mix of larger walkable areas and instanced places (dungeons, houses). |
| 2026-11-23 | Towns have NPCs to talk to, shops, resting/healing, recruiting, and side quests to pick up. |
| 2026-11-23 | Enemies respawn on area transitions (go into a house and out again: they're back). |
| 2026-11-23 | Side quests have a quest log. Rewards vary per quest: XP, new characters, items. |
| 2026-11-23 | Plan an inventory system for equipment and consumables (SYSTEMS.md §6). |
| 2026-11-23 | Story/boss fights are marked unique and don't respawn. |
| 2026-11-23 | Interactive things (NPCs, doors) get a highlight border on mouse hover. |
| 2026-11-23 | Story fights must be won for the story to continue. After a loss the player can retry, or walk away and grind first. |
| 2026-11-23 | Cutscenes are mostly dialogue at first, with a headshot of whoever is talking. |
| 2026-11-23 | Active party: max 5. Some story sections have fewer characters (especially early on), sometimes just one. |
| 2026-11-23 | Characters who leave and later return keep their level, tactics and progress. |
| 2026-11-23 | The story doesn't depend on who is in the active party (no leader lock). The main character stays in the background even when not in the active party. |
| 2026-11-23 | The player creates the main character at the start of a new game (later). They can be left out of the active party, but some events still have them speak in dialogue. The story never removes them from the roster. |
| 2026-11-23 | Character creation is planned as M17 (SYSTEMS.md §3b). A placeholder main character (`hero`) comes with M12 so events can use them already. |
| 2026-11-23 | M12 test character: Vesper, the Brigand (ranged damage), joining through an event. |
| 2026-11-23 | M12 is on hold: the designer is building an editor in a separate branch/chat first. |
| 2026-11-23 | World building happens in our own visual editor (the Gambit Editor, in the dev server) rather than external tools: event & dialogue editor first (E1), then a map painter (E2). |
| 2026-11-23 | Story events and NPCs are stored as JSON files that the editor reads and writes (`story.json`, `npcs.json`). |

## Open questions for the designer

1. **Progression** — see [SYSTEMS.md](SYSTEMS.md) §5 (progression trees).
2. **Story text** — everything in `src/data/story.json` is placeholder writing; the designer will work on dialogue later. Who is the Stranger?
3. **Escape** — should the party ever be able to flee a fight? *(parked for later)*
