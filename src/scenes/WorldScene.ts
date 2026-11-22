import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { PARTY } from '../data/party';

/**
 * Placeholder world: confirms the pipeline renders pixel art and the party data.
 * Click-to-move, enemies and combat arrive in later milestones (see docs/PLAN.md).
 */
export class WorldScene extends Phaser.Scene {
  constructor() {
    super('World');
  }

  create() {
    this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, 'tile-grass').setOrigin(0);

    const spacing = 48;
    const startX = GAME_WIDTH / 2 - ((PARTY.length - 1) * spacing) / 2;
    PARTY.forEach((c, i) => {
      const x = startX + i * spacing;
      const y = GAME_HEIGHT / 2;
      this.add.image(x, y, `char-${c.id}`);
      this.label(x, y + 14, c.name, '#ffffff');
      this.label(x, y + 24, c.className, '#b8b0c8');
    });

    this.label(GAME_WIDTH / 2, 24, 'GAMBIT — project scaffold', '#f2d16b');
  }

  private label(x: number, y: number, text: string, color: string) {
    return this.add
      .text(x, y, text, { fontFamily: 'monospace', fontSize: '8px', color, resolution: 4 })
      .setOrigin(0.5, 0);
  }
}
