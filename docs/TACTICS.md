# Tactics

Every character has up to **10 tactic rows**. Each row reads:

```
Action | Target | Type
Heal   | Any ally | HP below 50%
```

- **Action** — what the character does.
- **Target** — the group to look in (self, allies, enemies).
- **Type** — the condition that decides who in that group qualifies, and who is preferred.

During combat, rows are checked **from the top down**. The first row that is switched on,
whose action is ready (off cooldown), and that finds a valid target, is the one that fires.

- **Getting in range:** the character walks towards the row's target until it is within the action's range,
  then acts. Melee fighters walk up close; wand and bow users stop at their range.
- **Ranged keep their distance:** when an enemy gets close, a ranged attacker steps back (staying in range
  of its target), then shoots. At most one step back every 2 seconds, so it can't run forever; a faster
  enemy will catch up, and that's where a tank's Taunt comes in. Enemy archers do the same.
- **Skills on cooldown are skipped**, so a lower row gets its turn. The basic **Attack** is different:
  between swings the row stays chosen and the character waits for its next swing.
- **No row fires:** the character does nothing, but stays close to the rest of the party.
- **Re-checking:** rows are re-checked several times a second, and right after every action.
- **Outside combat** tactics keep running, but only on allies already in range (e.g. Hyne healing someone
  standing next to her). Nobody walks off to do it. Cooldowns work the same as in a fight.

Tactics can be edited at any time, **including in the middle of a fight** — press **T** to open the editor;
combat pauses while it is open. Click a cell to change it, drag the dots to reorder, the box switches a row on/off.
Edits are saved in the browser, so they survive a reload; **Reset to defaults** restores a character's starting rows.

In a fight, floating text shows what happened: **white** damage, **green** heals, the ability name in **gold**
over an ally that got a buff, and in **purple** over an enemy that got a debuff (Hex, Taunt).

The implementation lives in [`src/data/tactics.ts`](../src/data/tactics.ts). This page is the
design-side list — add ideas to the *Planned* sections and they'll get built.

## Targets

| Target | Meaning | Status |
|---|---|---|
| Self | The character itself | ✅ |
| Any ally | Any living party member, **including** self | ✅ |
| Other ally | Any living party member except self | ✅ |
| Enemy | Any living enemy | ✅ |

## Types

| Type | Works with | Picks | Status |
|---|---|---|---|
| Any (nearest) | Self, Ally, Enemy | Anyone, nearest first | ✅ |
| HP below 25% / 50% / 75% | Self, Ally, Enemy | Those under the threshold, lowest % first | ✅ |
| Lowest HP | Ally, Enemy | Lowest current HP | ✅ |
| Highest HP | Ally, Enemy | Highest current HP | ✅ |
| Most dangerous | Enemy | Highest threat rating | ✅ |
| Not targeting me | Enemy | Enemies attacking someone else | ✅ |
| Targeting me | Enemy | Enemies attacking this character | ✅ |
| Under attack | Self, Ally | Allies currently being attacked | ✅ |

### Planned / ideas
- *(add here)*

## Actions

Numbers are placeholders until balancing. Every skill has a short cooldown.

### Basic attack

Everyone has **Attack**. What it does depends on the character's weapon type
(defined in [`src/data/weapons.ts`](../src/data/weapons.ts)):

| Weapon | Characters | Range | Damage | Attack interval |
|---|---|---|---|---|
| Melee | Yasmi, Hyne, Arthur | 20 | 10 | 1.2s |
| Wand (ranged bolt) | Oxleth, Telara | 110 | 7 | 1.6s |
| Bow (ranged) | Enemies only, for now | 130 | 8 | 1.8s |

### Skills

Oxleth the Bane is the support: **buffs** for allies, **debilitating debuffs** for enemies (more to come).

Status effects:

| Status | From | Effect |
|---|---|---|
| Taunted | Taunt | For 4s the enemy can only target whoever taunted it |
| Hexed | Hex | Takes 25% more damage |
| Warded | Ward | Takes 25% less damage |

| Action | Used by | Targets | Effect | Range | Cooldown | Status |
|---|---|---|---|---|---|---|
| Attack | Everyone | Enemy | Weapon attack (see above) | Weapon | Weapon | ✅ |
| Taunt | Yasmi | Enemy | Enemy targets the user | 80 | 6s | ✅ |
| Heal | Hyne | Self, Ally | Restore 45 HP | 100 | 3s | ✅ |
| Hex | Oxleth | Enemy | Debuff: takes more damage for 6s | 100 | 8s | ✅ |
| Ward | Oxleth | Self, Ally | Buff: takes less damage for 6s | 100 | 8s | ✅ |
| Pierce | Arthur | Enemy | 18 damage | 32 | 4s | ✅ |
| Firebolt | Telara | Enemy | 16 damage | 120 | 2s | ✅ |

All actions work in combat as of M3.

### Planned / ideas
- *(add here)*

## Enemy tactics

Each enemy type has preset rows, using the same pieces. From an enemy's point of view,
"Enemy" means the player's party. Defined in [`src/data/enemies.ts`](../src/data/enemies.ts).

| Enemy | Weapon | # | Action | Target | Type |
|---|---|---|---|---|---|
| Wolf | Melee | 1 | Attack | Enemy | Lowest HP |
| Bandit | Melee | 1 | Attack | Enemy | Any |
| Bandit Archer | Bow | 1 | Attack | Enemy | HP below 50% |
| | | 2 | Attack | Enemy | Any |

## Default tactics

| Character | # | Action | Target | Type |
|---|---|---|---|---|
| Yasmi | 1 | Taunt | Enemy | Not targeting me |
| | 2 | Attack | Enemy | Targeting me |
| | 3 | Attack | Enemy | Any |
| Hyne | 1 | Heal | Any ally | HP below 50% |
| | 2 | Attack | Enemy | Any |
| Oxleth | 1 | Ward | Other ally | Under attack |
| | 2 | Hex | Enemy | Most dangerous |
| | 3 | Attack | Enemy | Any |
| Arthur | 1 | Pierce | Enemy | Lowest HP |
| | 2 | Attack | Enemy | Lowest HP |
| Telara | 1 | Firebolt | Enemy | Highest HP |
| | 2 | Attack | Enemy | Any |
