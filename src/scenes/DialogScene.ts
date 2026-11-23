import Phaser from 'phaser';
import { NPCS } from '../data/npcs';
import { PARTY } from '../data/party';
import { type Line, SPEAKER_NAMES } from '../data/story';
import { pixelCamera, sharpenText, textStyle, type ViewSize } from '../view';
import { PORTRAIT_SIZE } from './BootScene';

export interface DialogData {
  lines: Line[];
  /** Called after the last line, once the world has resumed. */
  onDone?: () => void;
}

const BOX_MAX_WIDTH = 440;
const PAD = 8;

/**
 * Story text box at the bottom of the screen. The world and HUD pause while it's open.
 * Click, Space or Enter shows the next line.
 */
export class DialogScene extends Phaser.Scene {
  private lines: Line[] = [];
  private index = 0;
  private onDone?: () => void;
  private view!: ViewSize;
  private layer!: Phaser.GameObjects.Container;

  constructor() {
    super('Dialog');
  }

  init(data: DialogData) {
    this.lines = data.lines;
    this.onDone = data.onDone;
    this.index = 0;
  }

  create() {
    this.layer = this.add.container(0, 0);
    this.view = pixelCamera(this, true, (v) => {
      this.view = v;
      this.draw();
    });
    this.input.on('pointerdown', () => this.next());
    this.input.keyboard?.on('keydown-SPACE', () => this.next());
    this.input.keyboard?.on('keydown-ENTER', () => this.next());
    this.draw();
  }

  private next() {
    this.index++;
    if (this.index < this.lines.length) {
      this.draw();
      return;
    }
    this.scene.resume('World');
    this.scene.resume('UI');
    this.scene.stop();
    this.onDone?.();
  }

  private draw() {
    this.layer.removeAll(true);
    const line = this.lines[this.index];
    if (!line) return;
    const w = Math.min(this.view.width - 16, BOX_MAX_WIDTH);
    const x = Math.floor((this.view.width - w) / 2);
    const portrait = line.speaker ? `portrait-${line.speaker}` : null;
    const face = portrait && this.textures.exists(portrait) ? portrait : null;
    const textX = x + PAD + (face ? PORTRAIT_SIZE + 6 : 0);
    const textW = x + w - PAD - textX;

    const name = line.speaker ? speakerName(line.speaker) : null;
    const body = this.add.text(textX, 0, line.text, textStyle(10, name ? '#ffffff' : '#d8d0e8', { wordWrap: { width: textW } }));
    body.setLineSpacing(1);
    const textH = (name ? 12 : 0) + body.height;
    const h = Math.max(textH, face ? PORTRAIT_SIZE : 0) + PAD * 2 + 8;
    const y = this.view.height - h - 40; // above the party portraits

    this.layer.add(this.add.rectangle(x - 1, y - 1, w + 2, h + 2, 0x4a4060).setOrigin(0));
    this.layer.add(this.add.rectangle(x, y, w, h, 0x1e1a2b, 0.96).setOrigin(0));
    if (face) {
      this.layer.add(this.add.image(x + PAD, y + PAD, 'frame').setOrigin(0));
      this.layer.add(this.add.image(x + PAD + 2, y + PAD + 2, face).setOrigin(0));
    }
    if (name) this.layer.add(this.add.text(textX, y + PAD - 2, name, textStyle(10, '#f2d16b')));
    body.setY(y + PAD - 2 + (name ? 12 : 0));
    this.layer.add(body);
    const more = this.index < this.lines.length - 1 ? 'click to continue' : 'click to close';
    this.layer.add(this.add.text(x + w - PAD, y + h - 4, more, textStyle(10, '#8a82a0')).setOrigin(1, 1));
    sharpenText(this, this.view.zoom);
  }
}

function speakerName(id: string) {
  return PARTY.find((c) => c.id === id)?.name ?? NPCS[id]?.name ?? SPEAKER_NAMES[id] ?? id;
}
