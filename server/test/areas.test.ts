import { beforeEach, describe, expect, test } from "vitest";
import type { Client } from "@libsql/client";
import type { AppDb } from "../src/db/client";
import { states } from "../src/db/schema";
import { body, createTestDb, testApp, testEnv } from "./setup";

let db: AppDb;
let client: Client;

beforeEach(async () => {
  ({ db, client } = await createTestDb());
  // Migrations seed the static 55-row list; tests replace it with a small
  // fixture so assertions stay exact.
  await db.delete(states);
  await db.insert(states).values([
    { area_code: "06", area_name: "California" },
    { area_code: "36", area_name: "New York" },
  ]);
});

describe("GET /api/areas/states", () => {
  test("returns the scripted states list", async () => {
    const res = await testApp(db).request("/api/areas/states", {}, testEnv);
    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({
      states: [
        { area_code: "06", area_name: "California" },
        { area_code: "36", area_name: "New York" },
      ],
    });
  });
});
