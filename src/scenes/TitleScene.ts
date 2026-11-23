import Phaser from 'phaser';
import { hasSave, loadSave, type SaveData, startNewGame } from '../game/save';
import { session } from '../game/session';
import { pixelCamera, sharpenText, textStyle, type ViewSize } from '../view';

interface MenuItem {
  label: string;
  action: () => void;
}

/**
 * Title screen: Continue (if there's a save) and New game.
 * Starting over asks for confirmation first, since there's only one save.
 */
export class TitleScene extends Phaser.Scene {
  private layer!: Phaser.GameObjects.Container;
  private view!: ViewSize;
  private save: SaveData | null = null;
  private confirming = false;
  private selected = 0;

  constructor() {
    super('Title');
  }

  create() {
    this.save = hasSave() ? loadSave() : null;
    this.confirming = false;
    this.selected = 0;
    this.layer = this.add.container(0, 0);
    this.view = pixelCamera(this, true, (v) => {
      this.view = v;
      this.draw();
    });
    const kb = this.input.keyboard;
    kb?.on('keydown-UP', () => this.move(-1));
    kb?.on('keydown-DOWN', () => this.move(1));
    kb?.on('keydown-ENTER', () => this.items()[this.selected]?.action());
    kb?.on('keydown-SPACE', () => this.items()[this.selected]?.action());
    kb?.on('keydown-ESC', () => this.confirming && this.setConfirming(false));
    this.draw();
  }

  private items(): MenuItem[] {
    if (this.confirming) {
      return [
        { label: 'No, go back', action: () => this.setConfirming(false) },
        { label: 'Yes, start over', action: () => this.start(startNewGame()) },
      ];
    }
    const items: MenuItem[] = [];
    if (this.save) items.push({ label: 'Continue', action: () => this.start(this.save!) });
    items.push({ label: 'New game', action: () => (this.save ? this.setConfirming(true) : this.start(startNewGame())) });
    return items;
  }

  private setConfirming(on: boolean) {
    this.confirming = on;
    this.selected = 0;
    this.draw();
  }

  private move(step: number) {
    const n = this.items().length;
    this.selected = (this.selected + step + n) % n;
    this.draw();
  }

  private start(data: SaveData) {
    session.data = data;
    this.scene.start('World');
  }

  private draw() {
    this.layer.removeAll(true);
    const v = this.view;
    const cx = Math.round(v.width / 2);
    const cy = Math.round(v.height / 2);
    this.layer.add(this.add.rectangle(0, 0, v.width, v.height, 0x0d0b14).setOrigin(0));
    this.layer.add(this.add.text(cx, cy - 60, 'GAMBIT', textStyle(20, '#f2d16b')).setOrigin(0.5));
    this.layer.add(this.add.text(cx, cy - 42, 'You don\'t fight. You give orders.', textStyle(10, '#8a82a0')).setOrigin(0.5));

    let y = cy - 8;
    if (this.confirming) {
      this.layer.add(
        this.add.text(cx, y, 'Start over? Your saved game will be erased.', textStyle(10, '#ff9a8a')).setOrigin(0.5),
      );
      y += 20;
    } else if (this.save?.savedAt) {
      this.layer.add(this.add.text(cx, cy + 60, `Last saved ${formatTime(this.save.savedAt)}`, textStyle(10, '#5a5270')).setOrigin(0.5));
    }

    this.items().forEach((item, i) => {
      const active = i === this.selected;
      const t = this.add
        .text(cx, y + i * 16, active ? `> ${item.label} <` : item.label, textStyle(10, active ? '#ffffff' : '#b8b0c8'))
        .setOrigin(0.5);
      t.setInteractive({ useHandCursor: true });
      t.on('pointerover', () => {
        if (this.selected !== i) {
          this.selected = i;
          this.draw();
        }
      });
      t.on('pointerdown', () => item.action());
      this.layer.add(t);
    });
    sharpenText(this, v.zoom);
  }
}

function formatTime(ms: number) {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
