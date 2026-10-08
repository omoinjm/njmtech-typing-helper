import { Hono } from 'hono';
import type { AppEnv } from '../../http-context';
import { health } from './health';
import { sites } from './sites';

export const v1 = new Hono<AppEnv>();

v1.route('/health', health);
v1.route('/sites', sites);
