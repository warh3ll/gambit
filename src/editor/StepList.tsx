/**
 * The step list editor: one card per step, nested lists for choice answers and if/otherwise branches,
 * drag and drop (also between nested lists), and a menu to add steps anywhere.
 */
import { type ComponentChildren, createContext } from 'preact';
import { useContext, useEffect, useRef, useState } from 'preact/hooks';
import type { Step } from '../game/script';
import { go, selectStep, useNav } from './nav';
import { STEP_KINDS, endsEvent, kindOf } from './steps';
import { type ListPath, type Owner, editSteps, listAt, moveStep, samePath } from './store';
import { AutoText, FlagInput, SpeakerFace, SpeakerSelect, ValueInput, clickedIn } from './ui';
import { WORLD, areaById } from './world';

type StepOf<K extends Step['do']> = Extract<Step, { do: K }>;
type Edit<T> = (fn: (s: T) => void, coalesce?: string) => void;

/** Which "add step" menu is open, shared by every list on the page. */
const MenuContext = createContext<{ open: string | null; setOpen: (key: string | null) => void }>({ open: null, setOpen: () => {} });

export function StepEditor({ owner, steps }: { owner: Owner; steps: Step[] }) {
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    const close = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, []);
  return (
    <MenuContext.Provider value={{ open, setOpen }}>
      <StepList owner={owner} path={[]} steps={steps} />
    </MenuContext.Provider>
  );
}

// ── drag and drop ──

let dragging: { owner: Owner; path: ListPath; index: number } | null = null;
const ownerKey = (o: Owner) => `${o.kind}:${o.id}`;
const listKey = (o: Owner, path: ListPath) => `${ownerKey(o)}/${path.join('.')}`;

/** A step that was just added: its first field gets focus. */
let focusNew: string | null = null;

function insertStep(owner: Owner, path: ListPath, index: number, step: Step) {
  editSteps(owner, (root) => listAt(root, path).splice(index, 0, step));
  focusNew = `${listKey(owner, path)}#${index}`;
  selectStep({ owner, path, index });
}

function StepList({ owner, path, steps, emptyText }: { owner: Owner; path: ListPath; steps: Step[]; emptyText?: string }) {
  const endAt = steps.findIndex(endsEvent);
  return (
    <div class={`step-list ${path.length ? 'nested' : 'root'}`}>
      {steps.map((step, i) => (
        <div key={i} class={endAt >= 0 && i > endAt ? 'unreachable' : ''}>
          <Gap owner={owner} path={path} index={i} />
          <StepCard owner={owner} path={path} index={i} step={step} />
        </div>
      ))}
      <Gap owner={owner} path={path} index={steps.length} last empty={!steps.length} emptyText={emptyText} />
    </div>
  );
}

/** The space between steps: drop target while dragging, and a "+" to add a step there. */
function Gap({ owner, path, index, last, empty, emptyText }: { owner: Owner; path: ListPath; index: number; last?: boolean; empty?: boolean; emptyText?: string }) {
  const menu = useContext(MenuContext);
  const [over, setOver] = useState(false);
  const key = `${listKey(owner, path)}@${index}`;
  const isOpen = menu.open === key;
  const canDrop = () => dragging && ownerKey(dragging.owner) === ownerKey(owner);
  return (
    <div
      class={`gap ${last ? 'last' : ''} ${empty ? 'empty' : ''} ${over ? 'over' : ''} ${isOpen ? 'open' : ''}`}
      onDragOver={(e) => {
        if (!canDrop()) return;
        e.preventDefault();
        e.dataTransfer!.dropEffect = 'move';
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!dragging || !canDrop()) return;
        moveStep(owner, dragging, { path, index });
        dragging = null;
      }}
    >
      {last ? (
        <button class="add-step" onClick={() => menu.setOpen(isOpen ? null : key)}>
          {empty && emptyText ? <span class="muted">{emptyText} · </span> : null}+ Add step
        </button>
      ) : (
        <button class="gap-add" title="Add a step here" onClick={() => menu.setOpen(isOpen ? null : key)}>
          +
        </button>
      )}
      {isOpen && (
        <AddMenu
          onPick={(make) => {
            menu.setOpen(null);
            insertStep(owner, path, index, make());
          }}
          onClose={() => menu.setOpen(null)}
        />
      )}
    </div>
  );
}

function AddMenu({ onPick, onClose }: { onPick: (make: () => Step) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const away = (e: MouseEvent) => !ref.current?.parentElement?.contains(e.target as Node) && onClose();
    setTimeout(() => window.addEventListener('mousedown', away));
    ref.current?.scrollIntoView({ block: 'nearest' });
    return () => window.removeEventListener('mousedown', away);
  }, []);
  return (
    <div class="add-menu" ref={ref}>
      {STEP_KINDS.map((k) => (
        <button key={k.id} class="add-item" style={{ '--accent': k.color }} onClick={() => onPick(k.make)}>
          <span class="add-label">{k.label}</span>
          <span class="add-hint">{k.hint}</span>
        </button>
      ))}
    </div>
  );
}

// ── one step ──

function StepCard({ owner, path, index, step }: { owner: Owner; path: ListPath; index: number; step: Step }) {
  const nav = useNav();
  const ref = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const kind = kindOf(step);
  const sel = nav.step;
  const selected = !!sel && ownerKey(sel.owner) === ownerKey(owner) && samePath(sel.path, path) && sel.index === index;
  const id = `${listKey(owner, path)}#${index}`;
  const edit = <T extends Step>(fn: (s: T) => void, coalesce?: string) =>
    editSteps(owner, (root) => fn(listAt(root, path)[index] as T), coalesce === undefined ? undefined : `${id}/${coalesce}`);

  useEffect(() => {
    if (focusNew !== id) return;
    focusNew = null;
    ref.current?.querySelector<HTMLElement>('textarea, input')?.focus();
  });

  const remove = () => {
    editSteps(owner, (root) => listAt(root, path).splice(index, 1));
    selectStep(null);
  };
  const duplicate = () => {
    editSteps(owner, (root) => {
      const list = listAt(root, path);
      list.splice(index + 1, 0, structuredClone(list[index]));
    });
    selectStep({ owner, path, index: index + 1 });
  };
  const nests = step.do === 'choice' || step.do === 'if';

  return (
    <div
      ref={ref}
      class={`step kind-${kind.id} ${selected ? 'selected' : ''}`}
      style={{ '--accent': kind.color }}
      onClick={(e) => {
        // Only clicks on this card itself, not on a card or "add step" nested inside it.
        if (clickedIn(e, '.step, .gap') !== ref.current) return;
        if (!selected) selectStep({ owner, path, index });
      }}
    >
      <div class="step-head">
        <span
          class="handle"
          title="Drag to move"
          draggable
          onDragStart={(e) => {
            dragging = { owner, path, index };
            e.dataTransfer!.effectAllowed = 'move';
            e.dataTransfer!.setData('text/plain', kind.label);
            if (ref.current) e.dataTransfer!.setDragImage(ref.current, 12, 12);
            document.body.classList.add('dragging');
          }}
          onDragEnd={() => {
            dragging = null;
            document.body.classList.remove('dragging');
          }}
        >
          ⠿
        </span>
        {nests && (
          <button class="collapse" title={collapsed ? 'Expand' : 'Collapse'} onClick={(e) => (e.stopPropagation(), setCollapsed(!collapsed))}>
            {collapsed ? '▸' : '▾'}
          </button>
        )}
        <span class="badge">{kind.label}</span>
        <StepHead step={step} edit={edit} />
        <span class="step-actions" onClick={(e) => e.stopPropagation()}>
          <button title="Duplicate" onClick={duplicate}>
            ⧉
          </button>
          <button title="Delete" class="danger" onClick={remove}>
            ✕
          </button>
        </span>
      </div>
      {!collapsed && <StepBody owner={owner} path={path} index={index} step={step} edit={edit} />}
      {collapsed && <div class="collapsed-note muted">{summary(step)}</div>}
    </div>
  );
}

function summary(step: Step) {
  if (step.do === 'choice') return `${step.options.length} answers: ${step.options.map((o) => o.label).join(' · ')}`;
  if (step.do === 'if') return `then ${count(step.then)}, otherwise ${count(step.else)}`;
  return '';
}
const count = (s: Step[]) => `${s.length} step${s.length === 1 ? '' : 's'}`;

/** The fields on the step's first line. */
function StepHead({ step, edit }: { step: Step; edit: <T extends Step>(fn: (s: T) => void, coalesce?: string) => void }) {
  switch (step.do) {
    case 'say':
      return (
        <span class="head-fields">
          <SpeakerSelect
            value={step.speaker}
            none="(narration)"
            onChange={(v) =>
              edit<StepOf<'say'>>((s) => {
                if (v) s.speaker = v;
                else delete s.speaker;
              })
            }
          />
        </span>
      );
    case 'choice':
      return (
        <span class="head-fields">
          <span class="muted">asked by</span>
          <SpeakerSelect
            value={step.speaker}
            none="(no one)"
            onChange={(v) =>
              edit<StepOf<'choice'>>((s) => {
                if (v) s.speaker = v;
                else delete s.speaker;
              })
            }
          />
        </span>
      );
    case 'setFlag':
      return (
        <span class="head-fields">
          <FlagInput value={step.flag} onInput={(v) => edit<StepOf<'setFlag'>>((s) => (s.flag = v), 'flag')} />
          <span class="muted">to</span>
          <ValueInput value={step.value} onChange={(v, typing) => edit<StepOf<'setFlag'>>((s) => (s.value = v), typing ? 'value' : undefined)} />
        </span>
      );
    case 'if':
      return <IfHead step={step} edit={edit as Edit<StepOf<'if'>>} />;
    case 'fight':
      return <FightHead step={step} edit={edit as Edit<StepOf<'fight'>>} />;
    case 'heal':
      return <span class="head-fields muted">Everyone back to full HP; the fallen get up.</span>;
    case 'wait':
      return (
        <span class="head-fields">
          <input
            type="number"
            class="num"
            min={0}
            step={0.1}
            value={step.ms / 1000}
            onInput={(e) => edit<StepOf<'wait'>>((s) => (s.ms = Math.max(0, Math.round(Number(e.currentTarget.value) * 1000))), 'ms')}
          />
          <span class="muted">seconds</span>
        </span>
      );
    case 'teleport':
      return <TeleportHead step={step} edit={edit as Edit<StepOf<'teleport'>>} />;
    case 'endGame':
      return <span class="head-fields muted">Shows the end screen. The event ends here.</span>;
  }
}

function IfHead({ step, edit }: { step: StepOf<'if'>; edit: Edit<StepOf<'if'>> }) {
  const simple = step.equals === true;
  const mode = simple ? (step.not ? 'unset' : 'set') : step.not ? 'isnt' : 'is';
  return (
    <span class="head-fields">
      <FlagInput value={step.flag} onInput={(v) => edit((s) => (s.flag = v), 'flag')} />
      <select
        value={mode}
        onChange={(e) => {
          const m = e.currentTarget.value;
          edit((s) => {
            s.not = m === 'unset' || m === 'isnt' ? true : undefined;
            if (!s.not) delete s.not;
            if (m === 'set' || m === 'unset') s.equals = true;
            else if (s.equals === true) s.equals = 1;
          });
        }}
      >
        <option value="set">is set</option>
        <option value="unset">is not set</option>
        <option value="is">is…</option>
        <option value="isnt">is not…</option>
      </select>
      {!simple && <ValueInput value={step.equals} onChange={(v, typing) => edit((s) => (s.equals = v), typing ? 'equals' : undefined)} />}
    </span>
  );
}

function FightHead({ step, edit }: { step: StepOf<'fight'>; edit: Edit<StepOf<'fight'>> }) {
  const known = WORLD.areas.some((a) => a.groups.some((g) => g.id === step.group));
  return (
    <span class="head-fields">
      <span class="muted">with</span>
      <select value={step.group} onChange={(e) => edit((s) => (s.group = e.currentTarget.value))}>
        <option value="">choose a group…</option>
        {!known && step.group && <option value={step.group}>⚠ unknown: {step.group}</option>}
        {WORLD.areas
          .filter((a) => a.groups.length)
          .map((a) => (
            <optgroup label={a.name} key={a.id}>
              {a.groups.map((g) => (
                <option value={g.id} key={g.id}>
                  {g.id}
                  {g.unique ? ' (story fight)' : ''}
                </option>
              ))}
            </optgroup>
          ))}
      </select>
    </span>
  );
}

function TeleportHead({ step, edit }: { step: StepOf<'teleport'>; edit: Edit<StepOf<'teleport'>> }) {
  const area = areaById(step.area);
  return (
    <span class="head-fields">
      <span class="muted">to</span>
      <select
        value={step.area}
        onChange={(e) => {
          const next = areaById(e.currentTarget.value);
          edit((s) => {
            s.area = e.currentTarget.value;
            if (next && !next.starts.includes(s.at)) s.at = next.starts.includes('default') ? 'default' : (next.starts[0] ?? '');
          });
        }}
      >
        {!area && <option value={step.area}>⚠ unknown: {step.area}</option>}
        {WORLD.areas.map((a) => (
          <option value={a.id} key={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      <span class="muted">at</span>
      <select value={step.at} onChange={(e) => edit((s) => (s.at = e.currentTarget.value))}>
        {area && !area.starts.includes(step.at) && <option value={step.at}>⚠ unknown: {step.at}</option>}
        {area?.starts.map((p) => (
          <option value={p} key={p}>
            {p === 'default' ? 'default (new game start)' : p}
          </option>
        ))}
      </select>
    </span>
  );
}

/** What goes under the first line: the text, answers or branches. */
function StepBody({ owner, path, index, step, edit }: { owner: Owner; path: ListPath; index: number; step: Step; edit: <T extends Step>(fn: (s: T) => void, coalesce?: string) => void }) {
  switch (step.do) {
    case 'say':
      return (
        <div class="say-body">
          {step.speaker && <SpeakerFace id={step.speaker} size={40} />}
          <AutoText
            value={step.text}
            placeholder={step.speaker ? 'What they say…' : 'Narration…'}
            onInput={(v) => edit<StepOf<'say'>>((s) => (s.text = v), 'text')}
          />
        </div>
      );
    case 'choice':
      return <ChoiceBody owner={owner} path={path} index={index} step={step} edit={edit as Edit<StepOf<'choice'>>} />;
    case 'if':
      return (
        <div class="branches">
          <Branch label="Then" accent="#c58cff">
            <StepList owner={owner} path={[...path, index, 'then']} steps={step.then} emptyText="Nothing" />
          </Branch>
          <Branch label="Otherwise" accent="#8a82a0">
            <StepList owner={owner} path={[...path, index, 'else']} steps={step.else} emptyText="Nothing" />
          </Branch>
        </div>
      );
    case 'fight': {
      const onWin = WORLD.areas.flatMap((a) => a.groups).find((g) => g.id === step.group)?.onWin;
      return (
        <div class="step-note muted">
          The event ends here; if the party loses, they can retry.{' '}
          {step.group &&
            (onWin ? (
              <>
                After winning:{' '}
                <a href={`#events/${onWin}`} onClick={(e) => (e.preventDefault(), go('events', onWin))}>
                  {onWin}
                </a>
              </>
            ) : (
              'Nothing plays after winning (set an event for the fight in the area file).'
            ))}
        </div>
      );
    }
    case 'teleport':
      return <div class="step-note muted">The event ends here.</div>;
    default:
      return null;
  }
}

function Branch({ label, accent, children, actions }: { label: ComponentChildren; accent: string; children: ComponentChildren; actions?: ComponentChildren }) {
  return (
    <div class="branch" style={{ '--branch': accent }}>
      <div class="branch-head">
        <span class="branch-label">{label}</span>
        {actions}
      </div>
      {children}
    </div>
  );
}

function ChoiceBody({ owner, path, index, step, edit }: { owner: Owner; path: ListPath; index: number; step: StepOf<'choice'>; edit: Edit<StepOf<'choice'>> }) {
  const n = step.options.length;
  return (
    <div class="choice-body">
      <AutoText value={step.prompt} placeholder="The question shown above the answers…" onInput={(v) => edit((s) => (s.prompt = v), 'prompt')} />
      <div class="branches">
        {step.options.map((o, j) => (
          <Branch
            key={j}
            accent="#7fb8e6"
            label={
              <>
                <span class="answer-no">{j + 1}.</span>
                <input class="answer" value={o.label} placeholder="Answer…" onInput={(e) => edit((s) => (s.options[j].label = e.currentTarget.value), `opt${j}`)} />
              </>
            }
            actions={
              <span class="branch-actions">
                <button title="Move up" disabled={j === 0} onClick={() => edit((s) => s.options.splice(j - 1, 0, ...s.options.splice(j, 1)))}>
                  ↑
                </button>
                <button title="Move down" disabled={j === n - 1} onClick={() => edit((s) => s.options.splice(j + 1, 0, ...s.options.splice(j, 1)))}>
                  ↓
                </button>
                <button title="Remove this answer" class="danger" onClick={() => edit((s) => s.options.splice(j, 1))}>
                  ✕
                </button>
              </span>
            }
          >
            <StepList owner={owner} path={[...path, index, 'options', j, 'steps']} steps={o.steps} emptyText="Just carry on" />
          </Branch>
        ))}
        <button class="add-answer" onClick={() => edit((s) => s.options.push({ label: '', steps: [] }))}>
          + Add answer
        </button>
      </div>
    </div>
  );
}
