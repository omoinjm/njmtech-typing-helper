import type { Env } from './env';
import { StaticSiteRuleRepository, type SiteRuleRepository } from './repositories/site-rule-repository';

/**
 * The composition root: the one place concrete implementations get wired to
 * their abstractions. Route handlers only see the interfaces, via `c.get('deps')`.
 */
export interface Dependencies {
  siteRules: SiteRuleRepository;
}

export function buildDependencies(_env: Env): Dependencies {
  return { siteRules: new StaticSiteRuleRepository() };
}
