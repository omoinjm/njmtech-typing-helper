import type { SiteAdapter } from './types';
import { collapse, findCharContainer, findInputTarget, progressIndex, readCells } from './dom-utils';

export interface GenericOptions {
  /** Narrow the search to this element (picked by the user, or from a site rule). */
  root?: () => Element | null;
  /** Selector for the element that receives keystrokes. */
  target?: string;
  name?: string;
}

/**
 * Heuristic adapter for any site that renders the passage as one element per
 * character. With a `root` that has no char spans, its plain text is typed
 * with an internal cursor.
 */
export function createGenericAdapter(opts: GenericOptions = {}): SiteAdapter {
  let container: Element | null = null;
  const root = () => opts.root?.() ?? null;
  const locate = () => {
    if (!container || !container.isConnected) {
      const r = root();
      container = findCharContainer(r ?? document.body, r ? 1 : 10);
    }
    return container;
  };

  return {
    id: 'generic',
    name: opts.name ?? 'Generic',
    target: () => (opts.target && document.querySelector<HTMLElement>(opts.target)) || findInputTarget(),
    remaining() {
      const c = locate();
      if (!c) return null;
      const cells = readCells(c);
      const idx = progressIndex(cells);
      if (idx === null) return null;
      return cells.slice(idx).map((x) => x.ch).join('');
    },
    snapshot() {
      const c = locate();
      if (c) return readCells(c).map((x) => x.ch).join('');
      const r = root();
      if (r) return collapse((r as HTMLElement).innerText ?? r.textContent ?? '') || null;
      return null;
    },
  };
}
