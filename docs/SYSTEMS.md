# Game systems — plan

> Draft by Claude for the designer. Each system has a **proposal** (how it could work) and **questions**.
> Answer inline (write under the question) or in chat; answers move to the decisions log in PLAN.md.
> Nothing here is built yet.

The vertical slice proved the core loop. The next step is the systems a full game needs:
a world made of areas, scripted story events, a changing party, and character progression.

All of them share one foundation: a **game state** that is saved and loaded. That comes first.

---

## 0. Foundation: game state & saving

**Proposal**
- One saved "game state" holds everything that changes during play:
  - where the party is (area + position);
  - story flags (e.g. `metStranger`, `arthurLeft`);
  - which encounters are beaten;
  - the roster: who's unlocked, who's in the party, each character's XP, level, unlocked tree nodes and tactics.
- Saved in the browser (like tactics are now), with a version number so old saves keep working as the game grows.
- The tactics save we have now moves into this.

**Questions**
1. Saving: **autosave** (e.g. after every fight and area change), **save points** in the world, or both?
2. One save, or several **save slots**?
3. A title screen with *Continue / New game*?

---

## 1. World: areas and travel

**Proposal**
- The world is split into **areas**. Each area is a map (the ASCII grid format we already use) plus a data file listing:
  - its exits;
  - its encounters;
  - its NPCs;
  - its events.
- **Exits** are marked on the map, e.g. the east edge of *Barrelsby Road* leads into *Whispering Woods*.
  Walking onto one fades the screen to the next area.
- **NPCs** stand in the world. Clicking one walks the party to them and runs their event (dialogue, shop, a quest step…).
- Beaten encounters stay beaten, unless an area says its enemies come back.
- Content lives in `src/data/areas/<area>/`: the map, plus the area's events. Designer-editable, like story.ts now.

**Questions**
4. Is the world **connected areas** you walk between, or is there also a **world map** (pick a destination, travel there)?
5. Towns: what happens in them? Talking to NPCs, shops, resting/healing, recruiting characters?
6. Can areas be revisited, and do enemies **respawn** (e.g. for grinding XP), or is every fight a one-off?

---

## 2. Scripted events

**Proposal**
- An **event** is a short list of steps, written in a data file, that run in order. For example:
  - `say` — a dialogue line (what we have now);
  - `choice` — the player picks an answer, and the event branches;
  - `setFlag` / `ifFlag` — remember something, or only do steps if something happened earlier;
  - `addMember` / `removeMember` — someone joins or leaves the party;
  - `fight` — start a specific fight (optionally: "if lost, run this instead of retrying");
  - `walk`, `face`, `wait`, `camera` — simple cutscene movement;
  - `giveXp`, `unlock`, `teleport` (move the party to another area / spot), `fade`.
- What starts an event:
  - stepping on a trigger tile (like now);
  - talking to an NPC;
  - entering an area;
  - winning or losing a specific fight;
  - a flag becoming true.
- The player can't move or open menus while an event is running (except to read and click through).

Example of how it would read:

```ts
arthurLeaves: [
  say('arthur', "This is where I leave you. My brother's farm is just past the ridge."),
  choice(['Good luck, Arthur.', 'We still need you!'], [
    [say('arthur', 'And you.')],
    [say('arthur', "You'll manage. Yasmi will see to that.")],
  ]),
  removeMember('arthur'),
  setFlag('arthurLeft'),
],
```

**Questions**
7. Does the story **branch**? Do choices just change a line or two, or can they change what happens (who joins, which fight)?
8. Can a story fight be **lost on purpose** (the story continues), or does losing always mean retry?
9. How much cutscene do you imagine? Simple dialogue with characters walking a few steps, or more staged scenes?

---

## 3. Party roster & party manager

**Proposal**
- **Roster:** every character the player has met and unlocked. **Active party:** the ones walking around and fighting (max 5?).
- Story events can:
  - **add** someone (they join the roster, and the active party if there's room);
  - **remove** someone (they leave the roster, temporarily or for good);
  - **lock** someone into the active party (story needs them there) or out of it.
- **Party manager** screen (key **P**, out of combat only):
  - two lists, **Active** and **Reserve**; drag a portrait between them;
  - pick the leader;
  - see each character's level and class;
  - locked characters show a lock icon;
  - opens the tactics or progression screen for a character.
- Character data (class, base stats, starting actions/tactics, portraits) stays in `src/data/party.ts`, extended with more characters.

**Questions**
10. Max **active party size** — always 5, or can it vary (e.g. 4, or a story section with only 2)?
11. Do characters in the **reserve** earn XP (all, some, none)?
12. When someone leaves and later returns: same level, tactics and progress as when they left?
13. Can the party ever be just one character, and can the leader be locked by the story?

---

## 4. XP & levels

**Proposal**
- Each enemy gives XP when beaten. After a won fight, XP is split among the active party, and fallen characters get it too.
- Levelling up raises HP and attack power a little, and gives **1 progression point**.
- A short "Level up!" note over the character, plus in the fight result.
- Levels, XP per level and stat growth live in a data file per class, easy to rebalance.

**Questions**
14. XP per **character** (each levels on their own), or a **shared party level**?
15. A rough **level cap** for the full game (10? 20? 50?) and how long the game is meant to be?
16. Do stats grow automatically per level, or only through the progression tree?

---

## 5. Progression trees

**Proposal**
- Each character has their own **tree** (or a tree per class), spending the points from levelling. Kinds of node:
  - **New action**: e.g. Hyne learns *Group Heal*. This is how new tactic Actions are unlocked.
  - **Upgrade an action**: more damage, shorter cooldown, longer duration, an extra effect (Firebolt burns).
  - **Stat boost**: max HP, attack, speed.
  - **Passive**: e.g. "Ward also heals 10 HP".
  - **More tactic rows**: start with fewer than 10 rows and unlock the rest. This makes "programming" a progression of its own.
- Nodes have prerequisites (a tree, not a flat list) and maybe a minimum level.
- Tree screen (from the party manager or a key): nodes as icons, click to unlock, hover for details.
- Trees are data files, `src/data/progression/<character>.ts`: nodes, costs, links, effects.

**Questions**
17. Tree per **character** (Hyne's tree is Hyne's) or per **class** (if another Cleric joins later, same tree)?
18. Can points be **refunded / respec'd**? Free, at a cost, or never?
19. **Tactic Types** (*HP below 50%*, *Targeting me*…): unlocked in trees too, found in the world, or all available from the start?
20. Tactic **rows**: start with all 10, or unlock them over time?
21. Should a tree branch so two players' Hynes can play differently (pick A *or* B), or is it a path everyone completes eventually?

---

## Suggested build order

Each step ends with something playable, like the milestones so far.

| # | Milestone | Why this order |
|---|---|---|
| M9 | **Game state & saving** | Everything else stores its data here. |
| M10 | **Areas & travel** (2 areas from the slice + exits, NPC you can click) | The world everything else happens in. |
| M11 | **Event scripting** (steps, triggers, flags, choices) | Story drives party changes and unlocks. |
| M12 | **Roster & party manager** (join/leave from events, P screen) | Needs events to add/remove members. |
| M13 | **XP & levels** | Needs saving; feeds the trees. |
| M14 | **Progression trees** (one full tree as the example, the rest as stubs) | Needs XP; adds new tactic Actions. |

The boilerplate for each system comes with placeholder content: two areas, an NPC, an event where someone joins and
someone leaves, a sixth character to swap in, and one tree filled out. You replace that content with the real thing.
