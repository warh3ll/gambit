/**
 * Dev-server side of the Gambit Editor (editor.html).
 *
 *   GET  /__editor/content  → every content file: { files: { story: { data, hash }, 'area:martaHouse': … } }
 *   POST /__editor/save     ← { files: { story: { data, base } } }  (base = the hash the editor loaded)
 *   GET  /__editor/git      → how uploading the last save to GitHub went (see editorGit.ts)
 *
 * Only these files can be read or written: story.json, npcs.json, trees.json, and the areas (src/data/areas/<id>.json, key
 * 'area:<id>'). Saving an area with `data: null` deletes its file; a new area is saved with base NO_FILE.
 * A save is refused (409) if a file changed on disk since the editor loaded it (e.g. edited by hand), so nothing
 * gets overwritten by accident.
 * Files are written as JSON laid out for reading: one event step per line where possible.
 * After a save, the content files are committed and pushed to GitHub (editorGit.ts).
 *
 * `apply: 'serve'`: this only exists on the dev server, never in the itch build.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { TILE_CHARS } from '../src/world/tiles.ts';
import { gitStatus, syncContent } from './editorGit.ts';

/** Content the editor may change: key → file (relative to the project root). */
const CONTENT_FILES: Record<string, string> = {
  story: 'src/data/story.json',
  npcs: 'src/data/npcs.json',
  trees: 'src/data/trees.json',
};
const AREA_DIR = 'src/data/areas';
const AREA_ID = /^[A-Za-z][A-Za-z0-9_]*$/;
/** The "hash" of a file that doesn't exist (yet). */
const NO_FILE = 'none';

/** The file for a content key, or null if the editor may not touch it. */
function fileOf(key: string): string | null {
  if (CONTENT_FILES[key]) return CONTENT_FILES[key];
  const id = key.startsWith('area:') ? key.slice(5) : '';
  return AREA_ID.test(id) ? `${AREA_DIR}/${id}.json` : null;
}

function allKeys(root: string): string[] {
  const areas = readdirSync(resolve(root, AREA_DIR))
    .filter((f) => f.endsWith('.json'))
    .map((f) => `area:${f.slice(0, -'.json'.length)}`);
  return [...Object.keys(CONTENT_FILES), ...areas];
}

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
    for (const key of allKeys(root)) {
      const text = readText(resolve(root, fileOf(key)!));
      files[key] = { data: JSON.parse(text ?? '{}'), hash: hash(text) };
    }
    return send(res, 200, { files });
  }

  if (req.method === 'POST' && path === '/save') {
    const body = JSON.parse(await readBody(req)) as { files?: Record<string, { data: unknown; base: string }> };
    const incoming = Object.entries(body.files ?? {});
    for (const [key, { data }] of incoming) {
      const file = fileOf(key);
      if (!file) return send(res, 400, { error: `unknown content file "${key}"` });
      if (data === null && !key.startsWith('area:')) return send(res, 400, { error: `${file} can't be deleted` });
      const problem = data === null ? null : checkShape(key, data);
      if (problem) return send(res, 400, { error: `${file}: ${problem}` });
    }
    // Check every file first, so a save either writes everything or nothing.
    const conflicts = incoming.filter(([key, { base }]) => hash(readText(resolve(root, fileOf(key)!))) !== base).map(([key]) => key);
    if (conflicts.length) return send(res, 409, { conflicts });

    const files: Record<string, { hash: string }> = {};
    for (const [key, { data }] of incoming) {
      const file = resolve(root, fileOf(key)!);
      if (data === null) {
        if (existsSync(file)) unlinkSync(file);
        files[key] = { hash: NO_FILE };
        continue;
      }
      const text = formatJson(data) + '\n';
      writeFileSync(file, text, 'utf8');
      files[key] = { hash: hash(text) };
    }
    syncContent(root);
    return send(res, 200, { files });
  }

  if (req.method === 'GET' && path === '/git') return send(res, 200, gitStatus());

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
    if (!isObj(data.newGame)) return '"newGame" must be an object';
  }
  if (key === 'npcs') {
    for (const [id, npc] of Object.entries(data)) {
      if (!isObj(npc) || typeof npc.name !== 'string' || !Array.isArray(npc.talk)) return `NPC "${id}" needs a name and talk steps`;
    }
  }
  if (key === 'trees') {
    if (!isObj(data.newActions) || !isObj(data.classes)) return '"newActions" and "classes" must be objects';
    for (const [id, tree] of Object.entries(data.classes)) {
      if (!isObj(tree) || !Array.isArray(tree.tiers) || tree.tiers.some((t) => !Array.isArray(t))) return `the tree of "${id}" needs a list of tiers`;
    }
  }
  if (key.startsWith('area:')) {
    const rows = data.tiles;
    if (!Array.isArray(rows) || !rows.length || typeof rows[0] !== 'string' || !rows[0].length) return 'the map needs tiles';
    for (const row of rows) {
      if (typeof row !== 'string' || row.length !== rows[0].length) return 'every map row must be the same length';
      for (const ch of row) if (!(ch in TILE_CHARS)) return `unknown map character "${ch}"`;
    }
    if (typeof data.name !== 'string') return 'the area needs a name';
    for (const list of ['exits', 'npcs', 'enemies', 'triggers']) if (!Array.isArray(data[list])) return `"${list}" must be a list`;
    if (!isObj(data.starts) || !isObj(data.encounters)) return '"starts" and "encounters" must be objects';
  }
  return null;
}

function readText(file: string): string | null {
  return existsSync(file) ? readFileSync(file, 'utf8') : null;
}

function hash(text: string | null) {
  return text === null ? NO_FILE : createHash('sha1').update(text.replace(/\r\n/g, '\n')).digest('hex');
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
