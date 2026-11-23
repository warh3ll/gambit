import type { FlagValue } from '../game/save';
import type { Step } from '../game/script';
import type { DialogScene } from '../scenes/DialogScene';

/** What the event runner needs from the world. */
export interface EventHost {
  flag(name: string): FlagValue | undefined;
  setFlag(name: string, value: FlagValue): void;
  /** Opens the dialogue box (pausing the world) if it isn't open yet. */
  openDialog(): Promise<DialogScene>;
  /** Closes the dialogue box (resuming the world) if it's open. */
  closeDialog(): void;
  startFight(group: string): void;
  healParty(): void;
  teleport(area: string, at: string): void;
  endGame(): void;
}

/**
 * Runs event steps (src/game/script.ts) one after another. One event at a time.
 * An event ends early at a fight, a teleport or the end of the game.
 */
export class EventRunner {
  private readonly host: EventHost;
  private active = false;

  constructor(host: EventHost) {
    this.host = host;
  }

  get running() {
    return this.active;
  }

  /** Runs an event. Resolves when it's over. Returns false if another event was already running. */
  async run(steps: Step[]): Promise<boolean> {
    if (this.active) return false;
    this.active = true;
    try {
      await this.exec(steps);
    } finally {
      this.host.closeDialog();
      this.active = false;
    }
    return true;
  }

  /** Returns false when the event should stop here. */
  private async exec(steps: Step[]): Promise<boolean> {
    for (const step of steps) {
      switch (step.do) {
        case 'say': {
          const dialog = await this.host.openDialog();
          await dialog.say(step.speaker, step.text);
          break;
        }
        case 'choice': {
          const dialog = await this.host.openDialog();
          const i = await dialog.choose(
            step.speaker,
            step.prompt,
            step.options.map((o) => o.label),
          );
          if (!(await this.exec(step.options[i]?.steps ?? []))) return false;
          break;
        }
        case 'setFlag':
          this.host.setFlag(step.flag, step.value);
          break;
        case 'if': {
          const matches = (this.host.flag(step.flag) === step.equals) !== !!step.not;
          const branch = matches ? step.then : step.else;
          if (!(await this.exec(branch))) return false;
          break;
        }
        case 'heal':
          this.host.healParty();
          break;
        case 'wait':
          await new Promise((r) => setTimeout(r, step.ms));
          break;
        case 'fight':
          this.host.closeDialog();
          this.host.startFight(step.group);
          return false;
        case 'teleport':
          this.host.closeDialog();
          this.host.teleport(step.area, step.at);
          return false;
        case 'endGame':
          this.host.closeDialog();
          this.host.endGame();
          return false;
      }
    }
    return true;
  }
}
