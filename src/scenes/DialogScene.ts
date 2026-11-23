import Phaser from 'phaser';
import { NPCS } from '../data/npcs';
import { PARTY } from '../data/party';
import { SPEAKERS } from '../data/story';
import { pixelCamera, sharpenText, textStyle, type ViewSize } from '../view';
import { HEADSHOT_SIZE } from '../world/placeholderArt';

const BOX_MAX_WIDTH = 460;
const PAD = 8;
const OPTION_H = 13;

type Page =
  | { kind: 'line'; speaker?: string; text: string; resolve: () => void }
  | { kind: 'choice'; speaker?: string; prompt: string; options: string[]; selected: number; resolve: (i: number) => void };

/**
 * The dialogue box at the bottom of the screen, driven by the event runner:
 * `say()` shows a line until the player clicks; `choose()` shows answers to pick from.
 * The world pauses while it's open (the runner handles that).
 */
export class DialogScene extends Phaser.Scene {
  private view!: ViewSize;
  private layer!: Phaser.GameObjects.Container;
  private page: Page | null = null;

  constructor() {
    super('Dialog');
  }

  create() {
    this.page = null;
    this.layer = this.add.container(0, 0);
    this.view = pixelCamera(this, true, (v) => {
      this.view = v;
      this.draw();
    });
    this.input.on('pointerdown', () => this.page?.kind === 'line' && this.finishLine());
    const kb = this.input.keyboard;
    kb?.on('keydown-SPACE', () => this.confirm());
    kb?.on('keydown-ENTER', () => this.confirm());
    kb?.on('keydown-UP', () => this.moveSelection(-1));
    kb?.on('keydown-DOWN', () => this.moveSelection(1));
    kb?.on('keydown', (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (this.page?.kind === 'choice' && n >= 1 && n <= this.page.options.length) this.pick(n - 1);
    });
  }

  /** Shows a line; resolves when the player clicks / presses Space or Enter. */
  say(speaker: string | undefined, text: string): Promise<void> {
    return new Promise((resolve) => {
      this.page = { kind: 'line', speaker, text, resolve };
      this.draw();
    });
  }

  /** Shows a prompt with answers; resolves with the index of the one picked. */
  choose(speaker: string | undefined, prompt: string, options: string[]): Promise<number> {
    return new Promise((resolve) => {
      this.page = { kind: 'choice', speaker, prompt, options, selected: 0, resolve };
      this.draw();
    });
  }

  private confirm() {
    if (this.page?.kind === 'line') this.finishLine();
    else if (this.page?.kind === 'choice') this.pick(this.page.selected);
  }

  private finishLine() {
    const page = this.page;
    if (page?.kind !== 'line') return;
    this.page = null;
    page.resolve();
  }

  private pick(i: number) {
    const page = this.page;
    if (page?.kind !== 'choice') return;
    this.page = null;
    page.resolve(i);
  }

  private moveSelection(step: number) {
    if (this.page?.kind !== 'choice') return;
    const n = this.page.options.length;
    this.page.selected = (this.page.selected + step + n) % n;
    this.draw();
  }

  private draw() {
    this.layer.removeAll(true);
    const page = this.page;
    if (!page || !this.view) return;
    const w = Math.min(this.view.width - 16, BOX_MAX_WIDTH);
    const x = Math.floor((this.view.width - w) / 2);
    const face = page.speaker ? headshotKey(this, page.speaker) : null;
    const textX = x + PAD + (face ? HEADSHOT_SIZE + 2 + 8 : 0);
    const textW = x + w - PAD - textX;
    const name = page.speaker ? speakerName(page.speaker) : null;
    const text = page.kind === 'line' ? page.text : page.prompt;

    const body = this.add.text(textX, 0, text, textStyle(10, name ? '#ffffff' : '#d8d0e8', { wordWrap: { width: textW } }));
    body.setLineSpacing(1);
    const optionsH = page.kind === 'choice' ? 4 + page.options.length * OPTION_H : 0;
    const hintH = page.kind === 'line' ? 10 : 0; // room for "click to continue"
    const contentH = (name ? 12 : 0) + body.height + optionsH + hintH;
    const h = Math.max(contentH, face ? HEADSHOT_SIZE + 2 : 0) + PAD * 2;
    const y = this.view.height - h - 40; // above the party portraits

    this.layer.add(this.add.rectangle(x - 1, y - 1, w + 2, h + 2, 0x4a4060).setOrigin(0));
    this.layer.add(this.add.rectangle(x, y, w, h, 0x1e1a2b, 0.96).setOrigin(0));
    if (face) {
      this.layer.add(this.add.rectangle(x + PAD, y + PAD, HEADSHOT_SIZE + 2, HEADSHOT_SIZE + 2, 0x4a4060).setOrigin(0));
      this.layer.add(this.add.image(x + PAD + 1, y + PAD + 1, face).setOrigin(0).setDisplaySize(HEADSHOT_SIZE, HEADSHOT_SIZE));
    }
    let cy = y + PAD - 2;
    if (name) {
      this.layer.add(this.add.text(textX, cy, name, textStyle(10, '#f2d16b')));
      cy += 12;
    }
    body.setY(cy);
    this.layer.add(body);
    cy += body.height + 4;

    if (page.kind === 'choice') {
      page.options.forEach((label, i) => {
        const active = i === page.selected;
        const bg = this.add.rectangle(textX - 3, cy + i * OPTION_H, textW + 3, OPTION_H, active ? 0x3a3350 : 0x1e1a2b).setOrigin(0);
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerover', () => {
          if (page.selected !== i) {
            page.selected = i;
            this.draw();
          }
        });
        bg.on('pointerdown', () => this.pick(i));
        const t = this.add
          .text(textX, cy + i * OPTION_H + OPTION_H / 2, `${i + 1}. ${label}`, textStyle(10, active ? '#f2d16b' : '#d8d0e8'))
          .setOrigin(0, 0.5);
        this.layer.add([bg, t]);
      });
    } else {
      this.layer.add(this.add.text(x + w - PAD, y + h - 4, 'click to continue', textStyle(10, '#8a82a0')).setOrigin(1, 1));
    }
    sharpenText(this, this.view.zoom);
  }
}

/** The headshot texture for a speaker, falling back to their small portrait. */
function headshotKey(scene: Phaser.Scene, speaker: string): string | null {
  for (const key of [`headshot-${speaker}`, `portrait-${speaker}`]) if (scene.textures.exists(key)) return key;
  return null;
}

function speakerName(id: string) {
  return PARTY.find((c) => c.id === id)?.name ?? NPCS[id]?.name ?? SPEAKERS[id]?.name ?? id;
}
