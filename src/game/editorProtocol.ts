/** Messages between the Gambit Editor and the game tab (dev only; see editorBridge.ts). No runtime imports here. */
import type { FlagValue } from './save';
import type { Step } from './script';

export const EDITOR_CHANNEL = 'gambit-editor';

/** Editor → game. */
export type ToGame =
  | { type: 'ping' }
  | { type: 'play'; game: string; request: number; steps: Step[] }
  | { type: 'setFlag'; game: string; flag: string; value: FlagValue }
  | { type: 'clearFlag'; game: string; flag: string };

/** Game → editor. */
export type FromGame =
  | {
      type: 'status';
      game: string;
      /** 'world' while a game is being played; otherwise the title or end screen. */
      screen: 'world' | 'menu';
      area?: { id: string; name: string };
      flags: Record<string, FlagValue>;
      focused: boolean;
    }
  | { type: 'played'; game: string; request: number; error: string | null };
