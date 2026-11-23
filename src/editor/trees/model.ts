/**
 * Skill trees in the editor: which classes there are, how effects read in words, editing nodes and links,
 * the rules for picking a route, and the problems a tree can have.
 */
import { PARTY } from '../../data/party';
import { ACTIONS } from '../../data/tactics';
import { type ClassTree, type CharacterStat, LEVEL_CAP, type TreeEffect, type TreeNode, type UpgradeStat, tierLevel } from '../../data/trees';
import { freshId } from '../steps';
import { type Content, commit } from '../store';
import type { Problem } from '../validate';

// ── classes ──

export interface ClassInfo {
  id: string;
  name: string;
  /** Party members of this class. */
  members: { id: string; name: string; color: number }[];
  /** Actions its characters start with. */
  starts: string[];
}

/** Every class: those of the party (src/data/party.ts), plus any that only have a tree so far. */
export function classList(c: Content): ClassInfo[] {
  const out = new Map<string, ClassInfo>();
  for (const p of PARTY) {
    const info = out.get(p.classId) ?? { id: p.classId, name: p.className, members: [], starts: [] };
    info.members.push({ id: p.id, name: p.name, color: p.color });
    for (const a of p.actions) if (!info.starts.includes(a)) info.starts.push(a);
    out.set(p.classId, info);
  }
  for (const id of Object.keys(c.trees.classes)) {
    if (!out.has(id)) out.set(id, { id, name: id.charAt(0).toUpperCase() + id.slice(1), members: [], starts: [] });
  }
  return [...out.values()];
}

export const classInfo = (c: Content, id: string) => classList(c).find((x) => x.id === id);

// ── actions and effects in words ──

export const isBuilt = (action: string) => action in ACTIONS;

export function actionName(c: Content, action: string): string {
  if (isBuilt(action)) return ACTIONS[action as keyof typeof ACTIONS].label;
  return c.trees.newActions[action]?.name || action || '?';
}

export const UPGRADE_STATS: Record<UpgradeStat, { label: string; unit: string; hint: string }> = {
  power: { label: 'Power', unit: '', hint: 'damage or healing' },
  cooldown: { label: 'Cooldown', unit: ' s', hint: 'negative = ready sooner' },
  duration: { label: 'Duration', unit: ' s', hint: 'how long a buff or debuff lasts' },
  range: { label: 'Range', unit: ' px', hint: '16 px is one tile' },
};

export const CHARACTER_STATS: Record<CharacterStat, string> = { maxHp: 'Max HP', attack: 'Attack', speed: 'Speed' };

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '±0');

/** An effect in a few words, e.g. "Heal: cooldown −0.5 s". */
export function effectText(c: Content, e: TreeEffect): string {
  switch (e.kind) {
    case 'learn':
      return `Learn ${actionName(c, e.action)}`;
    case 'upgrade':
      return `${actionName(c, e.action)}: ${UPGRADE_STATS[e.stat].label.toLowerCase()} ${signed(e.amount)}${UPGRADE_STATS[e.stat].unit}`;
    case 'stat':
      return `${CHARACTER_STATS[e.stat]} ${signed(e.amount)}`;
    case 'special':
      return e.text || 'Special (not described yet)';
  }
}

/** Needs programming before the game can do it: a new action, or a special effect. */
export const toBuild = (e: TreeEffect) => (e.kind === 'learn' && !isBuilt(e.action)) || e.kind === 'special';

// ── ids ──

/** "Group Heal" → "groupHeal". */
export function idFromName(name: string, fallback: string): string {
  const words = name.normalize('NFD').replace(/[^A-Za-z0-9 ]/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return fallback;
  const id = words.map((w, i) => (i ? w[0].toUpperCase() + w.slice(1) : w[0].toLowerCase() + w.slice(1))).join('');
  return /^[A-Za-z]/.test(id) ? id : `n${id}`;
}

export const allNodes = (tree: ClassTree) => tree.tiers.flat();

export function findNode(tree: ClassTree, id: string): { tier: number; index: number; node: TreeNode } | null {
  for (let tier = 0; tier < tree.tiers.length; tier++) {
    const index = tree.tiers[tier].findIndex((n) => n.id === id);
    if (index >= 0) return { tier, index, node: tree.tiers[tier][index] };
  }
  return null;
}

/** Changes one class's tree (making it if it doesn't exist yet). */
export function editTree(cls: string, fn: (tree: ClassTree, c: Content) => void, coalesce?: string) {
  commit((c) => {
    c.trees.classes[cls] ??= { tiers: [] };
    fn(c.trees.classes[cls], c);
  }, coalesce);
}

/** Renames a node; the nodes that follow it follow the new id. */
export function renameNode(tree: ClassTree, from: string, to: string) {
  const at = findNode(tree, from);
  if (!at) return;
  at.node.id = to;
  for (const n of tree.tiers[at.tier + 1] ?? []) n.follows = n.follows.map((f) => (f === from ? to : f));
}

/**
 * Sets a node's name. While its id still matches its name (as when it was made), the id follows the name,
 * so the file stays readable.
 */
export function setNodeName(tree: ClassTree, id: string, name: string): string {
  const at = findNode(tree, id);
  if (!at) return id;
  const derived = at.node.id === idFromName(at.node.name, at.node.id);
  at.node.name = name;
  if (!derived) return id;
  const next = idFromName(name, at.node.id);
  if (next === id || findNode(tree, next)) return id;
  renameNode(tree, id, next);
  return next;
}

export function removeNode(tree: ClassTree, id: string) {
  const at = findNode(tree, id);
  if (!at) return;
  tree.tiers[at.tier].splice(at.index, 1);
  for (const n of tree.tiers[at.tier + 1] ?? []) n.follows = n.follows.filter((f) => f !== id);
}

/** Moves a node to another tier (its links are dropped: they only make sense between neighbouring tiers). */
export function moveNodeToTier(tree: ClassTree, id: string, tier: number) {
  const at = findNode(tree, id);
  if (!at || tier < 0 || tier === at.tier) return;
  removeNode(tree, id);
  while (tree.tiers.length <= tier) tree.tiers.push([]);
  tree.tiers[tier].push({ ...at.node, follows: [] });
}

/** Links `from` (tier t) to `to` (tier t+1), or unlinks them if they were linked. */
export function toggleLink(tree: ClassTree, from: string, to: string) {
  const a = findNode(tree, from);
  const b = findNode(tree, to);
  if (!a || !b || b.tier !== a.tier + 1) return;
  b.node.follows = b.node.follows.includes(from) ? b.node.follows.filter((f) => f !== from) : [...b.node.follows, from];
}

/** Removes a tier; the tier after it loses its links (they pointed at the removed nodes). */
export function removeTier(tree: ClassTree, tier: number) {
  tree.tiers.splice(tier, 1);
  const prev = new Set((tree.tiers[tier - 1] ?? []).map((n) => n.id));
  for (const n of tree.tiers[tier] ?? []) n.follows = n.follows.filter((f) => prev.has(f));
}

export function newNode(tree: ClassTree, name = 'New node'): TreeNode {
  const id = freshId(idFromName(name, 'node'), (x) => !!findNode(tree, x));
  return { id, name, text: '', follows: [], effects: [] };
}

// ── routes ──

/** Whether a character at `level`, having picked `picks` (one per tier so far), can pick `node` next. */
export function canPick(tree: ClassTree, picks: string[], level: number, node: TreeNode): boolean {
  const tier = picks.length;
  if (!tree.tiers[tier]?.includes(node)) return false;
  if (level < tierLevel(tier) || level < (node.minLevel ?? 0)) return false;
  return tier === 0 || node.follows.includes(picks[tier - 1]);
}

// ── problems ──

export function checkTrees(c: Content): Problem[] {
  const out: Problem[] = [];
  const maxTiers = LEVEL_CAP - 1;
  const learnedAnywhere = new Set<string>();
  for (const tree of Object.values(c.trees.classes)) for (const n of allNodes(tree)) for (const e of n.effects) if (e.kind === 'learn') learnedAnywhere.add(e.action);

  for (const [cls, tree] of Object.entries(c.trees.classes)) {
    const info = classInfo(c, cls);
    const name = info?.name ?? cls;
    const add = (level: Problem['level'], text: string, node?: string) => out.push({ level, tree: { cls, node }, text: `${name} tree: ${text}` });
    if (!info?.members.length) add('warning', 'no party member has this class yet (classes come from src/data/party.ts).');
    if (tree.tiers.length > maxTiers) add('warning', `${tree.tiers.length} tiers, but a character only gets ${maxTiers} points by level ${LEVEL_CAP}.`);

    const seen = new Set<string>();
    // Actions this class can have by each tier: what it starts with, plus what any node on an earlier tier teaches.
    const known = new Set(info?.starts ?? []);
    tree.tiers.forEach((nodes, t) => {
      if (!nodes.length) add('warning', `tier ${t + 1} is empty.`);
      const prev = new Set((tree.tiers[t - 1] ?? []).map((n) => n.id));
      const next = tree.tiers[t + 1] ?? [];
      for (const n of nodes) {
        const label = `“${n.name || n.id}” (tier ${t + 1})`;
        if (seen.has(n.id)) add('error', `two nodes have the id “${n.id}”.`, n.id);
        seen.add(n.id);
        if (!n.name.trim()) add('warning', `a node on tier ${t + 1} has no name.`, n.id);
        if (t > 0 && !n.follows.length) add('error', `nothing leads to ${label}, so it can never be picked.`, n.id);
        for (const f of n.follows) if (!prev.has(f)) add('error', `${label} follows “${f}”, which isn't on the tier before.`, n.id);
        if (t === 0 && n.follows.length) add('warning', `${label} is on the first tier but follows other nodes.`, n.id);
        if (next.length && !next.some((x) => x.follows.includes(n.id))) add('warning', `a route ends at ${label}: nothing on tier ${t + 2} follows it.`, n.id);
        if (n.minLevel && n.minLevel > LEVEL_CAP) add('warning', `${label} needs level ${n.minLevel}, above the level cap (${LEVEL_CAP}).`, n.id);
        if (!n.effects.length) add('warning', `${label} does nothing yet (no effects).`, n.id);
        for (const e of n.effects) {
          if (e.kind === 'learn' || e.kind === 'upgrade') {
            if (!e.action) add('error', `${label} has an effect without an action.`, n.id);
            else if (!isBuilt(e.action) && !c.trees.newActions[e.action]) add('error', `${label} uses an unknown action “${e.action}”.`, n.id);
          }
          if (e.kind === 'learn' && info?.starts.includes(e.action)) add('warning', `${label} teaches ${actionName(c, e.action)}, which ${name}s already know.`, n.id);
          if (e.kind === 'upgrade' && e.action && !known.has(e.action)) {
            add('warning', `${label} upgrades ${actionName(c, e.action)}, which ${name}s don't know by then.`, n.id);
          }
          if ((e.kind === 'upgrade' || e.kind === 'stat') && !e.amount) add('warning', `${label} changes a number by 0.`, n.id);
          if (e.kind === 'special' && !e.text.trim()) add('warning', `${label} has a special effect with no description.`, n.id);
        }
      }
      for (const n of nodes) for (const e of n.effects) if (e.kind === 'learn') known.add(e.action);
    });
  }

  for (const [id, a] of Object.entries(c.trees.newActions)) {
    if (isBuilt(id)) out.push({ level: 'warning', tree: { cls: '' }, text: `The new action “${a.name}” is in the game now; it can come off the to-build list.` });
    else if (!learnedAnywhere.has(id)) out.push({ level: 'warning', tree: { cls: '' }, text: `The new action “${a.name}” isn't taught by any tree.` });
  }
  return out;
}
