/** The right-hand panel (test in game, the game's flags, problems) and the dialogue preview. */
import { useState } from 'preact/hooks';
import type { FlagValue } from '../game/save';
import type { Step } from '../game/script';
import { clearGameFlag, playInGame, setGameFlag, useGame } from './gameLink';
import { type SelectedStep, getNav, go, goOwner, selectStep, useNav } from './nav';
import { flagValueText, speakers } from './steps';
import { type Owner, commit, getState, listAt, rootSteps, useStore, walkSteps } from './store';
import { Card, SpeakerFace } from './ui';
import type { Problem } from './validate';
import { areaById } from './world';

/** The step list open on the page, if any. */
export function currentOwner(): Owner | null {
  const nav = getNav();
  const c = getState().content;
  if (nav.tab === 'events' && nav.id && c.story.events[nav.id]) return { kind: 'event', id: nav.id };
  if (nav.tab === 'npcs' && nav.id && c.npcs[nav.id]) return { kind: 'npc', id: nav.id };
  return null;
}

export type TestResult = { ok: boolean; text: string } | null;

/** Plays the open event (from a top-level step, if given) in the game tab. */
export async function testInGame(from?: number): Promise<TestResult> {
  const owner = currentOwner();
  if (!owner) return null;
  const steps = rootSteps(getState().content, owner).slice(from ?? 0);
  if (!steps.length) return { ok: false, text: 'There are no steps to play.' };
  const error = await playInGame(steps);
  return error ? { ok: false, text: error } : { ok: true, text: 'Playing in the game tab.' };
}

export function SidePanel({ problems, test, setTest }: { problems: Problem[]; test: TestResult; setTest: (r: TestResult) => void }) {
  return (
    <aside class="side">
      <TestCard test={test} setTest={setTest} />
      <FlagsCard />
      <ProblemsCard problems={problems} />
    </aside>
  );
}

function TestCard({ test, setTest }: { test: TestResult; setTest: (r: TestResult) => void }) {
  const game = useGame();
  const nav = useNav();
  const { content } = useStore();
  const owner = currentOwner();
  const steps = owner ? rootSteps(content, owner) : [];
  const fromStep = nav.step && owner && nav.step.owner.id === owner.id && nav.step.path.length === 0 ? nav.step.index : null;

  // Fights only work in the area that has the group.
  const groups = new Set<string>();
  walkSteps(steps, (s) => s.do === 'fight' && s.group && groups.add(s.group));
  const here = game?.area ? areaById(game.area.id) : undefined;
  const missing = here ? [...groups].filter((g) => !here.groups.some((x) => x.id === g)) : [];

  const state = !game ? 'off' : game.screen === 'world' ? 'on' : 'menu';
  const run = async (from?: number) => setTest(await testInGame(from));
  return (
    <Card
      title="Test in game"
      right={
        <span class={`status ${state}`}>
          <span class="status-dot" />
          {state === 'off' ? 'No game open' : state === 'menu' ? 'On the title screen' : game!.area?.name}
        </span>
      }
    >
      {state === 'off' && (
        <p class="muted small">
          Open the game in another tab (
          <a href="/" target="gambit-game">
            localhost:8080
          </a>
          ) and continue a game to try events there.
        </p>
      )}
      {owner ? (
        <div class="test-buttons">
          <button class="primary" disabled={state !== 'on'} onClick={() => run()}>
            ▶ Play {owner.kind === 'event' ? 'this event' : 'this conversation'}
          </button>
          {fromStep !== null && fromStep > 0 && (
            <button disabled={state !== 'on'} onClick={() => run(fromStep)}>
              ▶ From step {fromStep + 1}
            </button>
          )}
        </div>
      ) : (
        <p class="muted small">Open an event or NPC to test it.</p>
      )}
      {missing.length > 0 && (
        <p class="note warn small">
          The fight{missing.length > 1 ? 's' : ''} {missing.map((g) => `“${g}”`).join(', ')} {missing.length > 1 ? "aren't" : "isn't"} in {here!.name}, so{' '}
          {missing.length > 1 ? 'they' : 'it'} won't start there.
        </p>
      )}
      {test && <p class={`note small ${test.ok ? 'ok' : 'warn'}`}>{test.text}</p>}
      {owner && state === 'on' && <p class="muted small">Plays what you see here, saved or not. Flags it sets are kept in your game's save.</p>}
    </Card>
  );
}

function FlagsCard() {
  const game = useGame();
  const [name, setName] = useState('');
  if (!game || game.screen !== 'world') return null;
  const flags = Object.entries(game.flags).sort(([a], [b]) => a.localeCompare(b));
  const add = () => {
    if (!name.trim()) return;
    setGameFlag(name.trim(), true);
    setName('');
  };
  return (
    <Card title="Flags in your game" right={<span class="muted small">{flags.length}</span>}>
      <p class="muted small">What the game you're playing remembers. Clear a flag to see an event again.</p>
      <ul class="flags">
        {flags.map(([k, v]) => (
          <li key={k}>
            <span class="mono flag-name">{k}</span>
            <FlagValueToggle value={v} onChange={(nv) => setGameFlag(k, nv)} />
            <button class="icon danger" title="Clear this flag" onClick={() => clearGameFlag(k)}>
              ✕
            </button>
          </li>
        ))}
        {!flags.length && <li class="muted small">No flags yet.</li>}
      </ul>
      <form
        class="flag-add"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input class="mono" list="flag-names" placeholder="flagName" value={name} onInput={(e) => setName(e.currentTarget.value.replace(/\s/g, ''))} />
        <button type="submit">Set</button>
      </form>
    </Card>
  );
}

function FlagValueToggle({ value, onChange }: { value: FlagValue; onChange: (v: FlagValue) => void }) {
  if (typeof value === 'boolean') {
    return (
      <button class="pill" title="Click to flip" onClick={() => onChange(!value)}>
        {flagValueText(value)}
      </button>
    );
  }
  return <span class="pill static">{flagValueText(value)}</span>;
}

function ProblemsCard({ problems }: { problems: Problem[] }) {
  const errors = problems.filter((p) => p.level === 'error').length;
  const open = (p: Problem) => {
    if (!p.owner) return;
    const step: SelectedStep | null = p.step ? { owner: p.owner, path: p.step.path, index: p.step.index } : null;
    goOwner(p.owner, step);
  };
  return (
    <Card
      class="problems"
      title="Problems"
      right={<span class={`count ${errors ? 'error' : problems.length ? 'warning' : 'ok'}`}>{problems.length ? problems.length : '✓'}</span>}
    >
      {!problems.length && <p class="muted small">Nothing found. Every speaker, flag, fight and area checks out.</p>}
      <ul class="problem-list">
        {problems.map((p, i) => (
          <li key={i} class={`problem ${p.level} ${p.owner ? 'link' : ''}`} onClick={() => open(p)}>
            <span class="problem-icon">{p.level === 'error' ? '●' : '▲'}</span>
            <span>
              {p.text}
              {p.missingEvent && (
                <button
                  class="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    const id = p.missingEvent!;
                    commit((c) => (c.story.events[id] = [{ do: 'say', text: '' }]));
                    go('events', id);
                  }}
                >
                  Create “{p.missingEvent}”
                </button>
              )}
              {p.missingNpc && (
                <button
                  class="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    const id = p.missingNpc!;
                    commit((c) => (c.npcs[id] = { name: id, color: '#8a9a6a', talk: [{ do: 'say', speaker: id, text: '' }] }));
                    go('npcs', id);
                  }}
                >
                  Create NPC “{p.missingNpc}”
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ── dialogue preview ──

/** The selected line or choice, drawn like the game's dialogue box. */
export function Preview() {
  const nav = useNav();
  const { content } = useStore();
  const sel = nav.step;
  if (!sel) return null;
  const step: Step | undefined = listAt(rootSteps(content, sel.owner), sel.path)[sel.index];
  if (!step || (step.do !== 'say' && step.do !== 'choice')) return null;
  const speaker = step.speaker ? speakers(content).find((s) => s.id === step.speaker) : undefined;
  const text = step.do === 'say' ? step.text : step.prompt;
  return (
    <div class="preview">
      <div class="preview-label">
        <span>Preview</span>
        <button class="icon" title="Close preview" onClick={() => selectStep(null)}>
          ✕
        </button>
      </div>
      <div class="dlg">
        {step.speaker && (
          <div class="dlg-face">
            <SpeakerFace id={step.speaker} size={80} />
          </div>
        )}
        <div class="dlg-body">
          {step.speaker && <div class="dlg-name">{speaker?.name ?? step.speaker}</div>}
          <div class={`dlg-text ${step.speaker ? '' : 'narration'}`}>{text || '…'}</div>
          {step.do === 'choice' &&
            step.options.map((o, i) => (
              <div key={i} class={`dlg-opt ${i === 0 ? 'active' : ''}`}>
                {i + 1}. {o.label}
              </div>
            ))}
          {step.do === 'say' && <div class="dlg-hint">click to continue</div>}
        </div>
      </div>
    </div>
  );
}
