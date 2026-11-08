import { loadConfig } from '../config';
import { createDb } from './client';
import { migrate } from './migrate';

const config = loadConfig();
const handle = createDb(config.databaseUrl);
const ran = await migrate(handle);
console.log(ran.length ? `Applied: ${ran.join(', ')}` : 'Database is up to date.');
await handle.close();
