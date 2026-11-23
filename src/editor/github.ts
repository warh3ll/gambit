/**
 * Whether the last save reached GitHub. The dev server commits and pushes after every save (tools/editorGit.ts);
 * this asks it how that went, quickly while it's busy and now and then otherwise.
 */
import { useEffect, useState } from 'preact/hooks';

export interface GitStatus {
  state: 'idle' | 'working' | 'done' | 'local' | 'failed';
  text: string;
  detail: string;
}

let status: GitStatus = { state: 'idle', text: '', detail: '' };
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;

async function poll() {
  if (timer) clearTimeout(timer);
  try {
    const res = await fetch('/__editor/git', { cache: 'no-store' });
    if (res.ok) {
      const next = (await res.json()) as GitStatus;
      if (JSON.stringify(next) !== JSON.stringify(status)) {
        status = next;
        for (const l of listeners) l();
      }
    }
  } catch {
    // The dev server is restarting; ask again later.
  }
  timer = setTimeout(poll, status.state === 'working' ? 1000 : 15_000);
}

/** Call after a save: the upload has just started. */
export const checkGithubSoon = () => void setTimeout(poll, 300);

export function useGithub(): GitStatus {
  const [, bump] = useState(0);
  useEffect(() => {
    const l = () => bump((n) => n + 1);
    listeners.add(l);
    if (listeners.size === 1) void poll();
    return () => void listeners.delete(l);
  }, []);
  return status;
}
