import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { HTTPException } from 'hono/http-exception';
import type { AppEnv } from './http-context';
import { buildDependencies } from './container';
import { v1 } from './routes/v1';

export const app = new Hono<AppEnv>();

app.use('*', secureHeaders());

// Read-only public data fetched from extension background workers, whose
// origin differs per browser and install — permissive CORS is fine.
app.use('*', cors({ origin: '*', allowMethods: ['GET', 'OPTIONS'] }));

app.use('*', async (c, next) => {
  c.set('deps', buildDependencies(c.env));
  await next();
});

app.get('/', (c) => c.json({ ok: true, service: 'typing-helper-api', api: '/api/v1' }));

app.route('/api/v1', v1);

app.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse();
  console.error('[unhandled]', err);
  return c.text('Internal Server Error', 500);
});

export default { fetch: app.fetch };
