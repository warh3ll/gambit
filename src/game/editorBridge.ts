/**
 * DEV ONLY: lets the Gambit Editor (editor.html) talk to the game running in another tab,
 * for "Test in game" and for looking at / changing story flags. Started from main.ts in dev builds only.
 *
 * Both tabs are on the same dev server, so they talk over a BroadcastChannel. Each game tab has its own id;
 * the editor sends commands to one tab (the one that answered most recently), so a test never plays twice.
 */
import type Phaser from 'phaser';
import type { WorldScene } from '../scenes/WorldScene';
import { EDITOR_CHANNEL, type FromGame, type ToGame } from './editorProtocol';
import { session } from './session';

export function connectEditor(game: Phaser.Game) {
  const id = Math.random().toString(36).slice(2, 10);
  const channel = new BroadcastChannel(EDITOR_CHANNEL);
  const post = (msg: FromGame) => channel.postMessage(msg);

  const world = (): WorldScene | null => {
    const inWorld = game.scene.isActive('World') || game.scene.isPaused('World');
    return inWorld ? (game.scene.getScene('World') as WorldScene) : null;
  };

  const status = () => {
    const w = world();
    post({
      type: 'status',
      game: id,
      screen: w ? 'world' : 'menu',
      area: w ? { id: w.currentArea.id, name: w.currentArea.name } : undefined,
      flags: { ...session.data.flags },
      focused: document.hasFocus(),
    });
  };

  channel.onmessage = (e: MessageEvent<ToGame>) => {
    const msg = e.data;
    if (msg.type === 'ping') return status();
    if (msg.game !== id) return;
    const w = world();
    switch (msg.type) {
      case 'play': {
        const error = w ? w.editorPlay(msg.steps) : 'The game is on the title screen. Start or continue a game first.';
        post({ type: 'played', game: id, request: msg.request, error });
        if (!error) window.focus();
        break;
      }
      case 'goto': {
        const error = w ? w.editorGoto(msg.area, msg.x, msg.y) : 'The game is on the title screen. Start or continue a game first.';
        post({ type: 'played', game: id, request: msg.request, error });
        if (!error) window.focus();
        break;
      }
      case 'setFlag':
        session.setFlag(msg.flag, msg.value);
        w?.editorFlagsChanged();
        status();
        break;
      case 'clearFlag':
        delete session.data.flags[msg.flag];
        w?.editorFlagsChanged();
        status();
        break;
    }
  };
  window.addEventListener('beforeunload', () => channel.close());
}
