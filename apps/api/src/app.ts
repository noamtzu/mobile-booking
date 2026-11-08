import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { requireAuth } from './auth';
import { HttpError } from './errors';
import { adminRoutes } from './routes/admin';
import { authRoutes } from './routes/auth';
import { bookingRoutes } from './routes/bookings';
import { serviceRoutes } from './routes/services';
import type { AppEnv, Deps } from './types';

export function createApp(deps: Deps, options: { corsOrigin?: string } = {}) {
  const app = new Hono<AppEnv>();

  app.use('*', cors({ origin: options.corsOrigin ?? '*', allowHeaders: ['Content-Type', 'Authorization'] }));

  app.get('/health', (c) => c.json({ ok: true }));
  app.route('/auth', authRoutes(deps));
  app.route('/services', serviceRoutes(deps));

  const authed = new Hono<AppEnv>();
  authed.use('*', requireAuth(deps));
  authed.route('/bookings', bookingRoutes(deps));
  authed.route('/admin', adminRoutes(deps));
  app.route('/', authed);

  app.notFound((c) => c.json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }, 404));

  app.onError((err, c) => {
    if (err instanceof HttpError) {
      return c.json({ error: { code: err.code, message: err.message } }, err.status);
    }
    if (err instanceof HTTPException) {
      return c.json({ error: { code: 'INTERNAL', message: err.message } }, err.status);
    }
    console.error(err);
    return c.json({ error: { code: 'INTERNAL', message: 'Something went wrong' } }, 500);
  });

  return app;
}

export type App = ReturnType<typeof createApp>;
