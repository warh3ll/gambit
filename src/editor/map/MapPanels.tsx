/** The Map tab: the list of areas, the toolbar, and the panel on the right (tool options, selection, area settings). */
import { useEffect, useRef, useState } from 'preact/hooks';
import { TILE_SIZE } from '../../config';
import type { AreaFile } from '../../data/areas/types';
import { ENEMIES } from '../../data/enemies';
import { go, useNav } from '../nav';
import { ProblemsCard } from '../side';
import { freshId, hex } from '../steps';
import { type Content, commit, useStore } from '../store';
import { Card, NpcSprite, RenameField } from '../ui';
import type { Problem } from '../validate';
import { type Picture, enemyPicture, onArtLoaded, tileset } from './art';
import {
  TILES,
  areaUses,
  editArea,
  groupOfEnemy,
  idProblem,
  mapSize,
  nameGroup,
  newArea,
  removeThing,
  renameArea,
  renameStart,
  resize,
  startUses,
  thingRect,
  tileInfo,
} from './edit';
import { MapView, describe } from './MapView';
import { type Selection, type Tool, ZOOMS, select, setUi, useMapUi } from './state';

// ── area list ──

export function MapSidebar({ problems }: { problems: Problem[] }) {
  const { content } = useStore();
  const nav = useNav();
  const add = () => {
    const id = freshId('newArea', (x) => x in content.areas);
    commit((c) => (c.areas[id] = newArea('New area')));
    go('map', id);
  };
  return (
    <nav class="sidebar">
      <div class="list top-pad">
        {Object.entries(content.areas).map(([id, a]) => {
          const { w, h } = mapSize(a);
          const mine = problems.filter((p) => p.area === id);
          const flag = mine.some((p) => p.level === 'error') ? 'error' : mine.length ? 'warning' : null;
          return (
            <button key={id} class={`item ${nav.id === id ? 'active' : ''}`} onClick={() => go('map', id)}>
              <span class="item-title">
                {a.name || id}
                {flag && <span class={`dot ${flag}`} />}
              </span>
              <span class="item-sub">
                {a.kind} · {w} × {h}
                {content.story.newGame.area === id ? ' · new game' : ''}
              </span>
            </button>
          );
        })}
      </div>
      <button class="new" onClick={add}>
        + New area
      </button>
    </nav>
  );
}

// ── the page: toolbar + map ──

export function MapPage() {
  const nav = useNav();
  const { content } = useStore();
  const id = nav.id;
  if (!id || !content.areas[id]) return <div class="empty-page muted">Pick an area on the left, or make a new one.</div>;
  return (
    <div class="map-page">
      <Toolbar area={content.areas[id]} />
      <MapView id={id} key={id} />
    </div>
  );
}

const TOOLS: { tool: Tool; label: string; key: string; title: string }[][] = [
  [{ tool: 'select', label: 'Select', key: 'V', title: 'Select and move things' }],
  [
    { tool: 'brush', label: 'Brush', key: 'B', title: 'Paint tiles' },
    { tool: 'rect', label: 'Rectangle', key: 'R', title: 'Fill a rectangle with tiles' },
    { tool: 'fill', label: 'Fill', key: 'G', title: 'Fill a patch of the same tile' },
  ],
  [
    { tool: 'start', label: 'Start', key: 'P', title: 'Add a start point (where the party arrives)' },
    { tool: 'exit', label: 'Exit', key: 'X', title: 'Add an exit to another area' },
    { tool: 'npc', label: 'NPC', key: 'N', title: 'Place an NPC' },
    { tool: 'enemy', label: 'Enemy', key: 'E', title: 'Place an enemy' },
    { tool: 'trigger', label: 'Trigger', key: 'T', title: 'Draw a story trigger' },
  ],
  [{ tool: 'play', label: '▶ Play from here', key: 'Y', title: 'Click a tile to put the party there in the game tab' }],
];

function Toolbar({ area }: { area: AreaFile }) {
  const ui = useMapUi();
  const zi = ZOOMS.indexOf(ui.zoom);
  return (
    <div class="map-toolbar">
      <div class="map-title" title="Area settings" onClick={() => select(null)}>
        {area.name || 'Unnamed area'}
      </div>
      {TOOLS.map((group, i) => (
        <div class="tool-group" key={i}>
          {group.map((t) => (
            <button key={t.tool} class={`tool ${ui.tool === t.tool ? 'active' : ''}`} title={`${t.title} (${t.key})`} onClick={() => setUi({ tool: t.tool })}>
              {t.tool === 'brush' && <TileSwatch char={ui.tile} scale={1} />}
              {t.label}
            </button>
          ))}
        </div>
      ))}
      <span class="spacer" />
      <div class="tool-group">
        <button class="tool" disabled={zi <= 0} title="Zoom out (−)" onClick={() => setUi({ zoom: ZOOMS[zi - 1] })}>
          −
        </button>
        <span class="zoom">{ui.zoom}×</span>
        <button class="tool" disabled={zi >= ZOOMS.length - 1} title="Zoom in (+)" onClick={() => setUi({ zoom: ZOOMS[zi + 1] })}>
          +
        </button>
      </div>
      <label class="check">
        <input type="checkbox" checked={ui.grid} onChange={(e) => setUi({ grid: e.currentTarget.checked })} /> Grid
      </label>
      <label class="check">
        <input type="checkbox" checked={ui.labels} onChange={(e) => setUi({ labels: e.currentTarget.checked })} /> Labels
      </label>
    </div>
  );
}

// ── pictures ──

function useArtTick() {
  const [tick, setTick] = useState(0);
  useEffect(() => onArtLoaded(() => setTick((n) => n + 1)), []);
  return tick;
}

/** One map tile, as it looks in the game. */
export function TileSwatch({ char, scale = 2 }: { char: string; scale?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const tick = useArtTick();
  const id = tileInfo(char)?.id ?? 0;
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, TILE_SIZE, TILE_SIZE);
    ctx.drawImage(tileset().img, id * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE, 0, 0, TILE_SIZE, TILE_SIZE);
  }, [id, tick]);
  return <canvas class="pix swatch" ref={ref} width={TILE_SIZE} height={TILE_SIZE} style={{ width: TILE_SIZE * scale, height: TILE_SIZE * scale }} />;
}

function PictureIcon({ pic, scale = 2 }: { pic: Picture | null; scale?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const tick = useArtTick();
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx || !pic) return;
    ctx.clearRect(0, 0, pic.w, pic.h);
    ctx.drawImage(pic.img, 0, 0);
  }, [pic, tick]);
  if (!pic) return null;
  return <canvas class="pix" ref={ref} width={pic.w} height={pic.h} style={{ width: pic.w * scale, height: pic.h * scale }} />;
}

// ── the panel on the right ──

export function MapSide({ problems }: { problems: Problem[] }) {
  const nav = useNav();
  const { content } = useStore();
  const id = nav.id && content.areas[nav.id] ? nav.id : null;
  return (
    <aside class="side">
      {id && <ToolCard />}
      {id && <SelectionCard id={id} area={content.areas[id]} />}
      <ProblemsCard problems={problems} />
    </aside>
  );
}

function ToolCard() {
  const ui = useMapUi();
  const { content } = useStore();
  if (ui.tool === 'brush' || ui.tool === 'rect' || ui.tool === 'fill') {
    return (
      <Card title="Tiles" right={<span class="muted small">right-click on the map picks one</span>}>
        <div class="palette">
          {TILES.map((t) => (
            <button key={t.char} class={`pal ${ui.tile === t.char ? 'active' : ''}`} title={t.blocking ? `${t.name}: blocks walking` : t.name} onClick={() => setUi({ tile: t.char })}>
              <TileSwatch char={t.char} />
              <span>{t.name}</span>
              {t.blocking && <span class="blocks" title="Blocks walking" />}
            </button>
          ))}
        </div>
      </Card>
    );
  }
  if (ui.tool === 'npc') {
    const npcs = Object.entries(content.npcs);
    const picked = ui.npc in content.npcs ? ui.npc : npcs[0]?.[0];
    const add = () => {
      const id = freshId('newNpc', (x) => x in content.npcs || x in content.story.speakers);
      commit((c) => (c.npcs[id] = { name: 'New NPC', color: '#8a9a6a', talk: [{ do: 'say', speaker: id, text: '' }] }));
      setUi({ npc: id });
    };
    return (
      <Card title="NPC to place">
        <div class="pick-list">
          {npcs.map(([id, n]) => (
            <button key={id} class={`pal ${picked === id ? 'active' : ''}`} onClick={() => setUi({ npc: id })}>
              <NpcSprite id={id} color={hex(n.color)} scale={2} />
              <span>{n.name}</span>
            </button>
          ))}
        </div>
        <button class="new inline" onClick={add}>
          + New NPC
        </button>
      </Card>
    );
  }
  if (ui.tool === 'enemy') {
    return (
      <Card title="Enemy to place">
        <div class="pick-list">
          {Object.values(ENEMIES).map((e) => (
            <button key={e.id} class={`pal ${ui.enemy === e.id ? 'active' : ''}`} onClick={() => setUi({ enemy: e.id })}>
              <span class="pal-icon">
                <PictureIcon pic={enemyPicture(e.id)} />
              </span>
              <span>{e.name}</span>
              <span class="muted small">{e.maxHp} HP</span>
            </button>
          ))}
        </div>
        <p class="muted small">Enemies within 4 tiles of each other form one fight. Enemy types are set up in src/data/enemies.ts.</p>
      </Card>
    );
  }
  return null;
}

function SelectionCard({ id, area }: { id: string; area: AreaFile }) {
  const ui = useMapUi();
  const { content } = useStore();
  const sel = ui.selection && thingRect(area, ui.selection) ? ui.selection : null;
  if (!sel) return <AreaCard id={id} area={area} />;
  const remove = (
    <button
      class="danger small"
      onClick={() => {
        editArea(id, (a) => removeThing(a, sel));
        select(null);
      }}
    >
      Delete
    </button>
  );
  const pos = thingRect(area, sel)!;
  const where = <span class="muted small mono">{sel.kind === 'trigger' ? `${pos.x}, ${pos.y} · ${pos.w} × ${pos.h}` : `${pos.x}, ${pos.y}`}</span>;
  const title = { start: 'Start point', exit: 'Exit', npc: 'NPC', enemy: 'Enemy', trigger: 'Story trigger' }[sel.kind];
  return (
    <Card title={title} right={remove}>
      <div class="fields compact">
        {sel.kind === 'start' && <StartFields id={id} area={area} name={sel.name} content={content} />}
        {sel.kind === 'exit' && <ExitFields id={id} area={area} index={sel.index} content={content} />}
        {sel.kind === 'npc' && <NpcFields id={id} area={area} index={sel.index} content={content} />}
        {sel.kind === 'enemy' && <EnemyFields id={id} area={area} index={sel.index} content={content} />}
        {sel.kind === 'trigger' && <TriggerFields id={id} area={area} index={sel.index} content={content} />}
        <label>
          <span>Where</span>
          {where}
        </label>
      </div>
      <p class="muted small">
        <a href="#" onClick={(e) => (e.preventDefault(), select(null))}>
          Area settings
        </a>{' '}
        · Esc deselects, Delete removes.
      </p>
    </Card>
  );
}

type FieldProps = { id: string; area: AreaFile; content: Content };

function StartFields({ id, area, name, content }: FieldProps & { name: string }) {
  const uses = startUses(content, id, name);
  return (
    <>
      <label>
        <span>Name</span>
        <RenameField
          value={name}
          check={(n) => idProblem(n, n in area.starts)}
          onRename={(next) => {
            commit((c) => renameStart(c, id, name, next));
            select({ kind: 'start', name: next });
          }}
        />
      </label>
      {name === 'default' && <p class="muted small">The default start: where a new game begins (in the new-game area), and the fallback if nothing says where to arrive.</p>}
      <label>
        <span>Arriving</span>
        <span class="small">{uses.length ? uses.join('; ') : <span class="muted">Nothing arrives here yet (add an exit elsewhere that leads here).</span>}</span>
      </label>
    </>
  );
}

function ExitFields({ id, area, index, content }: FieldProps & { index: number }) {
  const exit = area.exits[index];
  const target = content.areas[exit.to];
  const starts = target ? Object.keys(target.starts) : [];
  const set = (patch: Partial<typeof exit>) => editArea(id, (a) => Object.assign(a.exits[index], patch));
  return (
    <>
      <label>
        <span>Leads to</span>
        <select
          value={exit.to}
          onChange={(e) => {
            const to = e.currentTarget.value;
            const s = Object.keys(content.areas[to]?.starts ?? {});
            set({ to, at: s.includes('default') ? 'default' : (s[0] ?? 'default') });
          }}
        >
          {!target && <option value={exit.to}>⚠ unknown: {exit.to}</option>}
          {Object.entries(content.areas).map(([aid, a]) => (
            <option key={aid} value={aid}>
              {a.name || aid}
              {aid === id ? ' (this area)' : ''}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Arrive at</span>
        <select value={exit.at} onChange={(e) => set({ at: e.currentTarget.value })}>
          {!starts.includes(exit.at) && <option value={exit.at}>⚠ no such start: {exit.at}</option>}
          {starts.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      {target && (
        <button
          class="small"
          onClick={() => {
            go('map', exit.to);
            if (target.starts[exit.at]) setUi({ selection: { kind: 'start', name: exit.at }, focus: target.starts[exit.at] });
          }}
        >
          Go to {target.name || exit.to} →
        </button>
      )}
      <p class="muted small">Stepping here takes the party there. Paint a Door tile (or anything) under it so players can see it.</p>
    </>
  );
}

function NpcFields({ id, area, index, content }: FieldProps & { index: number }) {
  const npc = area.npcs[index];
  const def = content.npcs[npc.id];
  return (
    <>
      <label>
        <span>Who</span>
        <span class="row">
          {def && <NpcSprite id={npc.id} color={hex(def.color)} scale={2} />}
          <select value={npc.id} onChange={(e) => editArea(id, (a) => (a.npcs[index].id = e.currentTarget.value))}>
            {!def && <option value={npc.id}>⚠ unknown: {npc.id}</option>}
            {Object.entries(content.npcs).map(([nid, n]) => (
              <option key={nid} value={nid}>
                {n.name}
              </option>
            ))}
          </select>
        </span>
      </label>
      {def && (
        <button class="small" onClick={() => go('npcs', npc.id)}>
          Edit {def.name}’s conversation →
        </button>
      )}
    </>
  );
}

function EnemyFields({ id, area, index, content }: FieldProps & { index: number }) {
  const enemy = area.enemies[index];
  const group = groupOfEnemy(area, index);
  const settings = group ? area.encounters[group.id] : undefined;
  /** Settings need a named fight: name it first if it has no name yet. */
  const withName = (c: Content): string | null => {
    if (!group) return null;
    if (group.named) return group.id;
    const name = freshId('fight', (x) => Object.values(c.areas).some((a) => a.enemies.some((e) => e.group === x)));
    nameGroup(c, id, group, name);
    return name;
  };
  const setting = (patch: { unique?: boolean; onWin?: string }) =>
    commit((c) => {
      const name = withName(c);
      if (!name) return;
      const a = c.areas[id];
      const next = { ...a.encounters[name], ...patch };
      if (!next.unique) delete next.unique;
      if (!next.onWin) delete next.onWin;
      if (Object.keys(next).length) a.encounters[name] = next;
      else delete a.encounters[name];
    });
  return (
    <>
      <label>
        <span>Type</span>
        <span class="row">
          <PictureIcon pic={enemyPicture(enemy.type)} />
          <select value={enemy.type} onChange={(e) => editArea(id, (a) => (a.enemies[index].type = e.currentTarget.value))}>
            {!(enemy.type in ENEMIES) && <option value={enemy.type}>⚠ unknown: {enemy.type}</option>}
            {Object.values(ENEMIES).map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </span>
      </label>
      {group && (
        <>
          <h4 class="sub">This fight</h4>
          <label>
            <span>Enemies</span>
            <span class="small">{group.members.map((i) => ENEMIES[area.enemies[i].type as keyof typeof ENEMIES]?.name ?? area.enemies[i].type).join(', ')}</span>
          </label>
          <label>
            <span>Name</span>
            <GroupName
              value={group.named ? group.id : ''}
              placeholder={`${group.id} (unnamed)`}
              check={(n) => idProblem(n, groupsTaken(content, n, group.named ? group.id : null))}
              onRename={(next) => commit((c) => nameGroup(c, id, group, next))}
            />
          </label>
          {group.names.length > 1 && <p class="note warn small">Its enemies have different names ({group.names.join(', ')}); the fight uses “{group.id}”.</p>}
          <label class="inline-check">
            <input type="checkbox" checked={!!settings?.unique} onChange={(e) => setting({ unique: e.currentTarget.checked })} />
            <span>Story fight: stays beaten once won (others come back each time the area loads)</span>
          </label>
          <label>
            <span>After winning</span>
            <EventSelect value={settings?.onWin} suggest={`${group.named ? group.id : 'fight'}Won`} none="nothing" assign={(c, ev) => {
              const name = withName(c);
              if (!name) return;
              const a = c.areas[id];
              a.encounters[name] = { ...a.encounters[name], onWin: ev };
              if (!ev) delete a.encounters[name].onWin;
              if (!Object.keys(a.encounters[name]).length) delete a.encounters[name];
            }} />
          </label>
          {!group.named && <p class="muted small">Name a fight to start it from an event (“Start fight” step).</p>}
        </>
      )}
    </>
  );
}

/** Group names in use anywhere, except `own`. */
const groupsTaken = (c: Content, name: string, own: string | null) =>
  name !== own && Object.values(c.areas).some((a) => a.enemies.some((e) => e.group === name));

/** A fight's name: typed, then applied on Enter or leaving the field. Empty = no change. */
function GroupName(props: { value: string; placeholder: string; check: (n: string) => string | null; onRename: (n: string) => void }) {
  const [draft, setDraft] = useState(props.value);
  useEffect(() => setDraft(props.value), [props.value]);
  const error = draft && draft !== props.value ? props.check(draft) : null;
  const done = () => {
    if (!draft || draft === props.value || error) return setDraft(props.value);
    props.onRename(draft);
  };
  return (
    <span class="rename-wrap">
      <input
        class={`rename mono ${error ? 'invalid' : ''}`}
        value={draft}
        placeholder={props.placeholder}
        spellcheck={false}
        onInput={(e) => setDraft(e.currentTarget.value.trim())}
        onBlur={done}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
      {error && <span class="field-error">{error}</span>}
    </span>
  );
}

function TriggerFields({ id, area, index, content }: FieldProps & { index: number }) {
  const t = area.triggers[index];
  const { w, h } = mapSize(area);
  const size = (k: 'w' | 'h', v: number) =>
    editArea(id, (a) => (a.triggers[index][k] = Math.max(1, Math.min(v || 1, (k === 'w' ? w - t.x : h - t.y)))), `trigger/${id}/${index}/${k}`);
  return (
    <>
      <label>
        <span>Plays</span>
        <EventSelect value={t.event || undefined} suggest={`${id}Trigger`} none="choose an event…" assign={(c, ev) => (c.areas[id].triggers[index].event = ev ?? '')} />
      </label>
      <label>
        <span>Size</span>
        <span class="row">
          <input type="number" class="num" min={1} value={t.w} onInput={(e) => size('w', Number(e.currentTarget.value))} /> ×
          <input type="number" class="num" min={1} value={t.h} onInput={(e) => size('h', Number(e.currentTarget.value))} />
          <span class="muted small">or drag its corner</span>
        </span>
      </label>
      <p class="muted small">
        Plays once, when the party’s leader steps inside. Afterwards the game remembers the flag <code>story.{t.event || '…'}</code>.
        {content.story.events[t.event] ? '' : ' Pick an event, or make a new one.'}
      </p>
    </>
  );
}

const NEW_EVENT = '~new';

/** Picks an event (or makes a new one) and opens it. `assign` sets it in the content, in the same undo step. */
function EventSelect(props: { value?: string; suggest: string; none: string; assign: (c: Content, id: string | undefined) => void }) {
  const { content } = useStore();
  const events = Object.keys(content.story.events);
  const known = !props.value || events.includes(props.value);
  return (
    <span class="row">
      <select
        value={props.value ?? ''}
        onChange={(e) => {
          const v = e.currentTarget.value;
          if (v === NEW_EVENT) {
            const id = freshId(props.suggest, (x) => x in content.story.events);
            commit((c) => {
              c.story.events[id] = [{ do: 'say', text: '' }];
              props.assign(c, id);
            });
          } else commit((c) => props.assign(c, v || undefined));
        }}
      >
        <option value="">— {props.none} —</option>
        {!known && <option value={props.value}>⚠ missing: {props.value}</option>}
        {events.map((ev) => (
          <option key={ev} value={ev}>
            {ev}
          </option>
        ))}
        <option value={NEW_EVENT}>+ New event…</option>
      </select>
      {props.value && known && (
        <button class="small" title="Open this event" onClick={() => go('events', props.value!)}>
          Open →
        </button>
      )}
    </span>
  );
}

function AreaCard({ id, area }: { id: string; area: AreaFile }) {
  const { content } = useStore();
  const ui = useMapUi();
  const { w, h } = mapSize(area);
  const isStart = content.story.newGame.area === id;
  const grow = (edge: 'left' | 'top' | 'right' | 'bottom', n: number) =>
    editArea(id, (a) => resize(a, { left: 0, top: 0, right: 0, bottom: 0, [edge]: n }, ui.tile));
  const remove = () => {
    const uses = areaUses(content, id);
    if (!confirm(`Delete the area “${area.name || id}”?${uses.length ? `\n\nStill used by: ${uses.join(', ')}. Those will show as problems.` : ''}`)) return;
    commit((c) => {
      delete c.areas[id];
      if (c.story.newGame.area === id) c.story.newGame.area = Object.keys(c.areas)[0] ?? '';
    });
    go('map');
  };
  const edge = (label: string, e: 'left' | 'top' | 'right' | 'bottom', min: number) => (
    <span class="edge">
      <span class="muted small">{label}</span>
      <button class="small" disabled={min <= 1} title={`Remove a ${e === 'left' || e === 'right' ? 'column' : 'row'} at the ${e}`} onClick={() => grow(e, -1)}>
        −
      </button>
      <button class="small" title={`Add a ${e === 'left' || e === 'right' ? 'column' : 'row'} at the ${e}`} onClick={() => grow(e, 1)}>
        +
      </button>
    </span>
  );
  return (
    <Card title="Area" right={<span class="muted small mono">{id}.json</span>}>
      <div class="fields compact">
        <label>
          <span>Name</span>
          <input value={area.name} placeholder="Shown when arriving" onInput={(e) => editArea(id, (a) => (a.name = e.currentTarget.value), `area/${id}/name`)} />
        </label>
        <label>
          <span>Id</span>
          <RenameField
            autoFocus={id.startsWith('newArea')}
            value={id}
            check={(n) => idProblem(n, n in content.areas)}
            onRename={(next) => {
              commit((c) => renameArea(c, id, next));
              go('map', next);
            }}
          />
        </label>
        <label>
          <span>Kind</span>
          <select value={area.kind} onChange={(e) => editArea(id, (a) => (a.kind = e.currentTarget.value as AreaFile['kind']))}>
            <option value="outdoor">Outdoor (big, walkable)</option>
            <option value="interior">Interior (a house: centred, dark around)</option>
            <option value="dungeon">Dungeon (dark around)</option>
          </select>
        </label>
        <label>
          <span>On arrival</span>
          <EventSelect value={area.onEnter} suggest={`${id}Arrive`} none="nothing" assign={(c, ev) => (c.areas[id].onEnter = ev)} />
        </label>
        <label class="inline-check">
          <input type="checkbox" checked={isStart} disabled={isStart} onChange={() => commit((c) => (c.story.newGame.area = id))} />
          <span>New games start here{isStart ? ' (pick another area to change this)' : ''}, at the start point “default”</span>
        </label>
        <label>
          <span>Size</span>
          <span class="mono">
            {w} × {h} tiles
          </span>
        </label>
        <div class="edges">
          {edge('Left', 'left', w)}
          {edge('Right', 'right', w)}
          {edge('Top', 'top', h)}
          {edge('Bottom', 'bottom', h)}
        </div>
        <p class="muted small row">
          New tiles: <TileSwatch char={ui.tile} scale={1} /> {tileInfo(ui.tile)?.name} (the tile picked for painting).
        </p>
      </div>
      <div class="card-actions">
        <button class="danger small" onClick={remove}>
          Delete area
        </button>
      </div>
      <ThingList area={area} />
    </Card>
  );
}

/** Everything placed in the area, to find and select things. */
function ThingList({ area }: { area: AreaFile }) {
  const { content } = useStore();
  const all: Selection[] = [
    ...Object.keys(area.starts).map((name) => ({ kind: 'start', name }) as Selection),
    ...area.exits.map((_, index) => ({ kind: 'exit', index }) as Selection),
    ...area.npcs.map((_, index) => ({ kind: 'npc', index }) as Selection),
    ...area.triggers.map((_, index) => ({ kind: 'trigger', index }) as Selection),
  ];
  const fights = new Set<string>();
  for (let i = 0; i < area.enemies.length; i++) {
    const g = groupOfEnemy(area, i);
    if (g && !fights.has(g.id)) {
      fights.add(g.id);
      all.push({ kind: 'enemy', index: g.members[0] });
    }
  }
  if (!all.length) return null;
  return (
    <>
      <h4 class="sub">On this map</h4>
      <ul class="thing-list">
        {all.map((s) => {
          const r = thingRect(area, s)!;
          const g = s.kind === 'enemy' ? groupOfEnemy(area, s.index) : null;
          return (
            <li key={JSON.stringify(s)}>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setUi({ selection: s, focus: { x: r.x, y: r.y } });
                }}
              >
                {g ? `fight “${g.id}” (${g.members.length})` : describe(area, content, s)}
              </a>
            </li>
          );
        })}
      </ul>
    </>
  );
}

