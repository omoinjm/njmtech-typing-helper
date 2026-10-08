import { createGenericAdapter } from './generic';
import { monkeytype } from './monkeytype';
import { tenFastFingers } from './tenfastfingers';
import { typeracer } from './typeracer';
import type { AdapterDefinition, SiteAdapter } from './types';
import { ruleFor, type SiteRule } from '../site-rules';

export const ADAPTERS: AdapterDefinition[] = [monkeytype, tenFastFingers, typeracer];

const hasText = (a: SiteAdapter) => !!(a.remaining() || a.snapshot());

/**
 * Order: user-picked element → built-in adapter (if it finds text) → remote
 * site rule from the Worker (covers sites whose markup changed under a
 * built-in adapter) → generic heuristics.
 */
export function pickAdapter(host: string, picked?: Element | null, rules: SiteRule[] = []): SiteAdapter {
  const rule = ruleFor(rules, host);
  if (picked) {
    return createGenericAdapter({ root: () => picked, target: rule?.target, name: 'Picked text area' });
  }
  for (const def of ADAPTERS) {
    if (!def.matches(host)) continue;
    const a = def.create();
    if (hasText(a)) return a;
  }
  const container = rule?.container;
  const generic = createGenericAdapter({
    root: container ? () => document.querySelector(container) : undefined,
    target: rule?.target,
    name: rule?.name,
  });
  generic.prefersTrusted = rule?.prefersTrusted;
  return generic;
}
