import type { SiteRule } from '../env';
import { SITE_RULES, SITE_RULES_VERSION } from '../data/site-rules';

export interface SiteRuleRepository {
  version(): string;
  list(): Promise<SiteRule[]>;
}

/** Rules bundled with the Worker. Swap for a KV/D1-backed repository if they need editing without a deploy. */
export class StaticSiteRuleRepository implements SiteRuleRepository {
  version() {
    return SITE_RULES_VERSION;
  }

  async list() {
    return SITE_RULES;
  }
}
