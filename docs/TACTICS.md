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
If no row fires, the character waits.

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

Numbers are placeholders until balancing.

| Action | Used by | Targets | Effect | Range | Cooldown | Status |
|---|---|---|---|---|---|---|
| Attack | Everyone | Enemy | 10 damage | 20 | — | ✅ data |
| Taunt | Yasmi | Enemy | Enemy targets the user | 80 | 6s | ✅ data |
| Heal | Hyne | Self, Ally | Restore 30 HP | 100 | 3s | ✅ data |
| Hex | Oxleth | Enemy | Takes more damage for 6s | 100 | 8s | ✅ data |
| Ward | Oxleth | Self, Ally | Takes less damage for 6s | 100 | 8s | ✅ data |
| Pierce | Arthur | Enemy | 18 damage | 32 | 4s | ✅ data |
| Firebolt | Telara | Enemy | 16 damage | 120 | 2s | ✅ data |

"✅ data" = defined, effect not yet working in combat (arrives in M3).

### Planned / ideas
- *(add here)*

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
