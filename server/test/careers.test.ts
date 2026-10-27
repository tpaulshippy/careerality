import { beforeEach, describe, expect, test } from "vitest";
import type { Client } from "@libsql/client";
import type { AppDb } from "../src/db/client";
import { salaryOccupations } from "../src/db/schema";
import { body, createTestDb, testApp, testEnv } from "./setup";

let db: AppDb;
let client: Client;

beforeEach(async () => {
  ({ db, client } = await createTestDb());
  await db.insert(salaryOccupations).values([
    {
      occupation_code: "15-1252.00",
      occupation_name: "Software Developers",
      occupation_description: "Build software",
      display_level: 1,
      selectable: "T",
      sort_sequence: 2,
    },
    {
      occupation_code: "29-1141.00",
      occupation_name: "Registered Nurses",
      occupation_description: "Care for patients",
      display_level: 1,
      selectable: "T",
      sort_sequence: 1,
    },
    {
      occupation_code: "00-0000.00",
      occupation_name: "All Occupations",
      occupation_description: null,
      display_level: 0,
      selectable: "F",
      sort_sequence: 0,
    },
  ]);
});

describe("GET /api/careers", () => {
  test("empty result still reports one page like Pagy", async () => {
    await db.delete(salaryOccupations);
    const res = await testApp(db).request("/api/careers", {}, testEnv);
    const json = await body(res);
    expect(json.careers).toEqual([]);
    expect(json.pagy).toEqual({ page: 1, items: 10, count: 0, pages: 1 });
  });

  test("lists selectable careers ordered by sort_sequence with pagy meta", async () => {
    const res = await testApp(db).request("/api/careers", {}, testEnv);
    expect(res.status).toBe(200);
    const json = await body(res);
    expect(json.careers.map((c: { code: string }) => c.code)).toEqual([
      "29-1141.00",
      "15-1252.00",
    ]);
    expect(json.careers[0]).toEqual({
      code: "29-1141.00",
      name: "Registered Nurses",
      description: "Care for patients",
      level: 1,
    });
    expect(json.pagy).toEqual({ page: 1, items: 10, count: 2, pages: 1 });
  });
});

describe("GET /api/careers/:id", () => {
  test("finds by full, short, and compact codes", async () => {
    for (const id of ["15-1252.00", "15-1252", "151252"]) {
      const res = await testApp(db).request(
        `/api/careers/${id}`,
        {},
        testEnv,
      );
      expect(res.status).toBe(200);
      expect((await body(res)).code).toBe("15-1252.00");
    }
  });

  test("400 on invalid code, 404 when missing", async () => {
    const bad = await testApp(db).request("/api/careers/nope", {}, testEnv);
    expect(bad.status).toBe(400);
    const missing = await testApp(db).request(
      "/api/careers/11-1011.00",
      {},
      testEnv,
    );
    expect(missing.status).toBe(404);
  });
});
