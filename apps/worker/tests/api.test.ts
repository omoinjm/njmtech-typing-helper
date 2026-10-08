import { describe, expect, it } from 'vitest';
import { app } from '../src/index';

describe('typing-helper-api', () => {
  it('reports health', async () => {
    const res = await app.request('/api/v1/health', {}, {});
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, service: 'typing-helper-api' });
  });

  it('serves cacheable site rules with CORS', async () => {
    const res = await app.request('/api/v1/sites', { headers: { Origin: 'chrome-extension://abc' } }, {});
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('cache-control')).toContain('max-age');
    const body = (await res.json()) as { version: string; rules: { hosts: string[] }[] };
    expect(body.version).toBeTruthy();
    expect(body.rules.some((r) => r.hosts.includes('monkeytype.com'))).toBe(true);
  });

  it('404s unknown routes', async () => {
    expect((await app.request('/api/v1/nope', {}, {})).status).toBe(404);
  });
});
