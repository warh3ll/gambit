/**
 * The editor's side of the link to the game tab (see src/game/editorBridge.ts): finds an open game,
 * plays events there ("Test in game"), and reads / changes its story flags.
 */
import { useEffect, useState } from 'preact/hooks';
import { EDITOR_CHANNEL, type FromGame, type ToGame } from '../game/editorProtocol';
import type { FlagValue } from '../game/save';
import type { Step } from '../game/script';

type Status = Extract<FromGame, { type: 'status' }>;

const channel = new BroadcastChannel(EDITOR_CHANNEL);
const seen = new Map<string, { status: Status; at: number }>();
const waiting = new Map<number, (error: string | null) => void>();
const listeners = new Set<() => void>();
let nextRequest = 1;

const post = (msg: ToGame) => channel.postMessage(msg);
const notify = () => listeners.forEach((l) => l());

channel.onmessage = (e: MessageEvent<FromGame>) => {
  const msg = e.data;
  if (msg.type === 'status') {
    seen.set(msg.game, { status: msg, at: Date.now() });
    notify();
  } else if (msg.type === 'played') {
    waiting.get(msg.request)?.(msg.error);
    waiting.delete(msg.request);
  }
};

const ping = () => post({ type: 'ping' });
setInterval(ping, 1500);
ping();

/** The game tab to talk to: one that answered lately, preferring one with a game going, then the focused one. */
export function currentGame(): Status | null {
  const now = Date.now();
  const live = [...seen.values()].filter((g) => now - g.at < 4000);
  for (const [id, g] of seen) if (now - g.at >= 4000) seen.delete(id);
  live.sort((a, b) => score(b.status) - score(a.status) || b.at - a.at);
  return live[0]?.status ?? null;
}
const score = (s: Status) => (s.screen === 'world' ? 2 : 0) + (s.focused ? 1 : 0);

/** Re-renders with the current game (or null if no game tab is open). */
export function useGame(): Status | null {
  const [, bump] = useState(0);
  useEffect(() => {
    const l = () => bump((n) => n + 1);
    listeners.add(l);
    const t = setInterval(l, 2000); // notice when a game tab goes away
    return () => {
      listeners.delete(l);
      clearInterval(t);
    };
  }, []);
  return currentGame();
}

/** Plays steps in the game. Resolves with null once playing, or a reason it couldn't. */
export function playInGame(steps: Step[]): Promise<string | null> {
  const game = currentGame();
  if (!game) return Promise.resolve('No game is open. Open the game (http://localhost:8080) in another tab.');
  const request = nextRequest++;
  return new Promise((resolve) => {
    waiting.set(request, resolve);
    post({ type: 'play', game: game.game, request, steps: structuredClone(steps) });
    setTimeout(() => {
      if (waiting.delete(request)) resolve("The game didn't answer. Try reloading the game tab.");
    }, 2000);
  });
}

export function setGameFlag(flag: string, value: FlagValue) {
  const game = currentGame();
  if (game) post({ type: 'setFlag', game: game.game, flag, value });
}

export function clearGameFlag(flag: string) {
  const game = currentGame();
  if (game) post({ type: 'clearFlag', game: game.game, flag });
}
