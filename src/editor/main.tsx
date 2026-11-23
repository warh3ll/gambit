/**
 * THE GAMBIT EDITOR — a dev-server tool for the game's content (http://localhost:8080/editor.html).
 * Not part of the game build. Saves straight into src/data/*.json through tools/editorPlugin.ts.
 */
import '@fontsource/jersey-10/400.css';
import './editor.css';
import { render } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { useGame } from './gameLink';
import { type Tab, getNav, go, selectStep, useNav } from './nav';
import { MapSide, MapSidebar } from './map/MapPanels';
import { Page, Sidebar } from './pages';
import { Preview, SidePanel, type TestResult, testInGame } from './side';
import {
  fileName,
  discardDraft,
  dirtyFiles,
  editSteps,
  listAt,
  load,
  redo,
  reloadFromDisk,
  restoreDraft,
  save,
  setBanner,
  undo,
  useStore,
} from './store';
import { clickedIn } from './ui';
import { allFlags, validate } from './validate';

const TABS: { id: Tab; label: string }[] = [
  { id: 'events', label: 'Events' },
  { id: 'npcs', label: 'NPCs' },
  { id: 'speakers', label: 'Speakers' },
  { id: 'map', label: 'Map' },
];

/** The area last open on the Map tab, to return to it. */
let lastArea: string | null = null;

function App() {
  const state = useStore();
  const nav = useNav();
  const game = useGame();
  const [test, setTest] = useState<TestResult>(null);
  const problems = useMemo(() => validate(state.content), [state.content]);
  const flags = useMemo(() => allFlags(state.content), [state.content]);
  const dirty = dirtyFiles(state);
  const errors = problems.filter((p) => p.level === 'error').length;

  useEffect(() => setTest(null), [nav.tab, nav.id]);
  if (nav.tab === 'map' && nav.id && state.content.areas[nav.id]) lastArea = nav.id;

  // Keyboard: Ctrl+S save, Ctrl+Z / Ctrl+Y (or Ctrl+Shift+Z) undo / redo, Delete removes the selected step.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (mod && key === 's') {
        e.preventDefault();
        void save();
      } else if (mod && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && key === 'y') {
        e.preventDefault();
        redo();
      } else if (key === 'delete' && !isTyping()) {
        const sel = getNav().step;
        if (!sel) return;
        editSteps(sel.owner, (root) => listAt(root, sel.path).splice(sel.index, 1));
        selectStep(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Warn before closing the tab with unsaved changes (they're also kept as a draft in the browser).
  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => {
      if (dirtyFiles().length) e.preventDefault();
    };
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, []);

  useEffect(() => {
    document.title = `${dirty.length ? '● ' : ''}Gambit Editor`;
  }, [dirty.length]);

  if (state.status === 'loading') return <div class="loading">Loading…</div>;

  const saveLabel = state.status === 'saving' ? 'Saving…' : dirty.length ? 'Save' : 'Saved';
  return (
    <div class={`app tab-${nav.tab}`}>
      <header class="topbar">
        <div class="brand">
          Gambit <span>Editor</span>
        </div>
        <nav class="tabs">
          {TABS.map((t) => (
            <button key={t.id} class={`tab ${nav.tab === t.id ? 'active' : ''}`} onClick={() => (t.id === 'map' ? go('map', lastArea ?? state.content.story.newGame.area) : go(t.id))}>
              {t.label}
            </button>
          ))}
        </nav>
        <div class="spacer" />
        <a class="game-link" href="/" target="gambit-game" title="Open the game (in its own tab)">
          <span class={`status-dot ${game ? (game.screen === 'world' ? 'on' : 'menu') : 'off'}`} />
          Game
        </a>
        <div class="history">
          <button title="Undo (Ctrl+Z)" disabled={!state.past.length} onClick={undo}>
            ↶
          </button>
          <button title="Redo (Ctrl+Y)" disabled={!state.future.length} onClick={redo}>
            ↷
          </button>
        </div>
        <span class="save-state" title={dirty.map(fileName).join('\n')}>
          {dirty.length ? 'Unsaved changes' : ''}
        </span>
        <button
          class={`save ${dirty.length ? 'primary' : ''}`}
          disabled={!dirty.length || state.status === 'saving'}
          title={errors ? `Saving works, but ${errors} problem(s) will show in the game` : 'Save (Ctrl+S)'}
          onClick={() => save()}
        >
          {saveLabel}
        </button>
      </header>

      {state.banner && <BannerBar />}

      <div class="body">
        {(nav.tab === 'events' || nav.tab === 'npcs') && <Sidebar key={nav.tab} problems={problems} />}
        {nav.tab === 'map' && <MapSidebar problems={problems} />}
        <main
          class="main"
          onClick={(e) => {
            // Clicking empty space deselects the step (and closes the preview).
            if (getNav().step && !clickedIn(e, '.step, .gap, .preview')) selectStep(null);
          }}
        >
          <Page onTest={async () => setTest(await testInGame())} />
          <Preview />
        </main>
        {nav.tab === 'map' ? <MapSide problems={problems} /> : <SidePanel problems={problems} test={test} setTest={setTest} />}
      </div>

      <datalist id="flag-names">
        {flags.map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>
    </div>
  );
}

function BannerBar() {
  const { banner } = useStore();
  if (!banner) return null;
  return (
    <div class={`banner ${banner.kind}`}>
      <span>{banner.text}</span>
      {banner.kind === 'conflict' && (
        <>
          <button onClick={() => save(true)}>Overwrite with mine</button>
          <button
            onClick={() => {
              if (confirm('Throw away your unsaved changes and load the files as they are now?')) void reloadFromDisk();
            }}
          >
            Load theirs (lose my changes)
          </button>
        </>
      )}
      {banner.kind === 'draft' && (
        <>
          <button onClick={restoreDraft}>Restore my changes</button>
          <button onClick={discardDraft}>Discard them</button>
        </>
      )}
      {(banner.kind === 'info' || banner.kind === 'error') && (
        <button class="icon" title="Dismiss" onClick={() => setBanner(null)}>
          ✕
        </button>
      )}
    </div>
  );
}

const isTyping = () => {
  const el = document.activeElement;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT');
};

render(<App />, document.getElementById('editor')!);
void load();
