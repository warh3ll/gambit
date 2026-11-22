import Phaser from 'phaser';
import { TILE_SIZE } from '../config';
import { PARTY } from '../data/party';

/** Loads (or, for now, generates) assets and hands over to the world. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    const g = this.add.graphics();

    // Placeholder character sprites: a coloured body with a dark outline.
    for (const c of PARTY) {
      g.clear();
      g.fillStyle(0x0d0b14).fillRect(0, 0, 12, 16);
      g.fillStyle(c.color).fillRect(1, 1, 10, 14);
      g.fillStyle(0x0d0b14).fillRect(3, 4, 2, 2).fillRect(7, 4, 2, 2); // eyes
      g.generateTexture(`char-${c.id}`, 12, 16);
    }

    // Placeholder ground tile.
    g.clear();
    g.fillStyle(0x2e4a2e).fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    g.fillStyle(0x355435).fillRect(0, 0, TILE_SIZE - 1, TILE_SIZE - 1);
    g.generateTexture('tile-grass', TILE_SIZE, TILE_SIZE);

    g.destroy();
    this.scene.start('World');
  }
}
