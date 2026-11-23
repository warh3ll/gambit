/**
 * Dev-server side of the Gambit Editor (editor.html).
 *
 *   GET  /__editor/content  → every content file: { files: { story: { data, hash }, … } }
 *   POST /__editor/save     ← { files: { story: { data, base } } }  (base = the hash the editor loaded)
 *
 * Only the files listed in CONTENT_FILES can be read or written. A save is refused (409) if a file changed on
 * disk since the editor loaded it (e.g. edited by hand), so nothing gets overwritten by accident.
 * Files are written as JSON laid out for reading: one event step per line where possible.
 *
 * `apply: 'serve'`: this only exists on the dev server, never in the itch build.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';

/** Content the editor may change: key → file (relative to the project root). */
const CONTENT_FILES: Record<string, string> = {
  story: 'src/data/story.json',
  npcs: 'src/data/npcs.json',
};

export function editorPlugin(): Plugin {
  let root = process.cwd();
  return {
    name: 'gambit-editor',
    apply: 'serve',
    configResolved(config) {
      root = config.root;
    },
    configureServer(server) {
      server.middlewares.use('/__editor', (req, res) => {
        handle(root, req, res).catch((err: unknown) => {
          send(res, 500, { error: err instanceof Error ? err.message : String(err) });
        });
      });
    },
  };
}

async function handle(root: string, req: IncomingMessage, res: ServerResponse) {
  const path = (req.url ?? '').split('?')[0];
  if (req.method === 'GET' && path === '/content') {
    const files: Record<string, { data: unknown; hash: string }> = {};
    for (const [key, file] of Object.entries(CONTENT_FILES)) {
      const text = readText(resolve(root, file));
      files[key] = { data: JSON.parse(text), hash: hash(text) };
    }
    return send(res, 200, { files });
  }

  if (req.method === 'POST' && path === '/save') {
    const body = JSON.parse(await readBody(req)) as { files?: Record<string, { data: unknown; base: string }> };
    const incoming = Object.entries(body.files ?? {});
    for (const [key, { data }] of incoming) {
      if (!CONTENT_FILES[key]) return send(res, 400, { error: `unknown content file "${key}"` });
      const problem = checkShape(key, data);
      if (problem) return send(res, 400, { error: `${CONTENT_FILES[key]}: ${problem}` });
    }
    // Check every file first, so a save either writes everything or nothing.
    const conflicts = incoming
      .filter(([key, { base }]) => hash(readText(resolve(root, CONTENT_FILES[key]))) !== base)
      .map(([key]) => key);
    if (conflicts.length) return send(res, 409, { conflicts });

    const files: Record<string, { hash: string }> = {};
    for (const [key, { data }] of incoming) {
      const text = formatJson(data) + '\n';
      writeFileSync(resolve(root, CONTENT_FILES[key]), text, 'utf8');
      files[key] = { hash: hash(text) };
    }
    return send(res, 200, { files });
  }

  send(res, 404, { error: 'not found' });
}

/** A light sanity check so a broken editor can't write something the game can't load. */
function checkShape(key: string, data: unknown): string | null {
  const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
  if (!isObj(data)) return 'expected an object';
  if (key === 'story') {
    if (!isObj(data.events)) return '"events" must be an object';
    for (const [id, steps] of Object.entries(data.events)) if (!Array.isArray(steps)) return `event "${id}" must be a list of steps`;
    if (!isObj(data.speakers)) return '"speakers" must be an object';
    if (!isObj(data.endScreen)) return '"endScreen" must be an object';
  }
  if (key === 'npcs') {
    for (const [id, npc] of Object.entries(data)) {
      if (!isObj(npc) || typeof npc.name !== 'string' || !Array.isArray(npc.talk)) return `NPC "${id}" needs a name and talk steps`;
    }
  }
  return null;
}

function readText(file: string) {
  return existsSync(file) ? readFileSync(file, 'utf8') : '{}';
}

function hash(text: string) {
  return createHash('sha1').update(text.replace(/\r\n/g, '\n')).digest('hex');
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((ok, fail) => {
    let s = '';
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => (s += chunk));
    req.on('end', () => ok(s));
    req.on('error', fail);
  });
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

// ── JSON layout ──

const isPrimitive = (v: unknown) => v === null || typeof v !== 'object';

/** One line: `{ "do": "say", "text": "Hi" }`. */
function inline(v: unknown): string {
  if (isPrimitive(v)) return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(inline).join(', ')}]`;
  const entries = Object.entries(v as object).filter(([, x]) => x !== undefined);
  return entries.length ? `{ ${entries.map(([k, x]) => `${JSON.stringify(k)}: ${inline(x)}`).join(', ')} }` : '{}';
}

/**
 * Pretty JSON that keeps small things on one line: objects with only plain values (an event step like `say`)
 * always fit on one line, however long their text; anything else goes on one line if it's short.
 */
export function formatJson(v: unknown, indent = ''): string {
  if (isPrimitive(v)) return JSON.stringify(v);
  const one = inline(v);
  const values = Array.isArray(v) ? v : Object.values(v as object);
  if (values.length === 0) return one;
  if (values.every(isPrimitive) && (!Array.isArray(v) || indent.length + one.length <= 110)) return one;
  if (indent.length + one.length <= 80 && !values.some((x) => Array.isArray(x) && x.length > 1)) return one;
  const inner = indent + '  ';
  const lines = Array.isArray(v)
    ? v.map((x) => inner + formatJson(x, inner))
    : Object.entries(v as object)
        .filter(([, x]) => x !== undefined)
        .map(([k, x]) => `${inner}${JSON.stringify(k)}: ${formatJson(x, inner)}`);
  const [open, close] = Array.isArray(v) ? ['[', ']'] : ['{', '}'];
  return `${open}\n${lines.join(',\n')}\n${indent}${close}`;
}
