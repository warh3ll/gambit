/** The tree editor's own state: the selected node, and the "Try a route" preview (a level and the picks so far). */
import { useEffect, useState } from 'preact/hooks';
import { getNav, onNav } from '../nav';

export interface TreeUi {
  /** Id of the selected node in the open tree. */
  node: string | null;
  /** "Try a route": on/off, the character's level, and the node picked on each tier so far. */
  route: { on: boolean; level: number; picks: string[] };
}

let ui: TreeUi = { node: null, route: { on: false, level: 4, picks: [] } };
const listeners = new Set<() => void>();

export function setTreeUi(patch: Partial<TreeUi>) {
  ui = { ...ui, ...patch };
  for (const l of listeners) l();
}
export const getTreeUi = () => ui;
export const selectNode = (node: string | null) => setTreeUi({ node });

export function useTreeUi(): TreeUi {
  const [, bump] = useState(0);
  useEffect(() => {
    const l = () => bump((n) => n + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  return ui;
}

// Another class (or tab) opened: forget the selection and the route.
let opened = `${getNav().tab}/${getNav().id}`;
onNav(() => {
  const now = `${getNav().tab}/${getNav().id}`;
  if (now === opened) return;
  opened = now;
  setTreeUi({ node: null, route: { ...ui.route, picks: [] } });
});
