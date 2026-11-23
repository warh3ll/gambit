/** The Trees tab: the list of classes, the tree (tiers left to right), and the panel on the right. */
import { useEffect, useRef, useState } from 'preact/hooks';
import { ACTIONS } from '../../data/tactics';
import { type ClassTree, type CharacterStat, LEVEL_CAP, type TreeEffect, type TreeNode, type UpgradeStat, tierLevel } from '../../data/trees';
import { go, useNav } from '../nav';
import { ProblemsCard } from '../side';
import { ID_PATTERN, freshId } from '../steps';
import { type Content, commit, useStore } from '../store';
import { AutoText, Card, RenameField, renameKey } from '../ui';
import type { Problem } from '../validate';
import {
  CHARACTER_STATS,
  UPGRADE_STATS,
  actionName,
  allNodes,
  canPick,
  classInfo,
  classList,
  editTree,
  effectText,
  findNode,
  idFromName,
  isBuilt,
  moveNodeToTier,
  newNode,
  removeNode,
  removeTier,
  renameNode,
  setNodeName,
  toBuild,
  toggleLink,
} from './model';
import { getTreeUi, selectNode, setTreeUi, useTreeUi } from './state';

const EMPTY: ClassTree = { tiers: [] };
/** When the last link drag ended (its closing click shouldn't deselect). */
let linkEnded = 0;
const css = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

// ── class list ──

export function TreeSidebar({ problems }: { problems: Problem[] }) {
  const { content } = useStore();
  const nav = useNav();
  const add = () => {
    const id = freshId('newClass', (x) => classList(content).some((k) => k.id === x));
    commit((c) => (c.trees.classes[id] = { tiers: [[]] }));
    go('trees', id);
  };
  return (
    <nav class="sidebar">
      <div class="list top-pad">
        {classList(content).map((k) => {
          const tree = content.trees.classes[k.id];
          const mine = problems.filter((p) => p.tree?.cls === k.id);
          const flag = mine.some((p) => p.level === 'error') ? 'error' : mine.length ? 'warning' : null;
          return (
            <button key={k.id} class={`item ${nav.id === k.id ? 'active' : ''}`} onClick={() => go('trees', k.id)}>
              <span class="item-title">
                {k.name}
                {flag && <span class={`dot ${flag}`} />}
              </span>
              <span class="item-sub">
                {k.members.map((m) => m.name).join(', ') || 'no one yet'} · {tree ? `${tree.tiers.length} tier${tree.tiers.length === 1 ? '' : 's'}` : 'no tree yet'}
              </span>
            </button>
          );
        })}
      </div>
      <button class="new" onClick={add} title="A tree for a class no party member has yet (e.g. one coming later)">
        + New class tree
      </button>
    </nav>
  );
}

// ── the tree ──

const COL = 210;
const GAP = 64;
const PAD = 24;
const HEAD = 46;
const NODE = 78;
const VGAP = 12;
const colX = (t: number) => PAD + t * (COL + GAP);
const nodeY = (i: number) => PAD + HEAD + i * (NODE + VGAP);

export function TreePage() {
  const nav = useNav();
  const { content } = useStore();
  const ui = useTreeUi();
  const cls = nav.id;
  const info = cls ? classInfo(content, cls) : undefined;
  if (!cls || !info) return <div class="empty-page muted">Pick a class on the left.</div>;
  const tree = content.trees.classes[cls] ?? EMPTY;
  const route = ui.route;
  const spent = route.picks.length;
  return (
    <div class="map-page">
      <div class="map-toolbar">
        <div class="map-title">{info.name} tree</div>
        <span class="muted small">{info.members.length ? info.members.map((m) => m.name).join(', ') : 'No party member has this class yet'}</span>
        <span class="spacer" />
        {route.on && (
          <div class="tool-group route-bar">
            <label class="check">
              Level
              <select value={route.level} onChange={(e) => setTreeUi({ route: { ...route, level: Number(e.currentTarget.value), picks: [] } })}>
                {Array.from({ length: LEVEL_CAP }, (_, i) => i + 1).map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <span class="small">
              {spent} of {route.level - 1} point{route.level === 2 ? '' : 's'} spent
            </span>
            <button class="tool" disabled={!spent} onClick={() => setTreeUi({ route: { ...route, picks: [] } })}>
              Start over
            </button>
          </div>
        )}
        <button class={`tool ${route.on ? 'active' : ''}`} onClick={() => setTreeUi({ route: { ...route, on: !route.on, picks: [] } })} title="Click through picks as a player would">
          {route.on ? '✓ Trying a route' : '▶ Try a route'}
        </button>
      </div>
      <div
        class="tree-viewport"
        onClick={(e) => {
          // Clicking empty space deselects (but not the click that ends dragging a link).
          if (!(e.target as Element).closest('.tnode, button, .thandle') && performance.now() - linkEnded > 300) selectNode(null);
        }}
      >
        <TreeCanvas cls={cls} tree={tree} />
      </div>
    </div>
  );
}

function TreeCanvas({ cls, tree }: { cls: string; tree: ClassTree }) {
  const { content } = useStore();
  const ui = useTreeUi();
  const ref = useRef<HTMLDivElement>(null);
  const [link, setLink] = useState<{ from: string; tier: number; x0: number; y0: number; x: number; y: number } | null>(null);
  const route = ui.route;
  const tiers = tree.tiers;
  const rows = Math.max(1, ...tiers.map((t) => t.length + 1));
  const width = colX(tiers.length) + COL + PAD;
  const height = nodeY(rows) + PAD;
  const pos = new Map<string, { x: number; y: number }>();
  tiers.forEach((nodes, t) => nodes.forEach((n, i) => pos.set(n.id, { x: colX(t), y: nodeY(i) })));

  // Dragging a link from a node's handle to a node on the next tier.
  useEffect(() => {
    if (!link) return;
    const box = () => ref.current!.getBoundingClientRect();
    const move = (e: PointerEvent) => setLink((l) => l && { ...l, x: e.clientX - box().left, y: e.clientY - box().top });
    const up = (e: PointerEvent) => {
      const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-node]');
      const to = target?.getAttribute('data-node');
      if (to && Number(target!.getAttribute('data-tier')) === link.tier + 1) editTree(cls, (t) => toggleLink(t, link.from, to));
      setLink(null);
      linkEnded = performance.now();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [link?.from]);

  const sel = ui.node;
  const onRoute = new Set(route.on ? route.picks : []);
  const clickNode = (n: TreeNode, t: number) => {
    if (!route.on) return selectNode(n.id);
    const at = route.picks.indexOf(n.id);
    if (at >= 0) return setTreeUi({ route: { ...route, picks: route.picks.slice(0, at) } }); // un-pick (and what came after)
    if (canPick(tree, route.picks, route.level, n)) setTreeUi({ route: { ...route, picks: [...route.picks, n.id] } });
    else selectNode(null);
    void t;
  };
  const addNode = (t: number) => {
    let id = '';
    editTree(cls, (tr) => {
      while (tr.tiers.length <= t) tr.tiers.push([]);
      const node = newNode(tr);
      // A new node follows the selected node, if that's on the tier before.
      const s = getTreeUi().node ? findNode(tr, getTreeUi().node!) : null;
      if (s && s.tier === t - 1) node.follows = [s.node.id];
      tr.tiers[t].push(node);
      id = node.id;
    });
    selectNode(id);
  };

  return (
    <div class="tree-canvas" ref={ref} style={{ width, height }}>
      <svg class="tree-lines" width={width} height={height}>
        {tiers.flatMap((nodes, t) =>
          nodes.flatMap((n) =>
            n.follows.map((f) => {
              const a = pos.get(f);
              const b = pos.get(n.id);
              if (!a || !b || t === 0) return null;
              const x1 = a.x + COL;
              const y1 = a.y + NODE / 2;
              const x2 = b.x;
              const y2 = b.y + NODE / 2;
              const hot = sel === f || sel === n.id;
              const walked = onRoute.has(f) && onRoute.has(n.id);
              return (
                <path
                  key={`${f}>${n.id}`}
                  class={`tlink ${hot ? 'hot' : ''} ${walked ? 'walked' : ''}`}
                  d={`M${x1},${y1} C${x1 + GAP / 2},${y1} ${x2 - GAP / 2},${y2} ${x2},${y2}`}
                />
              );
            }),
          ),
        )}
        {link && <path class="tlink drawing" d={`M${link.x0},${link.y0} L${link.x},${link.y}`} />}
      </svg>

      {tiers.map((nodes, t) => (
        <div key={`h${t}`} class="tier-head" style={{ left: colX(t), top: PAD, width: COL }}>
          <span>
            Tier {t + 1} <span class="muted small">· level {tierLevel(t)}</span>
          </span>
          {!route.on && (
            <button
              class="icon"
              title="Remove this tier"
              onClick={() => {
                if (nodes.length && !confirm(`Remove tier ${t + 1} and its ${nodes.length} node(s)?`)) return;
                editTree(cls, (tr) => removeTier(tr, t));
              }}
            >
              ✕
            </button>
          )}
        </div>
      ))}

      {tiers.map((nodes, t) =>
        nodes.map((n, i) => {
          const picked = onRoute.has(n.id);
          const open = route.on && !picked && canPick(tree, route.picks, route.level, n);
          const state = !route.on ? '' : picked ? 'picked' : open ? 'open' : 'closed';
          const build = n.effects.some(toBuild);
          return (
            <div
              key={n.id}
              class={`tnode ${sel === n.id && !route.on ? 'selected' : ''} ${state} ${link && t === link.tier + 1 ? 'drop' : ''}`}
              data-node={n.id}
              data-tier={t}
              style={{ left: colX(t), top: nodeY(i), width: COL, height: NODE }}
              onClick={() => clickNode(n, t)}
            >
              <div class="tnode-head">
                <span class="tnode-name">{n.name || <span class="muted">no name</span>}</span>
                {n.minLevel && n.minLevel > tierLevel(t) && <span class="badge">lv {n.minLevel}</span>}
                {build && <span class="badge build" title="Needs building (a new action or a special effect)">to build</span>}
              </div>
              <div class="tnode-effects">{n.effects.length ? n.effects.map((e) => effectText(content, e)).join(' · ') : <span class="muted">no effects yet</span>}</div>
              {!route.on && t < tiers.length - 1 && (
                <span
                  class="thandle"
                  title="Drag to a node on the next tier to link them (again to unlink)"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const x0 = colX(t) + COL;
                    const y0 = nodeY(i) + NODE / 2;
                    setLink({ from: n.id, tier: t, x0, y0, x: x0, y: y0 });
                  }}
                />
              )}
            </div>
          );
        }),
      )}

      {!route.on &&
        tiers.map((nodes, t) => (
          <button key={`a${t}`} class="tree-add" style={{ left: colX(t), top: nodeY(nodes.length), width: COL }} onClick={() => addNode(t)}>
            + Add node
          </button>
        ))}
      {!route.on && (
        <button class="tree-add tier" style={{ left: colX(tiers.length), top: PAD, width: COL }} onClick={() => editTree(cls, (tr) => tr.tiers.push([]))}>
          + Add tier
        </button>
      )}
    </div>
  );
}

// ── the panel on the right ──

export function TreeSide({ problems }: { problems: Problem[] }) {
  const nav = useNav();
  const ui = useTreeUi();
  const { content } = useStore();
  const cls = nav.id && classInfo(content, nav.id) ? nav.id : null;
  const tree = cls ? (content.trees.classes[cls] ?? EMPTY) : EMPTY;
  const node = ui.node ? findNode(tree, ui.node) : null;
  return (
    <aside class="side">
      {cls && ui.route.on && <RouteCard tree={tree} />}
      {cls && !ui.route.on && node && <NodeCard cls={cls} tree={tree} at={node} />}
      {cls && !ui.route.on && !node && <ClassCard cls={cls} />}
      <ToBuildCard />
      <ProblemsCard problems={problems} />
    </aside>
  );
}

function ClassCard({ cls }: { cls: string }) {
  const { content } = useStore();
  const info = classInfo(content, cls)!;
  const tree = content.trees.classes[cls];
  const fromParty = info.members.length > 0;
  return (
    <Card title={info.name} right={<span class="muted small mono">{cls}</span>}>
      <div class="fields compact">
        {!fromParty && (
          <label>
            <span>Id</span>
            <RenameField
              value={cls}
              autoFocus={cls.startsWith('newClass')}
              check={(n) => (!ID_PATTERN.test(n) ? 'Letters, digits and _ only, starting with a letter.' : classList(content).some((k) => k.id === n) ? 'That name is taken.' : null)}
              onRename={(next) => {
                commit((c) => (c.trees.classes = renameKey(c.trees.classes, cls, next)));
                go('trees', next);
              }}
            />
          </label>
        )}
        <label>
          <span>Who</span>
          <span class="row small">
            {info.members.length
              ? info.members.map((m) => (
                  <span key={m.id} class="who">
                    <span class="chip-color" style={{ background: css(m.color) }} />
                    {m.name}
                  </span>
                ))
              : 'No party member yet. Classes and characters are set up in src/data/party.ts.'}
          </span>
        </label>
        <label>
          <span>Starts with</span>
          <span class="small">{info.starts.map((a) => actionName(content, a)).join(', ') || '—'}</span>
        </label>
      </div>
      <p class="muted small">
        Every level-up gives one point: tier 1 opens at level 2, tier 2 at level 3, and so on (up to {LEVEL_CAP - 1} tiers by level {LEVEL_CAP}). A
        character picks one node per tier, and only from the nodes that follow their last pick.
      </p>
      <p class="muted small">
        Click a node to edit it. To link two nodes, drag from the ● on a node’s right edge to a node on the next tier (do it again to unlink).
        <b> ▶ Try a route</b> clicks through it as a player would.
      </p>
      {!tree && <p class="note small">No tree yet: add a tier and some nodes.</p>}
      {!fromParty && (
        <div class="card-actions">
          <button
            class="danger small"
            onClick={() => {
              if (!confirm(`Delete the ${info.name} tree?`)) return;
              commit((c) => delete c.trees.classes[cls]);
              go('trees');
            }}
          >
            Delete tree
          </button>
        </div>
      )}
    </Card>
  );
}

function NodeCard({ cls, tree, at }: { cls: string; tree: ClassTree; at: { tier: number; index: number; node: TreeNode } }) {
  const { tier, index, node } = at;
  const nameRef = useRef<HTMLInputElement>(null);
  // A node just made: ready to type its name.
  useEffect(() => {
    if (node.name === 'New node') nameRef.current?.select();
  }, [node.id]);
  const prev = tree.tiers[tier - 1] ?? [];
  const next = (tree.tiers[tier + 1] ?? []).filter((n) => n.follows.includes(node.id));
  const edit = (fn: (n: TreeNode, tr: ClassTree, c: Content) => void, coalesce?: string) =>
    editTree(cls, (tr, c) => {
      const f = findNode(tr, node.id);
      if (f) fn(f.node, tr, c);
    }, coalesce);
  const swap = (d: number) =>
    editTree(cls, (tr) => {
      const list = tr.tiers[tier];
      const j = index + d;
      if (j < 0 || j >= list.length) return;
      [list[index], list[j]] = [list[j], list[index]];
    });
  const levels = Array.from({ length: LEVEL_CAP - tierLevel(tier) }, (_, i) => tierLevel(tier) + 1 + i);
  return (
    <Card
      title="Node"
      right={
        <button
          class="danger small"
          onClick={() => {
            editTree(cls, (tr) => removeNode(tr, node.id));
            selectNode(null);
          }}
        >
          Delete
        </button>
      }
    >
      <div class="fields compact">
        <label>
          <span>Name</span>
          <input
            value={node.name}
            ref={nameRef}
            onInput={(e) => {
              const v = e.currentTarget.value;
              let id = node.id;
              editTree(cls, (tr) => (id = setNodeName(tr, node.id, v)), `tree/${cls}/${tier}/${index}/name`);
              if (id !== node.id) selectNode(id);
            }}
          />
        </label>
        <label>
          <span>Id</span>
          <RenameField
            value={node.id}
            check={(n) => (!ID_PATTERN.test(n) ? 'Letters, digits and _ only, starting with a letter.' : findNode(tree, n) ? 'That id is taken.' : null)}
            onRename={(to) => {
              editTree(cls, (tr) => renameNode(tr, node.id, to));
              selectNode(to);
            }}
          />
        </label>
        <label>
          <span>Text</span>
          <AutoText value={node.text} placeholder="What the player reads about it" onInput={(v) => edit((n) => (n.text = v), `tree/${cls}/${node.id}/text`)} />
        </label>
        <label>
          <span>Tier</span>
          <span class="row">
            {tier + 1} <span class="muted small">(opens at level {tierLevel(tier)})</span>
            <button class="small" disabled={tier === 0} title="Move to the tier before (its links are dropped)" onClick={() => editTree(cls, (tr) => moveNodeToTier(tr, node.id, tier - 1))}>
              ←
            </button>
            <button class="small" title="Move to the next tier (its links are dropped)" onClick={() => editTree(cls, (tr) => moveNodeToTier(tr, node.id, tier + 1))}>
              →
            </button>
            <button class="small" disabled={index === 0} title="Move up" onClick={() => swap(-1)}>
              ↑
            </button>
            <button class="small" disabled={index === tree.tiers[tier].length - 1} title="Move down" onClick={() => swap(1)}>
              ↓
            </button>
          </span>
        </label>
        <label>
          <span>Min. level</span>
          <select value={node.minLevel ?? ''} onChange={(e) => edit((n) => (e.currentTarget.value ? (n.minLevel = Number(e.currentTarget.value)) : delete n.minLevel))}>
            <option value="">— none (level {tierLevel(tier)}) —</option>
            {levels.map((l) => (
              <option key={l} value={l}>
                level {l}
              </option>
            ))}
          </select>
        </label>
      </div>

      <h4 class="sub">Follows</h4>
      {tier === 0 ? (
        <p class="muted small">First tier: anyone can pick it.</p>
      ) : prev.length ? (
        <div class="follow-list">
          {prev.map((p) => (
            <label key={p.id} class="inline-check small">
              <input type="checkbox" checked={node.follows.includes(p.id)} onChange={() => editTree(cls, (tr) => toggleLink(tr, p.id, node.id))} />
              <span>{p.name || p.id}</span>
            </label>
          ))}
        </div>
      ) : (
        <p class="muted small">The tier before is empty.</p>
      )}
      {tier < tree.tiers.length - 1 && (
        <p class="muted small">
          Leads to:{' '}
          {next.length
            ? next.map((n, i) => (
                <>
                  {i > 0 && ', '}
                  <a key={n.id} href="#" onClick={(e) => (e.preventDefault(), selectNode(n.id))}>
                    {n.name || n.id}
                  </a>
                </>
              ))
            : 'nothing yet (the route ends here)'}
        </p>
      )}

      <h4 class="sub">Effects</h4>
      <div class="effects">
        {node.effects.map((e, i) => (
          <EffectRow
            key={i}
            effect={e}
            node={node}
            onChange={(fn, coalesce) => edit((n, _tr, c) => fn(n.effects[i], c), coalesce && `tree/${cls}/${node.id}/fx${i}/${coalesce}`)}
            onRemove={() => edit((n) => n.effects.splice(i, 1))}
          />
        ))}
        <select
          class="add-effect"
          value=""
          onChange={(e) => {
            const kind = e.currentTarget.value as TreeEffect['kind'];
            const fx: TreeEffect =
              kind === 'learn'
                ? { kind, action: '' }
                : kind === 'upgrade'
                  ? { kind, action: '', stat: 'power', amount: 5 }
                  : kind === 'stat'
                    ? { kind, stat: 'maxHp', amount: 20 }
                    : { kind: 'special', text: '' };
            edit((n) => n.effects.push(fx));
          }}
        >
          <option value="">+ Add effect…</option>
          <option value="learn">Learn an action</option>
          <option value="upgrade">Upgrade an action</option>
          <option value="stat">Raise a stat</option>
          <option value="special">Something special (described in words)</option>
        </select>
      </div>
    </Card>
  );
}

const NEW_ACTION = '~new';

function EffectRow(props: { effect: TreeEffect; node: TreeNode; onChange: (fn: (e: TreeEffect, c: Content) => void, coalesce?: string) => void; onRemove: () => void }) {
  const { content } = useStore();
  const e = props.effect;
  const remove = (
    <button class="icon danger" title="Remove this effect" onClick={props.onRemove}>
      ✕
    </button>
  );
  const pickAction = (value: string) =>
    props.onChange((fx, c) => {
      if (fx.kind !== 'learn' && fx.kind !== 'upgrade') return;
      if (value !== NEW_ACTION) {
        fx.action = value;
        return;
      }
      // A new action, named after the node: it goes on the to-build list.
      const name = props.node.name && props.node.name !== 'New node' ? props.node.name : 'New action';
      const id = freshId(idFromName(name, 'newAction'), (x) => x in ACTIONS || x in c.trees.newActions);
      c.trees.newActions[id] = { name, text: props.node.text };
      fx.action = id;
    });
  if (e.kind === 'learn' || e.kind === 'upgrade') {
    const fresh = e.action && !isBuilt(e.action) ? content.trees.newActions[e.action] : undefined;
    return (
      <div class={`effect ${toBuild(e) ? 'build' : ''}`}>
        <div class="row">
          <span class="effect-kind">{e.kind === 'learn' ? 'Learn' : 'Upgrade'}</span>
          <select class="grow" value={e.action} onChange={(ev) => pickAction(ev.currentTarget.value)}>
            {!e.action && <option value="">choose an action…</option>}
            {e.action && !isBuilt(e.action) && !fresh && <option value={e.action}>⚠ unknown: {e.action}</option>}
            <optgroup label="In the game">
              {Object.values(ACTIONS).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </optgroup>
            {Object.keys(content.trees.newActions).length > 0 && (
              <optgroup label="New (to build)">
                {Object.entries(content.trees.newActions).map(([id, a]) => (
                  <option key={id} value={id}>
                    {a.name || id}
                  </option>
                ))}
              </optgroup>
            )}
            <option value={NEW_ACTION}>+ New action…</option>
          </select>
          {remove}
        </div>
        {e.kind === 'upgrade' && (
          <div class="row">
            <select value={e.stat} onChange={(ev) => props.onChange((fx) => fx.kind === 'upgrade' && (fx.stat = ev.currentTarget.value as UpgradeStat))}>
              {Object.entries(UPGRADE_STATS).map(([k, s]) => (
                <option key={k} value={k}>
                  {s.label}
                </option>
              ))}
            </select>
            <input
              type="number"
              class="num"
              step={e.stat === 'cooldown' || e.stat === 'duration' ? 0.5 : 1}
              value={e.amount}
              onInput={(ev) => props.onChange((fx) => fx.kind === 'upgrade' && (fx.amount = Number(ev.currentTarget.value) || 0), 'amount')}
            />
            <span class="muted small">
              {UPGRADE_STATS[e.stat].unit.trim()} {UPGRADE_STATS[e.stat].hint}
            </span>
          </div>
        )}
        {fresh && e.kind === 'learn' && (
          <div class="new-action">
            <span class="badge build">new action, to build</span>
            <input
              value={fresh.name}
              placeholder="Action name"
              onInput={(ev) => props.onChange((_fx, c) => (c.trees.newActions[e.action].name = ev.currentTarget.value), 'na-name')}
            />
            <AutoText
              value={fresh.text}
              placeholder="What it does: target, effect, range, cooldown…"
              onInput={(v) => props.onChange((_fx, c) => (c.trees.newActions[e.action].text = v), 'na-text')}
            />
          </div>
        )}
      </div>
    );
  }
  if (e.kind === 'stat') {
    return (
      <div class="effect">
        <div class="row">
          <span class="effect-kind">Raise</span>
          <select value={e.stat} onChange={(ev) => props.onChange((fx) => fx.kind === 'stat' && (fx.stat = ev.currentTarget.value as CharacterStat))}>
            {Object.entries(CHARACTER_STATS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
          <span class="muted">by</span>
          <input type="number" class="num" value={e.amount} onInput={(ev) => props.onChange((fx) => fx.kind === 'stat' && (fx.amount = Number(ev.currentTarget.value) || 0), 'amount')} />
          <span class="spacer" />
          {remove}
        </div>
      </div>
    );
  }
  return (
    <div class="effect build">
      <div class="row">
        <span class="effect-kind">Special</span>
        <span class="badge build">to build</span>
        <span class="spacer" />
        {remove}
      </div>
      <AutoText value={e.text} placeholder="What it does, e.g. “Firebolt also burns: 3 damage per second for 4 s.”" onInput={(v) => props.onChange((fx) => fx.kind === 'special' && (fx.text = v), 'text')} />
    </div>
  );
}

function RouteCard({ tree }: { tree: ClassTree }) {
  const { content } = useStore();
  const { route } = useTreeUi();
  const picked = route.picks.map((id) => findNode(tree, id)?.node).filter((n): n is TreeNode => !!n);
  const tier = picked.length;
  const options = (tree.tiers[tier] ?? []).filter((n) => canPick(tree, route.picks, route.level, n));
  let why = '';
  if (tier >= tree.tiers.length) why = 'That’s the end of the tree.';
  else if (route.level < tierLevel(tier)) why = `Tier ${tier + 1} opens at level ${tierLevel(tier)}: raise the level to go on.`;
  else if (!options.length) why = `Nothing on tier ${tier + 1} follows this pick${tree.tiers[tier].some((n) => n.minLevel) ? ' at this level' : ''}: the route ends here.`;
  return (
    <Card title="Trying a route" right={<span class="muted small">level {route.level}</span>}>
      <p class="muted small">Click a green node to pick it, a gold one to take it back. Nothing here changes the tree.</p>
      {picked.length ? (
        <ol class="route-list">
          {picked.map((n) => (
            <li key={n.id}>
              <b>{n.name}</b>
              <span class="muted small"> {n.effects.map((e) => effectText(content, e)).join(' · ')}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p class="small">No picks yet.</p>
      )}
      <p class="small">{why || `Next, on tier ${tier + 1}: ${options.map((n) => n.name).join(', ')}.`}</p>
    </Card>
  );
}

/** New actions and special effects: what needs building before the trees work in the game. */
function ToBuildCard() {
  const { content } = useStore();
  const users = (action: string) =>
    Object.entries(content.trees.classes).flatMap(([cls, tree]) =>
      allNodes(tree)
        .filter((n) => n.effects.some((e) => (e.kind === 'learn' || e.kind === 'upgrade') && e.action === action))
        .map((n) => ({ cls, node: n })),
    );
  const specials = Object.entries(content.trees.classes).flatMap(([cls, tree]) =>
    allNodes(tree).flatMap((n) => n.effects.filter((e) => e.kind === 'special').map((e) => ({ cls, node: n, text: e.kind === 'special' ? e.text : '' }))),
  );
  const fresh = Object.entries(content.trees.newActions).filter(([id]) => !isBuilt(id));
  const open = (cls: string, node: string) => {
    go('trees', cls);
    setTreeUi({ node, route: { ...getTreeUi().route, on: false } });
  };
  const count = fresh.length + specials.length;
  return (
    <Card title="To build" right={<span class="muted small">{count}</span>}>
      <p class="muted small">Things the trees use that the game can’t do yet. I build these with progression (M14).</p>
      {fresh.map(([id, a]) => {
        const by = users(id);
        return (
          <div key={id} class="build-item">
            <div class="row">
              <b>{a.name || id}</b>
              <span class="muted small mono">{id}</span>
              <span class="spacer" />
              {!by.length && (
                <button class="small danger" onClick={() => commit((c) => delete c.trees.newActions[id])}>
                  Remove
                </button>
              )}
            </div>
            <div class="small">{a.text || <span class="muted">No description yet.</span>}</div>
            <div class="small muted">
              {by.length
                ? by.map((u, i) => (
                    <>
                      {i > 0 && ', '}
                      <a key={u.cls + u.node.id} href="#" onClick={(e) => (e.preventDefault(), open(u.cls, u.node.id))}>
                        {classInfo(content, u.cls)?.name}: {u.node.name}
                      </a>
                    </>
                  ))
                : 'Not used by any tree.'}
            </div>
          </div>
        );
      })}
      {specials.map((s, i) => (
        <div key={`s${i}`} class="build-item">
          <a href="#" onClick={(e) => (e.preventDefault(), open(s.cls, s.node.id))}>
            {classInfo(content, s.cls)?.name}: {s.node.name}
          </a>
          <div class="small">{s.text || <span class="muted">Not described yet.</span>}</div>
        </div>
      ))}
      {!count && <p class="small">Nothing: everything in the trees exists in the game.</p>}
    </Card>
  );
}
