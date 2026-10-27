import { beforeEach, describe, expect, test } from "vitest";
import type { Client } from "@libsql/client";
import type { AppDb } from "../src/db/client";
import { careerRoi } from "../src/db/schema";
import { body, createTestDb, testApp, testEnv } from "./setup";

let db: AppDb;
let client: Client;
const stamp = "2026-01-01T00:00:00.000Z";

beforeEach(async () => {
  ({ db, client } = await createTestDb());
  await db.insert(careerRoi).values([
    {
      occupation_code: "15-1252.00",
      occupation_name: "Software Developers",
      area_code: "06",
      area_name: "California",
      created_at: stamp,
      updated_at: stamp,
    },
    {
      occupation_code: "15-1252.00",
      occupation_name: "Software Developers",
      area_code: "0644000",
      area_name: "Los Angeles, CA",
      created_at: stamp,
      updated_at: stamp,
    },
    {
      occupation_code: "29-1141.00",
      occupation_name: "Registered Nurses",
      area_code: "36",
      area_name: "New York",
      created_at: stamp,
      updated_at: stamp,
    },
  ]);
});

describe("GET /api/areas/states", () => {
  test("returns state-level areas, excluding metros", async () => {
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
