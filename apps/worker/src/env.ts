/**
 * Bindings declared in wrangler.toml. None yet — site rules ship with the
 * Worker code (src/data/site-rules.ts), so fixing a broken selector is a
 * redeploy rather than an extension store release.
 */
export interface Env {}

/**
 * How the extension should handle one typing site when its built-in adapter
 * can't find the passage. Mirrors SiteRule in apps/extension/src/site-rules.ts.
 */
export interface SiteRule {
  /** Hostnames this rule applies to; subdomains match too. */
  hosts: string[];
  name: string;
  /** CSS selector for the element containing the passage. */
  container?: string;
  /** CSS selector for the element that receives keystrokes. */
  target?: string;
  /** Site ignores synthetic (isTrusted=false) key events. */
  prefersTrusted?: boolean;
}
