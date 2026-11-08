import type { Role } from '@booking/shared';
import type { Database } from './db/client';
import type { Mailer } from './mailer';

export interface Deps {
  db: Database;
  mailer: Mailer;
  jwtSecret: string;
  adminEmails: string[];
  /** Injectable clock so tests can control "now". */
  now: () => Date;
}

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}

export interface AppEnv {
  Variables: { user: AuthUser };
}
