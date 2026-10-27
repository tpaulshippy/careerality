import { drizzle } from "drizzle-orm/d1";
import { createApp } from "./app";
import { schema, type AppDb } from "./db/client";
import type { Env } from "./env";

export type { AppDb };
export { createApp };

export default {
  fetch(request: Request, env: Env): Response | Promise<Response> {
    const db = drizzle(env.DB, { schema });
    return createApp(db, env).fetch(request, env);
  },
};
