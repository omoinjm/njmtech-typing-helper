import type { TextSource } from '../engine/typer';

export interface SiteAdapter extends TextSource {
  id: string;
  name: string;
  /** Element that should hold focus / receive keystrokes. null → whatever is focused. */
  target(): HTMLElement | null;
  /** Site is known to ignore synthetic (isTrusted=false) key events. */
  prefersTrusted?: boolean;
}

export interface AdapterDefinition {
  id: string;
  name: string;
  matches(host: string): boolean;
  create(): SiteAdapter;
}

export const hostIs = (...domains: string[]) => (host: string) =>
  domains.some((d) => host === d || host.endsWith(`.${d}`));
