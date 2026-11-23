import Phaser from 'phaser';
import { textStyle } from '../view';
import type { Unit } from '../world/Unit';

/** Colours for floating combat text. */
export const COMBAT_TEXT_COLORS = {
  damage: '#ffffff',
  heal: '#6bd96b',
  buff: '#f2d16b',
  debuff: '#c58cff',
} as const;

type Kind = keyof typeof COMBAT_TEXT_COLORS;

/** Pops landing within this many ms on the same unit stack upwards instead of overlapping. */
const STACK_WINDOW = 350;
const STACK_STEP = 10;
/** Stacked pops also shift sideways a little so they read as separate hits. */
const STACK_SHIFT = [0, -5, 5, 0];
const STACK_MAX = 3;
const RISE = 14;
const DURATION = 900;

/**
 * Floating text over units: damage (white), heals (green),
 * buff names over allies (gold), debuff names over enemies (purple).
 */
export class CombatText {
  private readonly scene: Phaser.Scene;
  private readonly stacks = new WeakMap<Unit, { time: number; level: number }>();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  damage(unit: Unit, amount: number) {
    this.show(unit, `${amount}`, 'damage');
  }

  heal(unit: Unit, amount: number) {
    if (amount > 0) this.show(unit, `+${amount}`, 'heal');
  }

  /** An ability name over the unit that received a buff or debuff. */
  status(unit: Unit, label: string, kind: 'buff' | 'debuff') {
    this.show(unit, label, kind);
  }

  private show(unit: Unit, text: string, kind: Kind) {
    const now = this.scene.time.now;
    const prev = this.stacks.get(unit);
    const level = prev && now - prev.time < STACK_WINDOW ? (prev.level + 1) % (STACK_MAX + 1) : 0;
    this.stacks.set(unit, { time: now, level });

    const x = Math.round(unit.x) + STACK_SHIFT[level];
    const y = Math.round(unit.y - unit.sprite.height - 4 - level * STACK_STEP);
    const label = this.scene.add
      .text(x, y, text, textStyle(10, COMBAT_TEXT_COLORS[kind], { stroke: '#0d0b14', strokeThickness: 2 }))
      .setOrigin(0.5, 1)
      .setDepth(9000)
      .setResolution(this.scene.cameras.main.zoom);

    this.scene.tweens.add({ targets: label, y: y - RISE, duration: DURATION, ease: 'Quad.easeOut' });
    this.scene.tweens.add({
      targets: label,
      alpha: 0,
      delay: DURATION * 0.55,
      duration: DURATION * 0.45,
      onComplete: () => label.destroy(),
    });
  }
}
