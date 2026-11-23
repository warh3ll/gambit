# Game systems — plan

> Draft by Claude for the designer. Each system has a **proposal** (how it could work) and **questions**.
> Answer inline (write under the question) or in chat; answers move to the decisions log in PLAN.md.
> Nothing here is built yet.

The vertical slice proved the core loop. The next step is the systems a full game needs:
a world made of areas, scripted story events, a changing party, and character progression.

All of them share one foundation: a **game state** that is saved and loaded. That comes first.

---

## 0. Foundation: game state & saving — ✅ built in M9

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
   > **Answer:** Autosave.
2. One save, or several **save slots**?
   > **Answer:** One save.
3. A title screen with *Continue / New game*?
   > Going with yes (simple, fits a single save).

---

## 1. World: areas and travel — ✅ built in M10 (shops, inns, recruiting come with §7)

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
   > **Answer:** A mix: larger areas to walk, plus **instanced** places like dungeons and houses.
5. Towns: what happens in them? Talking to NPCs, shops, resting/healing, recruiting characters?
   > **Answer:** All of those, plus picking up side quests.
6. Can areas be revisited, and do enemies **respawn** (e.g. for grinding XP), or is every fight a one-off?
   > **Answer:** Enemies **respawn on transition**: go into a house and back out, and they're back.
   > Story/boss fights (e.g. the Stranger) are marked **unique** and stay beaten. *(confirmed)*

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
   > **Answer:** No — the main story follows one path. There will be **side quests** (see §2b).
8. Can a story fight be **lost on purpose** (the story continues), or does losing always mean retry?
   > **Answer:** The story only continues when the fight is won. After a loss the player can also walk away and grind first.
9. How much cutscene do you imagine? Simple dialogue with characters walking a few steps, or more staged scenes?
   > **Answer:** Mostly dialogue at first, with a **headshot** of the person talking.

---

## 2b. Side quests

**Proposal**
- A side quest is a set of events plus a few flags: *started → steps → done*.
  It's built on the event system, with nothing new underneath.
- A **quest log** screen (key **Q**) lists active and finished quests, with the current step as one line of text.
- Quests are defined in data:
  - an id, a title, and a line of text per step;
  - rewards (XP, a new character, an item later on).

**Questions**
- Do you want a quest log, or should quests only live in dialogue?
  > **Answer:** Yes, a quest log.
- Rewards: XP? New characters? Items/equipment?
  > **Answer:** All of those, depending on the quest. Items need the inventory (§6).

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
    > **Answer:** Yes, **50%** of the XP the active party gets.
12. When someone leaves and later returns: same level, tactics and progress as when they left?
13. Can the party ever be just one character, and can the leader be locked by the story?

---

## 4. XP & levels

**Proposal**
- Each enemy gives XP when beaten. After a won fight, every active party member gets the **full** XP
  (fallen ones too), and every reserve member gets **50%**.
- Levelling up raises HP and attack power a little, and gives **1 progression point**.
- A short "Level up!" note over the character, plus in the fight result.
- Levels, XP per level and stat growth live in a data file per class, easy to rebalance.

**Questions**
14. XP per **character** (each levels on their own), or a **shared party level**?
    > **Answer:** Per character. Active party gets full XP, reserve (sidelines) gets 50%.
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
  - ~~**More tactic rows**~~ — not part of trees (see answer to 19–20).
- Nodes have prerequisites (a tree, not a flat list) and maybe a minimum level.
- Tree screen (from the party manager or a key): nodes as icons, click to unlock, hover for details.
- Trees are data files, `src/data/progression/<character>.ts`: nodes, costs, links, effects.

**Questions**
17. Tree per **character** (Hyne's tree is Hyne's) or per **class** (if another Cleric joins later, same tree)?
18. Can points be **refunded / respec'd**? Free, at a cost, or never?
19. **Tactic Types** (*HP below 50%*, *Targeting me*…): unlocked in trees too, found in the world, or all available from the start?
20. Tactic **rows**: start with all 10, or unlock them over time?
    > **Answer (19–20):** Trees let each character **learn new skills or upgrade existing ones** — they do **not**
    > unlock tactic Types or Targets. **All Types, Targets and all 10 rows are available from the start.**
21. Should a tree branch so two players' Hynes can play differently (pick A *or* B), or is it a path everyone completes eventually?

---

## 6. Inventory: equipment & consumables

**Proposal**
- One **shared party inventory** (bag) with two kinds of item:
  - **Equipment**, worn by a character. Each character has slots, e.g. **Weapon**, **Armour** and **Trinket**.
    - A weapon keeps the character's weapon type: Arthur always uses melee weapons, Telara always uses wands.
      A better weapon changes the numbers (damage, speed, maybe range) and can add an effect.
    - Armour and trinkets give stats (HP, damage taken) or small passives.
  - **Consumables**, used up: potions, antidotes, scrolls. Stackable.
- **Using consumables:** out of combat, from the inventory screen. In combat, the player isn't involved, so…
  - …proposal: consumables become tactic **Actions**, e.g. `Use Potion | Any ally | HP below 25%`.
    The row only fires while the bag has one. This keeps the "you program, you don't play" idea.
- **Gold** for buying and selling in shops.
- Items come from quest rewards, shops, chests in the world, and maybe enemy drops.
- Inventory screen (key **I**): bag list, equipment per character, compare stats when choosing.
- Items are data in `src/data/items.ts`: id, name, kind, slot, stats/effect, price, icon.

**Questions**
22. Equipment **slots**: Weapon + Armour + Trinket, or something else?
23. Can consumables be used **in combat via tactics** (`Use Potion | …`), or only outside fights?
24. **Gold**: yes or no? Can items be **sold**?
25. **Enemy drops**: do enemies drop items/gold, or do items only come from quests, shops and chests?
26. Inventory **limit** (slots/weight), or unlimited?

---

## 7. Town services

Built from pieces of the other systems, mostly as NPC events:
- **Shops**: an NPC opens a buy/sell screen (needs §6).
- **Resting**: an inn NPC or a bed restores the party's HP, maybe for gold.
- **Recruiting**: an event that adds a character to the roster (needs §3).
- **Side quests**: NPCs start and finish quests (needs §2b).

---

## Suggested build order

Each step ends with something playable, like the milestones so far.

| # | Milestone | Why this order |
|---|---|---|
| M9 ✅ | **Game state & saving** | Everything else stores its data here. |
| M10 ✅ | **Areas & travel** (2 areas from the slice + exits, NPC you can click) | The world everything else happens in. |
| M11 | **Event scripting** (steps, triggers, flags, choices) | Story drives party changes and unlocks. |
| M12 | **Roster & party manager** (join/leave from events, P screen) | Needs events to add/remove members. |
| M13 | **XP & levels** | Needs saving; feeds the trees. |
| M14 | **Progression trees** (one full tree as the example, the rest as stubs) | Needs XP; adds new tactic Actions. |
| M15 | **Inventory & equipment** (bag, slots, consumables, gold) | Quest rewards and shops need it. |
| M16 | **Quests & town services** (quest log, shop, inn, recruiting) | Built on events, roster and inventory. |

The boilerplate for each system comes with placeholder content: two areas, an NPC, an event where someone joins and
someone leaves, a sixth character to swap in, and one tree filled out. You replace that content with the real thing.
