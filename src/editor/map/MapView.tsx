/**
 * The map being painted: tiles and sprites on a canvas (at game resolution, scaled up), with an overlay for
 * labels, fights, triggers, exits and the selection. Handles the tools: select / move, brush, rectangle, fill,
 * and placing start points, exits, NPCs, enemies and story triggers.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { TILE_SIZE } from '../../config';
import type { AreaFile, TilePos } from '../../data/areas/types';
import { ENEMIES } from '../../data/enemies';
import { DEFAULT_LEADER_ID, PARTY } from '../../data/party';
import { TILE_CHARS } from '../../world/tiles';
import { hex } from '../steps';
import { gotoInGame } from '../gameLink';
import { type Content, dirtyFiles, setBanner, useStore } from '../store';
import { characterPicture, enemyPicture, npcPicture, onArtLoaded, tileset } from './art';
import {
  type Rect,
  editArea,
  fillRect,
  floodFill,
  freshStartName,
  groupsOf,
  mapSize,
  moveThing,
  paintLine,
  rectBetween,
  removeThing,
  thingRect,
  thingsAt,
  tileInfo,
} from './edit';
import { type Selection, type Tool, ZOOMS, getUi, sameSelection, select, setUi, useMapUi } from './state';

const T = TILE_SIZE;
const LEADER = PARTY.find((c) => c.id === DEFAULT_LEADER_ID) ?? PARTY[0];

/** What the mouse is doing right now. */
type Gesture =
  | { kind: 'paint'; last: TilePos; key: string }
  | { kind: 'rect'; start: TilePos }
  | { kind: 'trigger'; start: TilePos }
  | { kind: 'move'; sel: Selection; grab: TilePos; key: string; moved: boolean; cycle: Selection | null }
  | { kind: 'resize'; index: number; key: string }
  | { kind: 'pan'; x: number; y: number; left: number; top: number };

let strokes = 0;

export function MapView({ id }: { id: string }) {
  const { content } = useStore();
  const area = content.areas[id];
  const ui = useMapUi();
  const canvas = useRef<HTMLCanvasElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const spaceDown = useRef(false);
  const zoomAnchor = useRef<{ gx: number; gy: number; sx: number; sy: number } | null>(null);
  const [hover, setHover] = useState<TilePos | null>(null);
  const [preview, setPreview] = useState<Rect | null>(null);
  const [artTick, setArtTick] = useState(0);
  const z = ui.zoom;
  const { w, h } = mapSize(area);

  useEffect(() => onArtLoaded(() => setArtTick((n) => n + 1)), []);
  useLayoutEffect(() => {
    if (canvas.current) drawMap(canvas.current, area, content);
  }, [area, content.npcs, artTick]);

  // Keep the point under the mouse in place when zooming with the wheel.
  useLayoutEffect(() => {
    const a = zoomAnchor.current;
    const vp = viewport.current;
    const st = stage.current;
    if (!a || !vp || !st) return;
    zoomAnchor.current = null;
    vp.scrollLeft = st.offsetLeft + a.gx * z - a.sx;
    vp.scrollTop = st.offsetTop + a.gy * z - a.sy;
  }, [z]);

  // Jump to a tile (from the problems list).
  useLayoutEffect(() => {
    const f = ui.focus;
    const vp = viewport.current;
    const st = stage.current;
    if (!f || !vp || !st) return;
    vp.scrollLeft = st.offsetLeft + (f.x + 0.5) * T * z - vp.clientWidth / 2;
    vp.scrollTop = st.offsetTop + (f.y + 0.5) * T * z - vp.clientHeight / 2;
    setUi({ focus: null });
  }, [ui.focus, id]);

  // Keyboard: tools, delete, nudge, zoom, space to pan.
  useEffect(() => {
    const keys: Record<string, Tool> = { v: 'select', b: 'brush', r: 'rect', g: 'fill', p: 'start', x: 'exit', n: 'npc', e: 'enemy', t: 'trigger', y: 'play' };
    const down = (e: KeyboardEvent) => {
      if (isTyping() || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      const sel = getUi().selection;
      if (k === ' ') {
        spaceDown.current = true;
        e.preventDefault();
      } else if (keys[k]) setUi({ tool: keys[k] });
      else if ((k === 'delete' || k === 'backspace') && sel) {
        editArea(id, (a) => removeThing(a, sel));
        select(null);
      } else if (k === 'escape') {
        gesture.current = null;
        setPreview(null);
        select(null);
      } else if (k.startsWith('arrow') && sel) {
        e.preventDefault();
        const d = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] }[k]!;
        editArea(id, (a) => {
          const r = thingRect(a, sel);
          if (r) moveThing(a, sel, r.x + d[0], r.y + d[1]);
        }, `nudge/${id}`);
      } else if (k === '+' || k === '=') zoomBy(1);
      else if (k === '-') zoomBy(-1);
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === ' ') spaceDown.current = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [id]);

  const zoomBy = (step: number, at?: { clientX: number; clientY: number }) => {
    const cur = getUi().zoom;
    const next = ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, ZOOMS.indexOf(cur) + step))];
    if (next === cur) return;
    const vp = viewport.current;
    const st = stage.current;
    if (vp && st) {
      const r = vp.getBoundingClientRect();
      const sx = at ? at.clientX - r.left : vp.clientWidth / 2;
      const sy = at ? at.clientY - r.top : vp.clientHeight / 2;
      zoomAnchor.current = { gx: (vp.scrollLeft + sx - st.offsetLeft) / cur, gy: (vp.scrollTop + sy - st.offsetTop) / cur, sx, sy };
    }
    setUi({ zoom: next });
  };

  const tileAt = (e: PointerEvent): TilePos => {
    const r = stage.current!.getBoundingClientRect();
    return { x: Math.floor((e.clientX - r.left) / (T * z)), y: Math.floor((e.clientY - r.top) / (T * z)) };
  };
  const inside = (p: TilePos) => p.x >= 0 && p.y >= 0 && p.x < w && p.y < h;

  const onDown = (e: PointerEvent) => {
    const vp = viewport.current!;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (e.button === 1 || (e.button === 0 && spaceDown.current)) {
      e.preventDefault();
      gesture.current = { kind: 'pan', x: e.clientX, y: e.clientY, left: vp.scrollLeft, top: vp.scrollTop };
      return;
    }
    const p = tileAt(e);
    if (!inside(p)) return;
    const tool = getUi().tool;
    const paints = tool === 'brush' || tool === 'rect' || tool === 'fill';
    // Right-click (or Alt-click) picks up the tile under the mouse.
    if (e.button === 2 || (e.button === 0 && e.altKey)) {
      if (paints || e.altKey) setUi({ tile: area.tiles[p.y][p.x], tool: paints ? tool : 'brush' });
      return;
    }
    if (e.button !== 0) return;
    const key = `stroke/${id}/${++strokes}`;
    switch (tool) {
      case 'select': {
        const handle = (e.target as Element).closest?.('[data-resize]');
        if (handle) {
          gesture.current = { kind: 'resize', index: Number(handle.getAttribute('data-resize')), key };
          return;
        }
        const hits = thingsAt(area, p.x, p.y);
        // Pressing on the selected thing keeps it (to drag it); a click without dragging then picks the next one
        // in the stack, to reach things underneath.
        const i = hits.findIndex((s) => sameSelection(s, getUi().selection));
        const sel = i >= 0 ? hits[i] : (hits[0] ?? null);
        select(sel);
        if (sel) {
          const r = thingRect(area, sel)!;
          const cycle = i >= 0 && hits.length > 1 ? hits[(i + 1) % hits.length] : null;
          gesture.current = { kind: 'move', sel, grab: { x: p.x - r.x, y: p.y - r.y }, key, moved: false, cycle };
        }
        return;
      }
      case 'brush':
        editArea(id, (a) => paintLine(a, p, p, getUi().tile), key);
        gesture.current = { kind: 'paint', last: p, key };
        return;
      case 'rect':
        gesture.current = { kind: 'rect', start: p };
        setPreview(rectBetween(p, p));
        return;
      case 'trigger':
        gesture.current = { kind: 'trigger', start: p };
        setPreview(rectBetween(p, p));
        return;
      case 'fill':
        editArea(id, (a) => floodFill(a, p.x, p.y, getUi().tile));
        return;
      case 'play':
        void playHere(id, p);
        return;
      default:
        place(tool, p);
    }
  };

  const place = (tool: Tool, p: TilePos) => {
    const same = thingsAt(area, p.x, p.y).find((s) => s.kind === tool);
    if (same) return select(same);
    let sel: Selection | null = null;
    editArea(id, (a, c) => {
      if (tool === 'start') {
        const name = 'default' in a.starts ? freshStartName(a) : 'default';
        a.starts[name] = { ...p };
        sel = { kind: 'start', name };
      } else if (tool === 'exit') {
        const other = Object.keys(c.areas).find((x) => x !== id) ?? id;
        const starts = Object.keys(c.areas[other].starts);
        a.exits.push({ ...p, to: other, at: starts.includes('default') ? 'default' : (starts[0] ?? 'default') });
        sel = { kind: 'exit', index: a.exits.length - 1 };
      } else if (tool === 'npc') {
        const npc = getUi().npc in c.npcs ? getUi().npc : Object.keys(c.npcs)[0];
        if (!npc) return;
        a.npcs.push({ id: npc, ...p });
        sel = { kind: 'npc', index: a.npcs.length - 1 };
      } else if (tool === 'enemy') {
        a.enemies.push({ type: getUi().enemy in ENEMIES ? getUi().enemy : 'wolf', ...p });
        sel = { kind: 'enemy', index: a.enemies.length - 1 };
      }
    });
    select(sel);
    // One start point or exit at a time; enemies and NPCs often come in numbers.
    if (tool === 'start' || tool === 'exit') setUi({ tool: 'select' });
  };

  const onMove = (e: PointerEvent) => {
    const g = gesture.current;
    const p = tileAt(e);
    setHover(inside(p) ? p : null);
    if (!g) return;
    if (g.kind === 'pan') {
      const vp = viewport.current!;
      vp.scrollLeft = g.left - (e.clientX - g.x);
      vp.scrollTop = g.top - (e.clientY - g.y);
      return;
    }
    const q = { x: Math.max(0, Math.min(w - 1, p.x)), y: Math.max(0, Math.min(h - 1, p.y)) };
    if (g.kind === 'paint') {
      if (q.x === g.last.x && q.y === g.last.y) return;
      editArea(id, (a) => paintLine(a, g.last, q, getUi().tile), g.key);
      g.last = q;
    } else if (g.kind === 'rect' || g.kind === 'trigger') {
      setPreview(rectBetween(g.start, q));
    } else if (g.kind === 'move') {
      const r = thingRect(area, g.sel);
      if (!r) return;
      const nx = Math.max(0, Math.min(w - r.w, p.x - g.grab.x));
      const ny = Math.max(0, Math.min(h - r.h, p.y - g.grab.y));
      if (nx !== r.x || ny !== r.y) {
        g.moved = true;
        editArea(id, (a) => moveThing(a, g.sel, nx, ny), g.key);
      }
    } else if (g.kind === 'resize') {
      const t = area.triggers[g.index];
      if (!t) return;
      const nw = Math.max(1, q.x - t.x + 1);
      const nh = Math.max(1, q.y - t.y + 1);
      if (nw !== t.w || nh !== t.h) editArea(id, (a) => Object.assign(a.triggers[g.index], { w: nw, h: nh }), g.key);
    }
  };

  const onUp = () => {
    const g = gesture.current;
    gesture.current = null;
    if (g?.kind === 'move' && !g.moved && g.cycle) select(g.cycle);
    if (!g || !preview) return;
    setPreview(null);
    if (g.kind === 'rect') editArea(id, (a) => fillRect(a, preview, getUi().tile));
    if (g.kind === 'trigger') {
      let index = 0;
      editArea(id, (a) => {
        a.triggers.push({ event: '', ...preview });
        index = a.triggers.length - 1;
      });
      select({ kind: 'trigger', index });
      setUi({ tool: 'select' });
    }
  };

  const cursor = gesture.current?.kind === 'pan' ? 'grabbing' : ui.tool === 'select' ? 'default' : 'crosshair';
  return (
    <div class="map-view">
      <div
        class="map-viewport"
        ref={viewport}
        onWheel={(e) => {
          if (!e.ctrlKey && !e.metaKey) return;
          e.preventDefault();
          zoomBy(e.deltaY < 0 ? 1 : -1, e);
        }}
      >
        <div
          class="map-stage"
          ref={stage}
          style={{ width: w * T * z, height: h * T * z, cursor }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onPointerLeave={() => setHover(null)}
          onContextMenu={(e) => e.preventDefault()}
        >
          <canvas class="pix" ref={canvas} width={w * T} height={h * T} style={{ width: w * T * z, height: h * T * z }} />
          {ui.grid && z >= 2 && <div class="map-grid" style={{ backgroundSize: `${T * z}px ${T * z}px` }} />}
          <Overlay id={id} area={area} content={content} zoom={z} hover={hover} preview={preview} />
        </div>
      </div>
      <StatusBar area={area} content={content} hover={hover} />
    </div>
  );
}

// ── drawing ──

function drawMap(canvas: HTMLCanvasElement, area: AreaFile, content: Content) {
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const ts = tileset();
  area.tiles.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const t = TILE_CHARS[row[x]] ?? 0;
      ctx.drawImage(ts.img, t * T, 0, T, T, x * T, y * T, T, T);
    }
  });

  // Sprites stand with their feet a little below the tile's centre, like in the game; lower ones in front.
  type Sprite = { y: number; draw: () => void };
  const sprites: Sprite[] = [];
  const feet = (pic: { img: CanvasImageSource; w: number; h: number }, p: TilePos, alpha = 1) => () => {
    ctx.globalAlpha = alpha;
    ctx.drawImage(pic.img, Math.round(p.x * T + T / 2 - pic.w / 2), p.y * T + T / 2 + 3 - pic.h);
    ctx.globalAlpha = 1;
  };
  for (const n of area.npcs) {
    const def = content.npcs[n.id];
    sprites.push({ y: n.y, draw: feet(npcPicture(n.id, def ? hex(def.color) : 0x777777), n) });
  }
  for (const e of area.enemies) {
    const pic = enemyPicture(e.type);
    sprites.push({ y: e.y, draw: pic ? feet(pic, e) : () => drawMissing(ctx, e) });
  }
  for (const [name, p] of Object.entries(area.starts)) {
    // The default start shows the party's leader, faded; other start points a flag.
    if (name === 'default') sprites.push({ y: p.y, draw: feet(characterPicture(LEADER.id, LEADER.color), p, 0.75) });
    else sprites.push({ y: p.y, draw: () => drawFlag(ctx, p) });
  }
  sprites.sort((a, b) => a.y - b.y).forEach((s) => s.draw());
}

function drawFlag(ctx: CanvasRenderingContext2D, p: TilePos) {
  const x = p.x * T + 6;
  const y = p.y * T + 2;
  ctx.fillStyle = '#0d0b14';
  ctx.fillRect(x - 1, y - 1, 3, 14);
  ctx.fillStyle = '#e6e0f2';
  ctx.fillRect(x, y, 1, 12);
  ctx.fillStyle = '#7cd67c';
  ctx.fillRect(x + 1, y, 6, 4);
}

function drawMissing(ctx: CanvasRenderingContext2D, p: TilePos) {
  ctx.fillStyle = '#e8705a';
  ctx.fillRect(p.x * T + 3, p.y * T + 3, T - 6, T - 6);
}

// ── overlay ──

function Overlay(props: { id: string; area: AreaFile; content: Content; zoom: number; hover: TilePos | null; preview: Rect | null }) {
  const { area, content, zoom: z } = props;
  const ui = useMapUi();
  const sel = ui.selection;
  const { w, h } = mapSize(area);
  const font = 11 / z;
  const label = (x: number, y: number, text: string, cls = '') =>
    ui.labels && (
      <text class={`lbl ${cls}`} x={x} y={y} font-size={font} stroke-width={3 / z}>
        {text}
      </text>
    );
  const box = (r: Rect, cls: string, pad = 0) => (
    <rect class={cls} x={r.x * T - pad} y={r.y * T - pad} width={r.w * T + pad * 2} height={r.h * T + pad * 2} />
  );
  const groups = groupsOf(area);
  const selGroup = sel?.kind === 'enemy' ? groups.find((g) => g.members.includes(sel.index)) : undefined;
  const selRect = sel ? thingRect(area, sel) : null;

  return (
    <svg class="map-overlay" viewBox={`0 0 ${w * T} ${h * T}`} width={w * T * z} height={h * T * z}>
      {area.triggers.map((t, i) => (
        <g key={`t${i}`} class="trigger">
          {box(t, `trigger-box ${t.event && content.story.events[t.event] ? '' : 'bad'}`)}
          {label(t.x * T + 2 / z, t.y * T + font, t.event || 'no event', 'gold')}
        </g>
      ))}
      {area.exits.map((e, i) => (
        <g key={`x${i}`}>
          {box({ x: e.x, y: e.y, w: 1, h: 1 }, `exit-box ${content.areas[e.to]?.starts[e.at] ? '' : 'bad'}`)}
          {label(e.x * T, e.y * T - 3 / z, `→ ${content.areas[e.to]?.name ?? e.to}`, 'blue')}
        </g>
      ))}
      {groups.map((g) => {
        const ms = g.members.map((i) => area.enemies[i]);
        const x0 = Math.min(...ms.map((m) => m.x));
        const y0 = Math.min(...ms.map((m) => m.y));
        const r = { x: x0, y: y0, w: Math.max(...ms.map((m) => m.x)) - x0 + 1, h: Math.max(...ms.map((m) => m.y)) - y0 + 1 };
        const set = area.encounters[g.id];
        const text = `${g.named ? g.id : `fight (${g.id})`}${set?.unique ? ' ★' : ''}${set?.onWin ? ` → ${set.onWin}` : ''}`;
        return (
          <g key={`g${g.id}${x0}`}>
            {box(r, `group-box ${g === selGroup ? 'active' : ''}`, 3)}
            {label(r.x * T - 3, r.y * T - 3 - 3 / z, text, 'red')}
          </g>
        );
      })}
      {selGroup?.members.map((i) => {
        const e = area.enemies[i];
        const def = ENEMIES[e.type as keyof typeof ENEMIES];
        return def && <circle key={`a${i}`} class="aggro" cx={e.x * T + T / 2} cy={e.y * T + T / 2} r={def.aggroRadius} />;
      })}
      {area.npcs.map((n, i) => (
        <g key={`n${i}`}>{label(n.x * T + T / 2, n.y * T + T + font * 0.9, content.npcs[n.id]?.name ?? `? ${n.id}`, 'center')}</g>
      ))}
      {Object.entries(area.starts).map(([name, p]) => (
        <g key={`s${name}`}>{label(p.x * T + T / 2, p.y * T - 3 / z, name === 'default' ? 'start (default)' : name, 'center green')}</g>
      ))}
      {selRect && box(selRect, 'selection', 1)}
      {sel?.kind === 'trigger' && selRect && (
        <rect class="resize-handle" data-resize={sel.index} x={(selRect.x + selRect.w) * T - 6 / z} y={(selRect.y + selRect.h) * T - 6 / z} width={9 / z} height={9 / z} />
      )}
      {props.preview && box(props.preview, ui.tool === 'trigger' ? 'trigger-box preview' : 'paint-preview')}
      {props.hover && !props.preview && box({ ...props.hover, w: 1, h: 1 }, 'hover-box')}
    </svg>
  );
}

// ── status bar ──

const HINTS: Record<Tool, string> = {
  select: 'Click a thing to select it, drag to move it. Arrow keys nudge, Delete removes. Click again to pick what’s underneath.',
  brush: 'Click and drag to paint. Right-click picks up a tile.',
  rect: 'Drag to fill a rectangle. Right-click picks up a tile.',
  fill: 'Click to fill a patch of the same tile. Right-click picks up a tile.',
  start: 'Click to add a start point (where the party arrives).',
  exit: 'Click to add an exit (stepping on it leads to another area).',
  npc: 'Click to place the NPC chosen on the right.',
  enemy: 'Click to place an enemy. Enemies within 4 tiles of each other are one fight.',
  trigger: 'Drag a rectangle for a story trigger: its event plays once, when the leader steps in it.',
  play: 'Click where the party should stand in the game tab (it plays the saved map).',
};

/** "Play from here": puts the party on that tile in the game tab, then goes back to selecting. */
async function playHere(id: string, p: TilePos) {
  setUi({ tool: 'select' });
  const unsaved = dirtyFiles().includes(`area:${id}`);
  const error = await gotoInGame(id, p.x, p.y);
  setBanner(
    error
      ? { kind: 'error', text: error }
      : { kind: 'info', text: `The party is at ${p.x}, ${p.y} in the game tab.${unsaved ? ' This map has unsaved changes: the game plays the saved version.' : ''}` },
  );
}

function StatusBar({ area, content, hover }: { area: AreaFile; content: Content; hover: TilePos | null }) {
  const ui = useMapUi();
  const { w, h } = mapSize(area);
  let here = '';
  if (hover) {
    const t = tileInfo(area.tiles[hover.y]?.[hover.x]);
    const things = thingsAt(area, hover.x, hover.y).map((s) => describe(area, content, s));
    here = `${hover.x}, ${hover.y} · ${t?.name ?? '?'}${t?.blocking ? ' (blocks)' : ''}${things.length ? ` · ${things.join(' · ')}` : ''}`;
  }
  return (
    <div class="map-status">
      <span class="mono">{here || `${w} × ${h} tiles`}</span>
      <span class="spacer" />
      <span class="muted">{HINTS[ui.tool]} Space+drag pans, Ctrl+wheel zooms.</span>
    </div>
  );
}

/** A short description of a thing on the map. */
export function describe(area: AreaFile, content: Content, s: Selection): string {
  if (s.kind === 'start') return `start point “${s.name}”`;
  if (s.kind === 'exit') {
    const e = area.exits[s.index];
    return `exit to ${content.areas[e.to]?.name ?? e.to}`;
  }
  if (s.kind === 'npc') {
    const n = area.npcs[s.index];
    return content.npcs[n.id]?.name ?? n.id;
  }
  if (s.kind === 'enemy') {
    const e = area.enemies[s.index];
    return ENEMIES[e.type as keyof typeof ENEMIES]?.name ?? e.type;
  }
  const t = area.triggers[s.index];
  return `trigger “${t.event || 'no event'}”`;
}

const isTyping = () => {
  const el = document.activeElement;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT');
};
