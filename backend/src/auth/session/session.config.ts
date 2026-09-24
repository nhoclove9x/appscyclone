import type { RequestHandler } from "express";
import type { Pool } from "pg";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";

import type { Environment } from "../../config/environment";

export interface SessionMiddlewareOptions {
  readonly environment: Environment;
  readonly pool: Pool;
}

export function createSessionMiddleware({
  environment,
  pool,
}: SessionMiddlewareOptions): RequestHandler {
  const PgSessionStore = connectPgSimple(session);
  const ttlMilliseconds = environment.SESSION_TTL_SECONDS * 1000;

  return session({
    cookie: {
      httpOnly: true,
      maxAge: ttlMilliseconds,
      path: "/",
      sameSite: "lax",
      secure: environment.NODE_ENV === "production",
    },
    name: environment.SESSION_COOKIE_NAME,
    resave: false,
    rolling: false,
    saveUninitialized: false,
    secret: environment.SESSION_SECRET,
    store: new PgSessionStore({
      pool,
      tableName: "session",
      createTableIfMissing: false,
    }),
  });
}
