/**
 * After every save in the Gambit Editor, the content files are committed and (on `main`) pushed to GitHub,
 * so the designer never has to do it by hand.
 *
 * - Only the editor's content files are committed (story, npcs, trees, the area JSON files); nothing else that
 *   happens to be changed or staged in the repo goes along.
 * - On another branch (Claude is working on something), the commit stays on that branch and reaches GitHub when the
 *   branch is merged into main.
 * - If the upload fails (no internet, GitHub down…), it is tried again every minute until it works.
 *
 * The editor asks GET /__editor/git for `GitStatus` to show how it went.
 */
import { execFile } from 'node:child_process';

/** Pathspecs of the editor's content files (no code: areas/index.ts and types.ts stay out). */
const CONTENT = ['src/data/story.json', 'src/data/npcs.json', 'src/data/trees.json', 'src/data/areas/*.json'];
const RETRY_MS = 60_000;

export interface GitStatus {
  /** idle: nothing happened yet. working: committing or uploading. done: on GitHub. local: committed on a branch
   *  that isn't main. failed: will be retried. */
  state: 'idle' | 'working' | 'done' | 'local' | 'failed';
  /** A few plain words for the editor's top bar. */
  text: string;
  /** More detail (shown on hover). */
  detail: string;
}

let status: GitStatus = { state: 'idle', text: '', detail: '' };
let running = false;
let again = false;
let retry: ReturnType<typeof setTimeout> | null = null;

export const gitStatus = () => status;

/** Commits the content files and pushes main. Calls made while one is running are folded into one more run. */
export function syncContent(root: string) {
  if (running) {
    again = true;
    return;
  }
  running = true;
  void (async () => {
    do {
      again = false;
      await syncOnce(root);
    } while (again);
    running = false;
  })();
}

async function syncOnce(root: string) {
  if (retry) clearTimeout(retry);
  retry = null;
  const set = (state: GitStatus['state'], text: string, detail = '') => (status = { state, text, detail });
  try {
    set('working', 'Uploading to GitHub…');
    await git(root, ['add', '-A', '--', ...CONTENT]);
    const changed = (await git(root, ['diff', '--cached', '--name-only', '--', ...CONTENT])).split('\n').filter(Boolean);
    if (changed.length) await git(root, ['commit', '-q', '-m', commitMessage(changed), '--', ...CONTENT]);

    const branch = await git(root, ['rev-parse', '--abbrev-ref', 'HEAD']);
    if (branch !== 'main') {
      set('local', 'Saved (GitHub after merge)', `Claude is working on the branch “${branch}”. Your save is kept there and goes to GitHub when that branch is merged into main.`);
      return;
    }
    await git(root, ['push', '-q', 'origin', 'main']);
    set('done', 'On GitHub ✓', `Saved and uploaded to GitHub at ${new Date().toLocaleTimeString()}.`);
  } catch (err) {
    const why = err instanceof Error ? err.message : String(err);
    set('failed', 'Not on GitHub yet, retrying', `Your work is saved on this computer, but uploading it failed (no internet?). Trying again every minute.\n\n${why}`);
    retry = setTimeout(() => syncContent(root), RETRY_MS);
  }
}

/** "Editor save: events, map barrelsbyRoad". */
function commitMessage(files: string[]): string {
  const words = files.map((f) => {
    if (f.endsWith('story.json')) return 'events';
    if (f.endsWith('npcs.json')) return 'NPCs';
    if (f.endsWith('trees.json')) return 'class trees';
    const area = /areas\/(.+)\.json$/.exec(f);
    return area ? `map ${area[1]}` : f;
  });
  return `Editor save: ${[...new Set(words)].join(', ')}`;
}

function git(root: string, args: string[]): Promise<string> {
  return new Promise((ok, fail) => {
    execFile(
      'git',
      args,
      // Never wait for a password prompt nobody can see.
      { cwd: root, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }, timeout: 60_000, windowsHide: true },
      (err, stdout, stderr) => (err ? fail(new Error((stderr || err.message).trim())) : ok(stdout.trim())),
    );
  });
}
