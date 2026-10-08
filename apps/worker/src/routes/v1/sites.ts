import { Hono } from 'hono';
import type { AppEnv } from '../../http-context';

export const sites = new Hono<AppEnv>();

// Public and identical for every client, so let browsers and Cloudflare's
// edge cache it; the extension only refreshes every few hours anyway.
sites.get('/', async (c) => {
  const repo = c.get('deps').siteRules;
  c.header('Cache-Control', 'public, max-age=900');
  return c.json({ version: repo.version(), rules: await repo.list() });
});
