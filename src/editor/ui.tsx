/** Small building blocks shared by the editor's pages. */
import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { ART_FILES } from '../data/art';
import type { FlagValue } from '../game/save';
import { HEADSHOT_SIZE, type Painter, paintHeadshot, paintNpc } from '../world/placeholderArt';
import { type Speaker, speakers } from './steps';
import { useStore } from './store';

const css = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

function canvasPainter(canvas: HTMLCanvasElement): Painter {
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  return (color, alpha, x, y, w, h) => {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = css(color);
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
  };
}

/** A pixel picture: real art if src/data/art.ts lists one for `artKey`, otherwise the game's placeholder. */
function Pixel(props: { artKey: string; w: number; h: number; scale: number; paint: (p: Painter) => void; deps: unknown[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const file = ART_FILES[props.artKey];
  useEffect(() => {
    if (!file && ref.current) props.paint(canvasPainter(ref.current));
  }, [file, ...props.deps]);
  const style = { width: props.w * props.scale, height: props.h * props.scale };
  if (file) return <img class="pix" src={file} style={style} alt="" />;
  return <canvas class="pix" ref={ref} width={props.w} height={props.h} style={style} />;
}

export function Headshot({ id, color, size = HEADSHOT_SIZE }: { id: string; color: number; size?: number }) {
  return (
    <Pixel
      artKey={`headshot-${id}`}
      w={HEADSHOT_SIZE}
      h={HEADSHOT_SIZE}
      scale={size / HEADSHOT_SIZE}
      paint={(p) => paintHeadshot(p, id, color)}
      deps={[id, color]}
    />
  );
}

export function NpcSprite({ id, color, scale = 2 }: { id: string; color: number; scale?: number }) {
  return <Pixel artKey={`npc-${id}`} w={12} h={16} scale={scale} paint={(p) => paintNpc(p, color)} deps={[id, color]} />;
}

/** Headshot for any speaker id (party, NPC or other). */
export function SpeakerFace({ id, size }: { id: string; size?: number }) {
  const { content } = useStore();
  const s = speakers(content).find((x) => x.id === id);
  return <Headshot id={id} color={s?.color ?? 0x555555} size={size} />;
}

const KIND_LABEL: Record<Speaker['kind'], string> = { party: 'Party', npc: 'NPCs', other: 'Other speakers' };

/** Picks who says something. `none` is the label for "no speaker" (omit to require one). */
export function SpeakerSelect({ value, onChange, none }: { value?: string; onChange: (id: string | undefined) => void; none?: string }) {
  const { content } = useStore();
  const all = speakers(content);
  const known = !value || all.some((s) => s.id === value);
  return (
    <select class="speaker-select" value={value ?? ''} onChange={(e) => onChange(e.currentTarget.value || undefined)}>
      {none !== undefined && <option value="">{none}</option>}
      {!known && <option value={value}>⚠ unknown: {value}</option>}
      {(['party', 'npc', 'other'] as const).map((kind) => {
        const group = all.filter((s) => s.kind === kind);
        return group.length ? (
          <optgroup label={KIND_LABEL[kind]} key={kind}>
            {group.map((s) => (
              <option value={s.id} key={s.id}>
                {s.name}
              </option>
            ))}
          </optgroup>
        ) : null;
      })}
    </select>
  );
}

/** A textarea that grows with its text. */
export function AutoText(props: { value: string; onInput: (v: string) => void; placeholder?: string; class?: string; autoFocus?: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [props.value]);
  useEffect(() => {
    if (props.autoFocus) ref.current?.focus();
  }, []);
  return (
    <textarea
      ref={ref}
      rows={1}
      class={props.class ?? 'text'}
      value={props.value}
      placeholder={props.placeholder}
      spellcheck
      onInput={(e) => props.onInput(e.currentTarget.value)}
    />
  );
}

/** A flag name, with suggestions from every flag used anywhere (the datalist is in main.tsx). */
export function FlagInput({ value, onInput }: { value: string; onInput: (v: string) => void }) {
  return (
    <input
      class="flag-input mono"
      list="flag-names"
      value={value}
      placeholder="flagName"
      spellcheck={false}
      onInput={(e) => onInput(e.currentTarget.value.replace(/\s/g, ''))}
    />
  );
}

type ValueKind = 'yes' | 'no' | 'number' | 'text';
const kindOfValue = (v: FlagValue): ValueKind => (v === true ? 'yes' : v === false ? 'no' : typeof v === 'number' ? 'number' : 'text');

/** A flag value: yes / no / a number / some text. */
export function ValueInput({ value, onChange }: { value: FlagValue; onChange: (v: FlagValue, typing?: boolean) => void }) {
  const kind = kindOfValue(value);
  return (
    <span class="value-input">
      <select
        value={kind}
        onChange={(e) => {
          const k = e.currentTarget.value as ValueKind;
          onChange(k === 'yes' ? true : k === 'no' ? false : k === 'number' ? 1 : '');
        }}
      >
        <option value="yes">yes</option>
        <option value="no">no</option>
        <option value="number">a number…</option>
        <option value="text">some text…</option>
      </select>
      {kind === 'number' && (
        <input type="number" class="num" value={value as number} onInput={(e) => onChange(Number(e.currentTarget.value) || 0, true)} />
      )}
      {kind === 'text' && <input class="short mono" value={value as string} onInput={(e) => onChange(e.currentTarget.value, true)} />}
    </span>
  );
}

/**
 * An id that's only changed when the designer is done typing (Enter or leaving the field), because renaming
 * updates other things. `check` returns why a name can't be used. `locked` explains why it can't be renamed at all.
 */
export function RenameField(props: {
  value: string;
  onRename: (next: string) => void;
  check: (next: string) => string | null;
  locked?: string;
  /** Short note next to a locked name (the full reason shows on hover). */
  lockLabel?: string;
  class?: string;
  autoFocus?: boolean;
}) {
  const [draft, setDraft] = useState(props.value);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => setDraft(props.value), [props.value]);
  useEffect(() => {
    if (props.autoFocus) ref.current?.select();
  }, [props.value]);
  const error = draft !== props.value ? props.check(draft) : null;
  const done = () => {
    if (draft === props.value) return;
    if (error) setDraft(props.value);
    else props.onRename(draft);
  };
  if (props.locked) {
    return (
      <span class={`rename locked ${props.class ?? ''}`} title={props.locked}>
        <span>{props.value}</span>
        <span class="lock">🔒 {props.lockLabel ?? 'name used by the map'}</span>
      </span>
    );
  }
  return (
    <span class="rename-wrap">
      <input
        ref={ref}
        class={`rename mono ${props.class ?? ''} ${error ? 'invalid' : ''}`}
        value={draft}
        spellcheck={false}
        onInput={(e) => setDraft(e.currentTarget.value.trim())}
        onBlur={done}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            setDraft(props.value);
            requestAnimationFrame(() => ref.current?.blur());
          }
        }}
      />
      {error && <span class="field-error">{error}</span>}
    </span>
  );
}

export function Card({ title, children, right, class: cls }: { title: ComponentChildren; children: ComponentChildren; right?: ComponentChildren; class?: string }) {
  return (
    <section class={`card ${cls ?? ''}`}>
      <header class="card-head">
        <h3>{title}</h3>
        {right}
      </header>
      {children}
    </section>
  );
}

/**
 * The innermost element matching `selector` that a click went through. Uses the click's original path, because
 * the clicked element may already be gone from the page by the time the click bubbles up (Preact re-renders in between).
 */
export function clickedIn(e: Event, selector: string): Element | null {
  for (const node of e.composedPath()) if (node instanceof Element && node.matches(selector)) return node;
  return null;
}

/** Renames a key in an object, keeping the order of the others. */
export function renameKey<T>(obj: Record<string, T>, from: string, to: string): Record<string, T> {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k === from ? to : k, v]));
}
