import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type Client } from "@libsql/client";
import { drizzle as drizzleLibsql } from "drizzle-orm/libsql";
import { createApp } from "../src/app";
import { schema, type AppDb } from "../src/db/client";
import type { Env } from "../src/env";

export const testEnv: Env = {
  DB: null as never,
  CORS_ORIGINS: "https://careerality.app",
  TYPESAFE_API_BASE: "https://api.typesafe.test",
  JEV_MODEL: "jev-latest",
};

export async function createTestDb(): Promise<{ db: AppDb; client: Client }> {
  const client = createClient({ url: ":memory:" });
  const sql = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../migrations/0001_init.sql"),
    "utf8",
  );
  await client.executeMultiple(sql);
  const db = drizzleLibsql(client, { schema }) as unknown as AppDb;
  return { db, client };
}

export function testApp(db: AppDb, env: Env = testEnv) {
  return createApp(db, env);
}

// Response.json() is typed unknown under workers-types; tests want `any`.
export async function body(res: Response): Promise<any> {
  return (await res.json()) as any;
}
