import { storage } from 'wxt/utils/storage';
import { API_URL } from './config';
import { hostIs } from './adapters/types';

/** Mirrors SiteRule in apps/worker/src/env.ts. */
export interface SiteRule {
  hosts: string[];
  name: string;
  container?: string;
  target?: string;
  prefersTrusted?: boolean;
}

interface CachedRules {
  version: string;
  fetchedAt: number;
  rules: SiteRule[];
}

export const REFRESH_MINUTES = 360;

export const siteRulesItem = storage.defineItem<CachedRules | null>('local:siteRules', { fallback: null });

export function ruleFor(rules: SiteRule[], host: string): SiteRule | undefined {
  return rules.find((r) => hostIs(...r.hosts)(host));
}

/** Fetch rules from the Worker; on any failure keep whatever is cached (the extension works offline without them). */
export async function refreshSiteRules(fetchImpl: typeof fetch = fetch): Promise<boolean> {
  try {
    const res = await fetchImpl(`${API_URL}/sites`);
    if (!res.ok) return false;
    const body = (await res.json()) as { version: string; rules: SiteRule[] };
    if (!Array.isArray(body.rules)) return false;
    await siteRulesItem.setValue({ version: body.version, fetchedAt: Date.now(), rules: body.rules });
    return true;
  } catch (err) {
    console.warn('[typing-helper] site rules refresh failed:', err);
    return false;
  }
}
