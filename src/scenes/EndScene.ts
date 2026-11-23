import Phaser from 'phaser';
import { END_SCREEN } from '../data/story';
import { pixelCamera, sharpenText, textStyle, type ViewSize } from '../view';

/** Shown when the slice is finished. "Play again" restarts the game (saved tactics are kept). */
export class EndScene extends Phaser.Scene {
  private layer!: Phaser.GameObjects.Container;

  constructor() {
    super('End');
  }

  create() {
    this.layer = this.add.container(0, 0);
    this.cameras.main.fadeIn(800, 13, 11, 20);
    pixelCamera(this, true, (v) => this.draw(v));
  }

  private draw(view: ViewSize) {
    this.layer.removeAll(true);
    const cx = Math.round(view.width / 2);
    const cy = Math.round(view.height / 2);
    this.layer.add(this.add.rectangle(0, 0, view.width, view.height, 0x0d0b14).setOrigin(0).setInteractive());
    this.layer.add(this.add.text(cx, cy - 30, END_SCREEN.title, textStyle(20, '#f2d16b')).setOrigin(0.5));
    this.layer.add(
      this.add
        .text(cx, cy - 4, END_SCREEN.text, textStyle(10, '#d8d0e8', { align: 'center', wordWrap: { width: Math.min(view.width - 32, 300) } }))
        .setOrigin(0.5, 0),
    );
    const again = this.add.text(cx, cy + 34, '[ Play again ]', textStyle(10, '#ffffff')).setOrigin(0.5);
    again.setInteractive({ useHandCursor: true }).on('pointerdown', () => window.location.reload());
    again.on('pointerover', () => again.setColor('#f2d16b')).on('pointerout', () => again.setColor('#ffffff'));
    this.layer.add(again);
    sharpenText(this, view.zoom);
  }
}
