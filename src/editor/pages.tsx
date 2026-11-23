/** The editor's pages: the lists on the left, and the page for whatever is open. */
import { useState } from 'preact/hooks';
import type { Step } from '../game/script';
import { go, useNav } from './nav';
import { StepEditor } from './StepList';
import { ID_PATTERN, freshId, hex, speakers, stepText } from './steps';
import { type Content, allOwners, commit, useStore, walkSteps } from './store';
import { renameEventRefs, renameNpcRefs } from './map/edit';
import { MapPage } from './map/MapPanels';
import { AutoText, Headshot, NpcSprite, RenameField, renameKey } from './ui';
import type { Problem } from './validate';
import { WORLD, eventUses, npcAreas } from './world';

export const END_SCREEN_ID = '~endScreen';

// ── lists ──

export function Sidebar({ problems }: { problems: Problem[] }) {
  const nav = useNav();
  const [query, setQuery] = useState('');
  if (nav.tab === 'events') return <EventList query={query} setQuery={setQuery} problems={problems} />;
  if (nav.tab === 'npcs') return <NpcList query={query} setQuery={setQuery} problems={problems} />;
  return null;
}

function Search({ query, setQuery, placeholder }: { query: string; setQuery: (q: string) => void; placeholder: string }) {
  return <input class="search" type="search" placeholder={placeholder} value={query} onInput={(e) => setQuery(e.currentTarget.value)} />;
}

/** The first line in `steps` containing `q`, for search results. */
function findText(steps: Step[], q: string): string | null {
  let hit: string | null = null;
  walkSteps(steps, (s) => {
    const t = stepText(s);
    if (!hit && t.toLowerCase().includes(q)) hit = t;
  });
  return hit;
}

function problemCount(problems: Problem[], kind: 'event' | 'npc', id: string) {
  const mine = problems.filter((p) => p.owner?.kind === kind && p.owner.id === id);
  return mine.some((p) => p.level === 'error') ? 'error' : mine.length ? 'warning' : null;
}

function EventList({ query, setQuery, problems }: { query: string; setQuery: (q: string) => void; problems: Problem[] }) {
  const { content } = useStore();
  const nav = useNav();
  const q = query.trim().toLowerCase();
  const items = Object.entries(content.story.events)
    .map(([id, steps]) => ({ id, hit: q && !id.toLowerCase().includes(q) ? findText(steps, q) : null }))
    .filter((x) => !q || x.id.toLowerCase().includes(q) || x.hit);
  const add = () => {
    const id = freshId('newEvent', (x) => x in content.story.events);
    commit((c) => (c.story.events[id] = []));
    setQuery('');
    go('events', id);
  };
  return (
    <nav class="sidebar">
      <Search query={query} setQuery={setQuery} placeholder="Search events and lines…" />
      <div class="list">
        {items.map(({ id, hit }) => {
          const uses = eventUses(id);
          const flag = problemCount(problems, 'event', id);
          return (
            <button key={id} class={`item ${nav.id === id ? 'active' : ''}`} onClick={() => go('events', id)}>
              <span class="item-title mono">
                {id}
                {flag && <span class={`dot ${flag}`} />}
              </span>
              <span class="item-sub">{hit ? `“${hit}”` : (uses[0]?.short ?? 'Never plays')}</span>
            </button>
          );
        })}
        {!items.length && <p class="muted pad">Nothing matches.</p>}
      </div>
      <button class="new" onClick={add}>
        + New event
      </button>
      <div class="list extra">
        <button class={`item ${nav.id === END_SCREEN_ID ? 'active' : ''}`} onClick={() => go('events', END_SCREEN_ID)}>
          <span class="item-title">End screen</span>
          <span class="item-sub">Shown when the game ends</span>
        </button>
      </div>
    </nav>
  );
}

function NpcList({ query, setQuery, problems }: { query: string; setQuery: (q: string) => void; problems: Problem[] }) {
  const { content } = useStore();
  const nav = useNav();
  const q = query.trim().toLowerCase();
  const items = Object.entries(content.npcs)
    .map(([id, n]) => ({ id, n, hit: q && !`${id} ${n.name}`.toLowerCase().includes(q) ? findText(n.talk, q) : null }))
    .filter((x) => !q || `${x.id} ${x.n.name}`.toLowerCase().includes(q) || x.hit);
  const add = () => {
    const id = freshId('newNpc', (x) => speakers(content).some((s) => s.id === x));
    commit((c) => (c.npcs[id] = { name: 'New NPC', color: '#8a9a6a', talk: [{ do: 'say', speaker: id, text: '' }] }));
    setQuery('');
    go('npcs', id);
  };
  return (
    <nav class="sidebar">
      <Search query={query} setQuery={setQuery} placeholder="Search NPCs and lines…" />
      <div class="list">
        {items.map(({ id, n, hit }) => {
          const areas = npcAreas(id);
          const flag = problemCount(problems, 'npc', id);
          return (
            <button key={id} class={`item with-icon ${nav.id === id ? 'active' : ''}`} onClick={() => go('npcs', id)}>
              <NpcSprite id={id} color={hex(n.color)} scale={2} />
              <span class="item-text">
                <span class="item-title">
                  {n.name}
                  {flag && <span class={`dot ${flag}`} />}
                </span>
                <span class="item-sub">{hit ? `“${hit}”` : areas.length ? areas.map((a) => a.name).join(', ') : 'Not on a map'}</span>
              </span>
            </button>
          );
        })}
      </div>
      <button class="new" onClick={add}>
        + New NPC
      </button>
    </nav>
  );
}

// ── pages ──

export function Page({ onTest }: { onTest: () => void }) {
  const nav = useNav();
  const { content } = useStore();
  if (nav.tab === 'speakers') return <SpeakersPage />;
  if (nav.tab === 'map') return <MapPage />;
  if (nav.tab === 'events') {
    if (nav.id === END_SCREEN_ID) return <EndScreenPage />;
    if (nav.id && content.story.events[nav.id]) return <EventPage id={nav.id} onTest={onTest} />;
    return <Empty text="Pick an event on the left, or make a new one." />;
  }
  if (nav.id && content.npcs[nav.id]) return <NpcPage id={nav.id} onTest={onTest} />;
  return <Empty text="Pick an NPC on the left, or make a new one." />;
}

function Empty({ text }: { text: string }) {
  return <div class="empty-page muted">{text}</div>;
}

const idProblem = (next: string, taken: boolean) =>
  !next ? 'Needs a name.' : !ID_PATTERN.test(next) ? 'Letters, digits and _ only, starting with a letter.' : taken ? 'That name is taken.' : null;

function EventPage({ id, onTest }: { id: string; onTest: () => void }) {
  const { content } = useStore();
  const steps = content.story.events[id];
  const uses = eventUses(id);
  const locked = id === 'intro' ? 'The game plays “intro” when a new game starts, so it keeps this name.' : undefined;
  const rename = (next: string) => {
    commit((c) => {
      c.story.events = renameKey(c.story.events, id, next);
      renameEventRefs(c, id, next); // map triggers, fights and arrivals follow
    });
    go('events', next);
  };
  const remove = () => {
    const warn = uses.length ? `\n\nThe map still uses it (${uses.map((u) => u.text).join('; ')}); that will show as a problem.` : '';
    if (!confirm(`Delete the event “${id}”?${warn}`)) return;
    commit((c) => delete c.story.events[id]);
    go('events');
  };
  const duplicate = () => {
    const copy = freshId(`${id}Copy`, (x) => x in content.story.events);
    commit((c) => (c.story.events = insertAfter(c.story.events, id, copy, structuredClone(steps))));
    go('events', copy);
  };
  return (
    <div class="page">
      <header class="page-head">
        <div class="page-title">
          <span class="kicker">Event</span>
          <RenameField
            value={id}
            class="title-input"
            locked={locked}
            lockLabel={id === 'intro' ? 'name the game looks for' : undefined}
            autoFocus={id.startsWith('newEvent')}
            check={(n) => idProblem(n, n in content.story.events)}
            onRename={rename}
          />
        </div>
        <div class="page-actions">
          <button class="primary" onClick={onTest}>
            ▶ Test in game
          </button>
          <button onClick={duplicate}>Duplicate</button>
          <button class="danger" onClick={remove} disabled={id === 'intro'}>
            Delete
          </button>
        </div>
      </header>
      <div class="uses">
        {uses.length ? (
          uses.map((u) => (
            <span class="chip" key={u.text}>
              {u.text}
            </span>
          ))
        ) : (
          <span class="chip warn">Never plays yet: on the Map tab, draw a story trigger for it, or play it after a fight or on arrival.</span>
        )}
      </div>
      <StepEditor owner={{ kind: 'event', id }} steps={steps} />
    </div>
  );
}

function insertAfter<T>(obj: Record<string, T>, after: string, key: string, value: T): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = v;
    if (k === after) out[key] = value;
  }
  return out;
}

/** Points every line spoken by `from` at `to` instead (after renaming a speaker). */
function renameSpeaker(c: Content, from: string, to: string) {
  for (const { steps } of allOwners(c)) {
    walkSteps(steps, (s) => {
      if ((s.do === 'say' || s.do === 'choice') && s.speaker === from) s.speaker = to;
    });
  }
}

function speakerUses(c: Content, id: string) {
  let n = 0;
  for (const { steps } of allOwners(c)) walkSteps(steps, (s) => (s.do === 'say' || s.do === 'choice') && s.speaker === id && n++);
  return n;
}

const speakerTaken = (c: Content, next: string) => speakers(c).some((s) => s.id === next);

function NpcPage({ id, onTest }: { id: string; onTest: () => void }) {
  const { content } = useStore();
  const npc = content.npcs[id];
  const areas = npcAreas(id);
  const rename = (next: string) => {
    commit((c) => {
      c.npcs = renameKey(c.npcs, id, next);
      renameSpeaker(c, id, next);
      renameNpcRefs(c, id, next); // where they stand on the maps
    });
    go('npcs', next);
  };
  const remove = () => {
    const lines = speakerUses(content, id);
    const warn = [areas.length && `${areas.map((a) => a.name).join(', ')} still places them on the map`, lines && `${lines} line(s) are spoken by them`]
      .filter(Boolean)
      .join(', and ');
    if (!confirm(`Delete ${npc.name}?${warn ? `\n\n${warn}; those will show as problems.` : ''}`)) return;
    commit((c) => delete c.npcs[id]);
    go('npcs');
  };
  return (
    <div class="page">
      <header class="page-head">
        <div class="page-title with-art">
          <Headshot id={id} color={hex(npc.color)} size={80} />
          <NpcSprite id={id} color={hex(npc.color)} scale={4} />
          <div>
            <span class="kicker">NPC</span>
            <input class="title-input plain" value={npc.name} onInput={(e) => commit((c) => (c.npcs[id].name = e.currentTarget.value), `npc/${id}/name`)} />
          </div>
        </div>
        <div class="page-actions">
          <button class="primary" onClick={onTest}>
            ▶ Test in game
          </button>
          <button class="danger" onClick={remove}>
            Delete
          </button>
        </div>
      </header>
      <div class="fields">
        <label>
          <span>Id</span>
          <RenameField
            value={id}
            autoFocus={id.startsWith('newNpc')}
            check={(n) => idProblem(n, speakerTaken(content, n))}
            onRename={rename}
          />
        </label>
        <label>
          <span>Look</span>
          <input type="color" value={npc.color} onInput={(e) => commit((c) => (c.npcs[id].color = e.currentTarget.value), `npc/${id}/color`)} />
          <span class="muted small">placeholder colour, until real art (src/data/art.ts)</span>
        </label>
        <label>
          <span>Stands in</span>
          {areas.length ? (
            <span>
              {areas.map((a, i) => (
                <>
                  {i > 0 && ', '}
                  <a key={a.id} href={`#map/${a.id}`}>
                    {a.name}
                  </a>
                </>
              ))}
            </span>
          ) : (
            <span class="muted">Not on any map yet. Place them with the NPC tool on the Map tab.</span>
          )}
        </label>
      </div>
      <h2 class="section">Conversation</h2>
      <p class="muted small">Plays each time the player talks to {npc.name}.</p>
      <StepEditor owner={{ kind: 'npc', id }} steps={npc.talk} />
    </div>
  );
}

function SpeakersPage() {
  const { content } = useStore();
  const others = Object.entries(content.story.speakers);
  const add = () => {
    const id = freshId('newSpeaker', (x) => speakerTaken(content, x));
    commit((c) => (c.story.speakers[id] = { name: 'New speaker', color: '#8a82a0' }));
  };
  return (
    <div class="page wide">
      <header class="page-head">
        <div class="page-title">
          <span class="kicker">Who can speak</span>
          <h1>Speakers</h1>
        </div>
      </header>
      <p class="muted">
        Anyone in a Line or Choice: the party, the NPCs, and other speakers who aren't standing around to be clicked (like the Stranger).
        Each has a headshot for the dialogue box; real art replaces the placeholder via src/data/art.ts (key <code>headshot-&lt;id&gt;</code>).
      </p>

      <h2 class="section">Other speakers</h2>
      <table class="table">
        <thead>
          <tr>
            <th />
            <th>Name</th>
            <th>Id</th>
            <th>Look</th>
            <th>Lines</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {others.map(([id, s]) => (
            <tr key={id}>
              <td>
                <Headshot id={id} color={hex(s.color)} size={40} />
              </td>
              <td>
                <input value={s.name} onInput={(e) => commit((c) => (c.story.speakers[id].name = e.currentTarget.value), `spk/${id}/name`)} />
              </td>
              <td>
                <RenameField
                  value={id}
                  check={(n) => idProblem(n, speakerTaken(content, n))}
                  onRename={(next) =>
                    commit((c) => {
                      c.story.speakers = renameKey(c.story.speakers, id, next);
                      renameSpeaker(c, id, next);
                    })
                  }
                />
              </td>
              <td>
                <input type="color" value={s.color} onInput={(e) => commit((c) => (c.story.speakers[id].color = e.currentTarget.value), `spk/${id}/color`)} />
              </td>
              <td class="muted">{speakerUses(content, id)}</td>
              <td>
                <button
                  class="danger small"
                  onClick={() => {
                    const n = speakerUses(content, id);
                    if (n && !confirm(`${s.name} speaks ${n} line(s). Delete anyway? Those lines will show as problems.`)) return;
                    commit((c) => delete c.story.speakers[id]);
                  }}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button class="new inline" onClick={add}>
        + Add speaker
      </button>

      <h2 class="section">NPCs</h2>
      <div class="speaker-grid">
        {Object.entries(content.npcs).map(([id, n]) => (
          <button class="speaker-tile" key={id} onClick={() => go('npcs', id)}>
            <Headshot id={id} color={hex(n.color)} size={40} />
            <span>
              {n.name}
              <span class="muted small mono">{id}</span>
            </span>
          </button>
        ))}
      </div>

      <h2 class="section">Party</h2>
      <div class="speaker-grid">
        {WORLD.party.map((p) => (
          <div class="speaker-tile" key={p.id}>
            <Headshot id={p.id} color={p.color} size={40} />
            <span>
              {p.name}
              <span class="muted small mono">{p.id}</span>
            </span>
          </div>
        ))}
      </div>
      <p class="muted small">Party members are set up in src/data/party.ts.</p>
    </div>
  );
}

function EndScreenPage() {
  const { content } = useStore();
  const end = content.story.endScreen;
  return (
    <div class="page">
      <header class="page-head">
        <div class="page-title">
          <span class="kicker">Text</span>
          <h1>End screen</h1>
        </div>
      </header>
      <p class="muted">Shown after an “End game” step.</p>
      <div class="fields">
        <label>
          <span>Title</span>
          <input value={end.title} onInput={(e) => commit((c) => (c.story.endScreen.title = e.currentTarget.value), 'end/title')} />
        </label>
        <label>
          <span>Text</span>
          <AutoText value={end.text} onInput={(v) => commit((c) => (c.story.endScreen.text = v), 'end/text')} />
        </label>
      </div>
      <div class="end-preview">
        <div class="end-title">{end.title}</div>
        <div class="end-text">{end.text}</div>
      </div>
    </div>
  );
}
