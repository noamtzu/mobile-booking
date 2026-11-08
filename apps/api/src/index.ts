import { serve } from '@hono/node-server';
import { createApp } from './app';
import { loadConfig } from './config';
import { createDb } from './db/client';
import { migrate } from './db/migrate';
import { consoleMailer } from './mailer';

const config = loadConfig();
const handle = createDb(config.databaseUrl);
await migrate(handle);

const app = createApp(
  {
    db: handle.db,
    mailer: consoleMailer,
    jwtSecret: config.jwtSecret,
    adminEmails: config.adminEmails,
    now: () => new Date(),
  },
  { corsOrigin: config.corsOrigin },
);

const server = serve({ fetch: app.fetch, port: config.port, hostname: '0.0.0.0' }, (info) => {
  console.log(`API listening on http://localhost:${info.port}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close();
    void handle.close().then(() => process.exit(0));
  });
}
