/**
 * What's open in the editor: the tab, the item in it, and the selected step. Kept in the address bar
 * (#events/intro), so a reload or the browser's back button returns to the same place.
 */
import { useEffect, useState } from 'preact/hooks';
import type { ListPath, Owner } from './store';

export type Tab = 'events' | 'npcs' | 'speakers' | 'map';
export interface SelectedStep {
  owner: Owner;
  path: ListPath;
  index: number;
}
interface Nav {
  tab: Tab;
  id: string | null;
  step: SelectedStep | null;
}

const TABS: Tab[] = ['events', 'npcs', 'speakers', 'map'];

function fromHash(): Nav {
  const [tab, id] = decodeURIComponent(location.hash.slice(1)).split('/');
  return { tab: TABS.includes(tab as Tab) ? (tab as Tab) : 'events', id: id || null, step: null };
}

let nav: Nav = fromHash();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

window.addEventListener('hashchange', () => {
  const next = fromHash();
  if (next.tab !== nav.tab || next.id !== nav.id) {
    nav = next;
    notify();
  }
});

export function useNav(): Nav {
  const [, bump] = useState(0);
  useEffect(() => {
    const l = () => bump((n) => n + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  return nav;
}
export const getNav = () => nav;

/** Opens a tab (and an item in it). */
export function go(tab: Tab, id: string | null = null, step: SelectedStep | null = null) {
  nav = { tab, id, step };
  const hash = `#${tab}${id ? `/${encodeURIComponent(id)}` : ''}`;
  if (location.hash !== hash) history.pushState(null, '', hash);
  notify();
  if (step) requestAnimationFrame(() => document.querySelector('.step.selected')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
}

/** Opens the page for a step list's owner. */
export const goOwner = (owner: Owner, step: SelectedStep | null = null) => go(owner.kind === 'event' ? 'events' : 'npcs', owner.id, step);

export function selectStep(step: SelectedStep | null) {
  nav = { ...nav, step };
  notify();
}
