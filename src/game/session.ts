import Phaser from 'phaser';
import { type FlagValue, newSaveData, type SaveData, writeSave } from './save';

/**
 * The game being played right now. The title screen sets `data` (from the save, or a new game);
 * the world reads it on start and updates it as things happen; `autosave()` writes it out.
 */
class Session extends Phaser.Events.EventEmitter {
  data: SaveData = newSaveData();

  flag(name: string): FlagValue | undefined {
    return this.data.flags[name];
  }

  setFlag(name: string, value: FlagValue = true) {
    this.data.flags[name] = value;
  }

  /** Writes the current state to the save. Emits 'saved' (the HUD shows a small note). */
  autosave() {
    writeSave(this.data);
    this.emit('saved');
  }
}

export const session = new Session();
