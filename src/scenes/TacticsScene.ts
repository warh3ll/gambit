import Phaser from 'phaser';
import { MAX_TACTIC_ROWS } from '../config';
import {
  ACTIONS,
  type ActionId,
  type TargetGroup,
  TARGETS,
  type TargetId,
  TYPES,
  type TypeId,
} from '../data/tactics';
import { saveTactics } from '../game/tacticsStore';
import { pixelCamera, sharpenText, textStyle, type ViewSize } from '../view';
import type { Party } from '../world/Party';
import type { PartyMember } from '../world/PartyMember';

const C = {
  dim: 0x0d0b14,
  panel: 0x1e1a2b,
  border: 0x4a4060,
  cell: 0x2a2438,
  cellHover: 0x3a3350,
  tab: 0x2a2438,
  tabActive: 0x3a3350,
  gold: 0xf2d16b,
  text: '#ffffff',
  muted: '#8a82a0',
  heading: '#f2d16b',
};

/** Keep track of the last tab between openings. */
let lastMemberId: string | null = null;

type Column = 'action' | 'target' | 'type';

interface Layout {
  px: number;
  py: number;
  pw: number;
  ph: number;
  rowsTop: number;
  rowH: number;
  cols: { handle: number; num: number; toggle: number; action: number; target: number; type: number; del: number };
  widths: { action: number; target: number; type: number };
}

/**
 * The tactics editor (opened with T). Pauses the game while open.
 * One character at a time: click a cell to pick from a list, drag ≡ to reorder,
 * the box switches a row on/off, × removes it. Changes apply immediately and are saved in the browser.
 */
export class TacticsScene extends Phaser.Scene {
  private party!: Party;
  private member!: PartyMember;
  private view!: ViewSize;
  private layout!: Layout;
  /** Everything in the panel; rebuilt from scratch whenever something changes. */
  private layer!: Phaser.GameObjects.Container;
  private dropdown: Phaser.GameObjects.Container | null = null;
  private dirty = false;
  private drag: { from: number; ghost: Phaser.GameObjects.Container; marker: Phaser.GameObjects.Rectangle } | null =
    null;

  constructor() {
    super('Tactics');
  }

  init(data: { party: Party }) {
    this.party = data.party;
    const remembered = this.party.members.find((m) => m.id === lastMemberId);
    this.member = remembered ?? this.party.leader;
    this.dropdown = null;
    this.drag = null;
    this.dirty = false;
  }

  create() {
    this.layer = this.add.container(0, 0);
    this.view = pixelCamera(this, true, (v) => {
      this.view = v;
      this.rebuild();
    });

    const kb = this.input.keyboard;
    kb?.on('keydown-T', () => this.close());
    kb?.on('keydown-ESC', () => (this.dropdown ? this.closeDropdown() : this.close()));
    kb?.on('keydown-LEFT', () => this.switchMember(-1));
    kb?.on('keydown-RIGHT', () => this.switchMember(1));
    ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE'].forEach((k, i) =>
      kb?.on(`keydown-${k}`, () => this.selectMember(this.party.members[i])),
    );

    // Clicking anywhere that isn't a cell or list item closes an open list.
    this.input.on('pointerdown', (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (this.dropdown && !over.some((o) => o.getData('keep'))) this.closeDropdown();
    });
    this.input.on('dragstart', (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject) => this.onDragStart(obj));
    this.input.on('drag', (p: Phaser.Input.Pointer) => this.onDrag(p));
    this.input.on('dragend', () => this.onDragEnd());
  }

  private close() {
    lastMemberId = this.member.id;
    for (const m of this.party.members) m.thinkTimer = 0; // re-read the edited tactics right away
    this.scene.resume('World');
    this.scene.resume('UI');
    this.scene.stop();
  }

  private switchMember(step: number) {
    const list = this.party.members;
    const i = list.indexOf(this.member);
    this.selectMember(list[(i + step + list.length) % list.length]);
  }

  private selectMember(m: PartyMember | undefined) {
    if (!m || m === this.member) return;
    this.member = m;
    lastMemberId = m.id;
    this.closeDropdown();
    this.dirty = true;
  }

  // ── building the panel ──

  private computeLayout(): Layout {
    const pw = Math.min(this.view.width - 16, 520);
    const ph = Math.min(this.view.height - 16, 340);
    const px = Math.floor((this.view.width - pw) / 2);
    const py = Math.floor((this.view.height - ph) / 2);
    const rowsTop = py + 84;
    const rowH = Math.max(15, Math.min(22, Math.floor((py + ph - 22 - rowsTop) / MAX_TACTIC_ROWS)));
    const fixed = 12 + 16 + 14 + 14 + 16; // handle, number, toggle, delete, padding
    const free = pw - fixed - 4 * 3;
    const widths = {
      action: Math.floor(free * 0.3),
      target: Math.floor(free * 0.25),
      type: free - Math.floor(free * 0.3) - Math.floor(free * 0.25),
    };
    const handle = px + 8;
    const num = handle + 12;
    const toggle = num + 16;
    const action = toggle + 14 + 3;
    const target = action + widths.action + 3;
    const type = target + widths.target + 3;
    const del = type + widths.type + 3;
    return { px, py, pw, ph, rowsTop, rowH, cols: { handle, num, toggle, action, target, type, del }, widths };
  }

  private rebuild() {
    this.layer.removeAll(true);
    this.layout = this.computeLayout();
    const L = this.layout;
    const add = <T extends Phaser.GameObjects.GameObject>(o: T) => {
      this.layer.add(o);
      return o;
    };

    // Dim the game behind, then the panel.
    add(this.add.rectangle(0, 0, this.view.width, this.view.height, C.dim, 0.6).setOrigin(0).setInteractive());
    add(this.add.rectangle(L.px - 1, L.py - 1, L.pw + 2, L.ph + 2, C.border).setOrigin(0));
    add(this.add.rectangle(L.px, L.py, L.pw, L.ph, C.panel).setOrigin(0));

    add(this.add.text(L.px + 8, L.py + 7, 'TACTICS', textStyle(20, C.heading, {})));
    add(this.add.text(L.px + 72, L.py + 10, 'Game paused', textStyle(10, C.muted)));
    const close = add(this.add.text(L.px + L.pw - 8, L.py + 7, 'Close [T]', textStyle(10, C.text)).setOrigin(1, 0));
    close.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.close());
    const reset = add(
      this.add.text(close.x - close.width - 14, L.py + 7, 'Reset to defaults', textStyle(10, C.muted)).setOrigin(1, 0),
    );
    reset.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.resetToDefaults());
    reset.on('pointerover', () => reset.setColor(C.text)).on('pointerout', () => reset.setColor(C.muted));

    this.buildTabs(add);
    this.buildInfo(add);
    this.buildRows(add);

    add(
      this.add.text(
        L.px + 8,
        L.py + L.ph - 13,
        'Rows run top to bottom: the first one that can fire is used.   Drag the dots to reorder  ·  box = on/off  ·  x = remove',
        textStyle(10, C.muted),
      ),
    );
    sharpenText(this, this.view.zoom);
  }

  private buildTabs(add: <T extends Phaser.GameObjects.GameObject>(o: T) => T) {
    const L = this.layout;
    const members = this.party.members;
    const tabW = Math.floor((L.pw - 16 - 4 * (members.length - 1)) / members.length);
    members.forEach((m, i) => {
      const x = L.px + 8 + i * (tabW + 4);
      const y = L.py + 26;
      const active = m === this.member;
      const bg = add(this.add.rectangle(x, y, tabW, 20, active ? C.tabActive : C.tab).setOrigin(0));
      if (active) add(this.add.rectangle(x, y + 18, tabW, 2, C.gold).setOrigin(0));
      add(this.add.image(x + 3, y + 2, `portrait-${m.def.id}`).setOrigin(0).setScale(16 / 18));
      add(this.add.text(x + 23, y + 10, `${i + 1}  ${m.def.name}`, textStyle(10, active ? C.text : C.muted)).setOrigin(0, 0.5));
      bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.selectMember(m));
    });
  }

  private buildInfo(add: <T extends Phaser.GameObjects.GameObject>(o: T) => T) {
    const L = this.layout;
    const m = this.member;
    const known = m.def.actions.map((a) => ACTIONS[a].label).join(', ');
    const line = `${m.def.className} (${m.def.role})   HP ${m.hp}/${m.maxHp}   Weapon: ${m.weapon.label}   Knows: ${known}`;
    add(this.add.text(L.px + 8, L.py + 52, line, textStyle(10, C.text)));

    const y = L.rowsTop - 12;
    add(this.add.text(L.cols.num, y, '#', textStyle(10, C.muted)));
    add(this.add.text(L.cols.toggle, y, 'On', textStyle(10, C.muted)));
    add(this.add.text(L.cols.action, y, 'ACTION', textStyle(10, C.muted)));
    add(this.add.text(L.cols.target, y, 'TARGET', textStyle(10, C.muted)));
    add(this.add.text(L.cols.type, y, 'TYPE', textStyle(10, C.muted)));
  }

  private buildRows(add: <T extends Phaser.GameObjects.GameObject>(o: T) => T) {
    const L = this.layout;
    const rows = this.member.tactics;
    const h = L.rowH - 3;

    for (let i = 0; i < MAX_TACTIC_ROWS; i++) {
      const y = L.rowsTop + i * L.rowH;
      const r = rows[i];
      add(this.add.text(L.cols.num + 2, y + h / 2, `${i + 1}`, textStyle(10, C.muted)).setOrigin(0, 0.5));

      if (!r) {
        if (i === rows.length) {
          // First free slot: add a new row.
          const w = L.widths.action + L.widths.target + L.widths.type + 6;
          this.cell(add, L.cols.action, y, w, h, '+ Add tactic', C.muted, (bg) => this.openActionList(bg, i));
        } else {
          add(this.add.rectangle(L.cols.action, y, L.widths.action + L.widths.target + L.widths.type + 6, h, C.cell, 0.35).setOrigin(0));
        }
        continue;
      }

      const textColor = r.enabled ? C.text : C.muted;

      // Drag handle: six dots.
      const handle = add(this.add.rectangle(L.cols.handle, y, 10, h, C.panel, 0.001).setOrigin(0));
      handle.setInteractive({ useHandCursor: true, draggable: true }).setData('row', i).setData('keep', true);
      for (let d = 0; d < 6; d++) {
        add(this.add.rectangle(L.cols.handle + 2 + (d % 2) * 4, y + h / 2 - 4 + Math.floor(d / 2) * 4, 2, 2, 0x8a82a0).setOrigin(0));
      }

      // On/off box.
      const box = add(this.add.rectangle(L.cols.toggle, y + h / 2 - 5, 10, 10, C.border).setOrigin(0));
      add(this.add.rectangle(L.cols.toggle + 1, y + h / 2 - 4, 8, 8, C.cell).setOrigin(0));
      if (r.enabled) add(this.add.rectangle(L.cols.toggle + 2, y + h / 2 - 3, 6, 6, C.gold).setOrigin(0));
      box.setInteractive({ useHandCursor: true }).setData('keep', true).on('pointerdown', () => {
        r.enabled = !r.enabled;
        this.changed();
      });

      this.cell(add, L.cols.action, y, L.widths.action, h, ACTIONS[r.action].label, textColor, (bg) =>
        this.openActionList(bg, i),
      );
      this.cell(add, L.cols.target, y, L.widths.target, h, TARGETS[r.target].label, textColor, (bg) =>
        this.openList(bg, 'target', i),
      );
      this.cell(add, L.cols.type, y, L.widths.type, h, TYPES[r.type].label, textColor, (bg) => this.openList(bg, 'type', i));

      const del = add(this.add.text(L.cols.del + 3, y + h / 2, 'x', textStyle(10, C.muted)).setOrigin(0, 0.5));
      del.setInteractive({ useHandCursor: true }).setData('keep', true).on('pointerdown', () => {
        rows.splice(i, 1);
        this.changed();
      });
    }
  }

  /** A clickable cell with a (shortened if needed) label. */
  private cell(
    add: <T extends Phaser.GameObjects.GameObject>(o: T) => T,
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    color: string,
    onClick: (bg: Phaser.GameObjects.Rectangle) => void,
  ) {
    const bg = add(this.add.rectangle(x, y, w, h, C.cell).setOrigin(0));
    const t = add(this.add.text(x + 4, y + h / 2, label, textStyle(10, color)).setOrigin(0, 0.5));
    fitText(t, w - 8);
    bg.setInteractive({ useHandCursor: true }).setData('keep', true);
    bg.on('pointerover', () => bg.setFillStyle(C.cellHover));
    bg.on('pointerout', () => bg.setFillStyle(C.cell));
    bg.on('pointerdown', () => onClick(bg));
  }

  // ── dropdown lists ──

  private openActionList(anchor: Phaser.GameObjects.Rectangle, rowIndex: number) {
    const options = this.member.def.actions.map((id) => ({ id, label: ACTIONS[id].label, hint: ACTIONS[id].description }));
    const current = this.member.tactics[rowIndex]?.action;
    this.showList(anchor, options, current, (id) => this.setAction(rowIndex, id as ActionId));
  }

  private openList(anchor: Phaser.GameObjects.Rectangle, column: Exclude<Column, 'action'>, rowIndex: number) {
    const r = this.member.tactics[rowIndex];
    if (column === 'target') {
      const groups = ACTIONS[r.action].groups as readonly TargetGroup[];
      const options = Object.values(TARGETS)
        .filter((t) => groups.includes(t.group))
        .map((t) => ({ id: t.id, label: t.label }));
      this.showList(anchor, options, r.target, (id) => {
        r.target = id as TargetId;
        r.type = validType(r.target, r.type);
        this.changed();
      });
    } else {
      const group = TARGETS[r.target].group;
      const options = Object.values(TYPES)
        .filter((t) => (t.groups as readonly TargetGroup[]).includes(group))
        .map((t) => ({ id: t.id, label: t.label }));
      this.showList(anchor, options, r.type, (id) => {
        r.type = id as TypeId;
        this.changed();
      });
    }
  }

  private setAction(rowIndex: number, action: ActionId) {
    const rows = this.member.tactics;
    const r = rows[rowIndex];
    if (!r) {
      const target = validTarget(action, 'enemy');
      rows.push({ action, target, type: 'any', enabled: true });
    } else {
      r.action = action;
      r.target = validTarget(action, r.target);
      r.type = validType(r.target, r.type);
    }
    this.changed();
  }

  private showList(
    anchor: Phaser.GameObjects.Rectangle,
    options: { id: string; label: string; hint?: string }[],
    current: string | undefined,
    onPick: (id: string) => void,
  ) {
    this.closeDropdown();
    const itemH = 13;
    const w = Math.max(anchor.width, 100);
    const h = options.length * itemH + 4;
    let x = anchor.x;
    let y = anchor.y + anchor.height + 1;
    if (y + h > this.view.height - 4) y = anchor.y - h - 1; // open upwards near the bottom
    x = Math.min(x, this.view.width - w - 4);

    const list = this.add.container(0, 0).setDepth(100);
    list.add(this.add.rectangle(x - 1, y - 1, w + 2, h + 2, C.gold).setOrigin(0));
    list.add(this.add.rectangle(x, y, w, h, C.panel).setOrigin(0).setInteractive().setData('keep', true));
    options.forEach((o, i) => {
      const iy = y + 2 + i * itemH;
      const bg = this.add.rectangle(x + 1, iy, w - 2, itemH, o.id === current ? C.tabActive : C.panel).setOrigin(0);
      bg.setInteractive({ useHandCursor: true }).setData('keep', true);
      bg.on('pointerover', () => bg.setFillStyle(C.cellHover));
      bg.on('pointerout', () => bg.setFillStyle(o.id === current ? C.tabActive : C.panel));
      bg.on('pointerdown', () => {
        this.closeDropdown();
        onPick(o.id);
      });
      const t = this.add.text(x + 5, iy + itemH / 2, o.label, textStyle(10, o.id === current ? '#f2d16b' : C.text)).setOrigin(0, 0.5);
      fitText(t, w - 10);
      list.add([bg, t]);
    });
    this.dropdown = list;
    sharpenText(this, this.view.zoom);
  }

  private closeDropdown() {
    this.dropdown?.destroy();
    this.dropdown = null;
  }

  // ── drag to reorder ──

  private onDragStart(obj: Phaser.GameObjects.GameObject) {
    const from = obj.getData('row') as number | undefined;
    if (from === undefined) return;
    this.closeDropdown();
    const L = this.layout;
    const r = this.member.tactics[from];
    const ghost = this.add.container(0, L.rowsTop + from * L.rowH).setDepth(50);
    const w = L.cols.del - L.cols.handle + 10;
    ghost.add(this.add.rectangle(L.cols.handle, 0, w, L.rowH - 3, C.cellHover, 0.9).setOrigin(0));
    ghost.add(
      this.add
        .text(L.cols.action + 4, (L.rowH - 3) / 2, `${ACTIONS[r.action].label}  |  ${TARGETS[r.target].label}  |  ${TYPES[r.type].label}`, textStyle(10))
        .setOrigin(0, 0.5),
    );
    const marker = this.add.rectangle(L.cols.handle, 0, w, 2, C.gold).setOrigin(0, 0.5).setDepth(51);
    this.drag = { from, ghost, marker };
    sharpenText(this, this.view.zoom);
    this.positionMarker(from);
  }

  private onDrag(p: Phaser.Input.Pointer) {
    if (!this.drag) return;
    const L = this.layout;
    const world = p.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
    this.drag.ghost.setY(Math.round(world.y - (L.rowH - 3) / 2));
    this.positionMarker(this.dropIndex(world.y));
  }

  private onDragEnd() {
    if (!this.drag) return;
    const { from, ghost, marker } = this.drag;
    const to = this.dropIndex(ghost.y + (this.layout.rowH - 3) / 2);
    ghost.destroy();
    marker.destroy();
    this.drag = null;
    if (to !== from) {
      const rows = this.member.tactics;
      const [moved] = rows.splice(from, 1);
      rows.splice(to, 0, moved);
    }
    this.changed();
  }

  /** Which row slot a y position falls on, clamped to the filled rows. */
  private dropIndex(y: number) {
    const L = this.layout;
    const i = Math.floor((y - L.rowsTop) / L.rowH);
    return Phaser.Math.Clamp(i, 0, this.member.tactics.length - 1);
  }

  /** Gold line where the dragged row will land (above or below the hovered slot). */
  private positionMarker(to: number) {
    if (!this.drag) return;
    const L = this.layout;
    const below = to > this.drag.from;
    this.drag.marker.setY(L.rowsTop + (below ? to + 1 : to) * L.rowH - 2);
  }

  /** Puts this character's rows back to their starting tactics. */
  private resetToDefaults() {
    this.closeDropdown();
    this.member.tactics = this.member.def.tactics.map((r) => ({ ...r }));
    this.changed();
  }

  /** Something was edited: save, and rebuild on the next frame (not inside the click handler that caused it). */
  private changed() {
    this.member.thinkTimer = 0;
    saveTactics(this.party.members);
    this.dirty = true;
  }

  update() {
    if (!this.dirty) return;
    this.dirty = false;
    this.rebuild();
  }
}

/** First target the action allows, keeping `preferred` if it's valid. */
function validTarget(action: ActionId, preferred: TargetId): TargetId {
  const groups = ACTIONS[action].groups as readonly TargetGroup[];
  if (groups.includes(TARGETS[preferred].group)) return preferred;
  const order: TargetId[] = ['enemy', 'ally', 'otherAlly', 'self'];
  return order.find((t) => groups.includes(TARGETS[t].group)) ?? preferred;
}

/** Keeps `type` if it works with the target's group, otherwise falls back to "Any". */
function validType(target: TargetId, type: TypeId): TypeId {
  const group = TARGETS[target].group;
  return (TYPES[type].groups as readonly TargetGroup[]).includes(group) ? type : 'any';
}

/** Shortens a text object with "…" until it fits `maxWidth`. */
function fitText(t: Phaser.GameObjects.Text, maxWidth: number) {
  if (t.width <= maxWidth) return;
  let s = t.text;
  while (s.length > 1 && t.width > maxWidth) {
    s = s.slice(0, -1);
    t.setText(`${s.trimEnd()}…`);
  }
}

