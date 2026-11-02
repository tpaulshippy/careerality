import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Client } from "@libsql/client";
import type { AppDb } from "../src/db/client";
import { careerRoi } from "../src/db/schema";
import { body, createTestDb, testEnv } from "./setup";
import { createApp } from "../src/app";

let db: AppDb;
let client: Client;
const stamp = "2026-01-01T00:00:00.000Z";

beforeEach(async () => {
  ({ db, client } = await createTestDb());
  await db.insert(careerRoi).values([
    {
      occupation_code: "15-1252.00",
      occupation_name: "Software Developers",
      area_code: "99",
      area_name: "National",
      created_at: stamp,
      updated_at: stamp,
    },
    {
      occupation_code: "29-1141.00",
      occupation_name: "Registered Nurses",
      area_code: "99",
      area_name: "National",
      created_at: stamp,
      updated_at: stamp,
    },
  ]);
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await client.close();
});

function postRankWithDb(appDb: AppDb, payload: unknown, env = testEnv) {
  return createApp(appDb, {
    ...testEnv,
    TYPESAFE_API_KEY: undefined,
  }).request(
    "/api/jev/rank",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    { ...testEnv, TYPESAFE_API_KEY: undefined, ...env },
  );
}

// Counts SELECTs issued through the db (same proxy trick as jev.test.ts).
function countingDb(db: AppDb): { db: AppDb; selects: () => number } {
  let selectCalls = 0;
  const proxy = new Proxy(db, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== "function") return value;
      if (prop === "select") {
        return (...args: unknown[]) => {
          selectCalls += 1;
          return Reflect.apply(value, target, args);
        };
      }
      return (...args: unknown[]) => Reflect.apply(value, target, args);
    },
  }) as unknown as AppDb;
  return { db: proxy, selects: () => selectCalls };
}

describe("POST /api/jev/rank local-bundle lookups", () => {
  test("skips the swipe D1 lookup when careerLookup covers every career_id", async () => {
    const { db: cdb, selects } = countingDb(db);
    const res = await createApp(cdb, {
      ...testEnv,
      TYPESAFE_API_KEY: undefined,
    }).request(
      "/api/jev/rank",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          swipes: [
            { career_id: 9001, direction: "right" },
            { career_id: 9002, direction: "left" },
          ],
          candidates: [
            { occupation_code: "15-1252.00", occupation_name: "Software Developers" },
          ],
          careerLookup: {
            "9001": {
              occupation_code: "15-1252.00",
              occupation_name: "Software Developers",
            },
            "9002": {
              occupation_code: "29-1141.00",
              occupation_name: "Registered Nurses",
            },
          },
        }),
      },
      { ...testEnv, TYPESAFE_API_KEY: undefined },
    );
    expect(res.status).toBe(200);
    const json = await body(res);
    expect(json.results).toHaveLength(1);
    expect(json.results[0].provider).toBe("fallback");
    expect(selects()).toBe(0);
  });

  test("skips the candidate D1 lookup when candidateNames covers every missing code", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        model: "jev-1.13.0",
        answers: {
          next_card: {
            type: "choice",
            choice: "15-1252.00",
            probabilities: { "15-1252.00": 0.9, "29-1141.00": 0.1 },
            confidence: 0.8,
          },
        },
        usage: { input_tokens: 10, output_tokens: 5 },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { db: cdb, selects } = countingDb(db);
    const res = await createApp(cdb, {
      ...testEnv,
      TYPESAFE_API_KEY: "test-key",
    }).request(
      "/api/jev/rank",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          swipes: [],
          candidates: [
            { occupation_code: "15-1252.00" },
            { occupation_code: "29-1141.00" },
          ],
          candidateNames: {
            "15-1252.00": "Software Developers",
            "29-1141.00": "Registered Nurses",
          },
        }),
      },
      { ...testEnv, TYPESAFE_API_KEY: "test-key" },
    );
    expect(res.status).toBe(200);
    const json = await body(res);
    expect(json.results.map((r: { occupation_code: string }) => r.occupation_code)).toEqual([
      "15-1252.00",
      "29-1141.00",
    ]);
    expect(selects()).toBe(0);

    // The TYPESAFE wire shape is unchanged: lookup names fill criteria/state.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const reqBody = JSON.parse(init.body as string);
    expect(reqBody.questions.next_card.criteria).toEqual({
      "15-1252.00": "Software Developers",
      "29-1141.00": "Registered Nurses",
    });
    expect(reqBody.state.candidates).toEqual([
      { occupation_code: "15-1252.00", occupation_name: "Software Developers" },
      { occupation_code: "29-1141.00", occupation_name: "Registered Nurses" },
    ]);
  });

  test("falls back to D1 when careerLookup coverage is partial", async () => {
    const { db: cdb, selects } = countingDb(db);
    const res = await createApp(cdb, {
      ...testEnv,
      TYPESAFE_API_KEY: undefined,
    }).request(
      "/api/jev/rank",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          swipes: [
            { career_id: 9001, direction: "right" },
            { career_id: 9002, direction: "left" },
          ],
          candidates: [
            { occupation_code: "15-1252.00", occupation_name: "Software Developers" },
          ],
          // 9002 missing -> the D1 path runs untouched.
          careerLookup: {
            "9001": {
              occupation_code: "15-1252.00",
              occupation_name: "Software Developers",
            },
          },
        }),
      },
      { ...testEnv, TYPESAFE_API_KEY: undefined },
    );
    expect(res.status).toBe(200);
    const json = await body(res);
    expect(json.results).toHaveLength(1);
    expect(json.results[0].provider).toBe("fallback");
    expect(selects()).toBe(1);
  });

  test("falls back to D1 when candidateNames coverage is partial", async () => {
    const { db: cdb, selects } = countingDb(db);
    const res = await postRankWithDb(cdb, {
      swipes: [],
      candidates: [
        { occupation_code: "15-1252.00" },
        { occupation_code: "29-1141.00" },
      ],
      // 29-1141.00 missing -> the D1 path runs untouched.
      candidateNames: { "15-1252.00": "Software Developers" },
    });
    expect(res.status).toBe(200);
    const json = await body(res);
    expect(json.results).toHaveLength(2);
    expect(selects()).toBe(1);
  });

  test("ignores malformed lookups and uses D1", async () => {
    const { db: cdb, selects } = countingDb(db);
    const res = await postRankWithDb(cdb, {
      swipes: [{ career_id: 9001, direction: "right" }],
      candidates: [{ occupation_code: "15-1252.00" }],
      careerLookup: { "9001": "nonsense" },
      candidateNames: "nope",
    });
    expect(res.status).toBe(200);
    const json = await body(res);
    expect(json.results).toHaveLength(1);
    expect(json.results[0].provider).toBe("fallback");
    // One swipe chunk + one candidate chunk through D1.
    expect(selects()).toBe(2);
  });

  test("rejects array lookups and uses D1 (cubic P2)", async () => {
    const { db: cdb, selects } = countingDb(db);
    const res = await postRankWithDb(cdb, {
      swipes: [{ career_id: 9001, direction: "right" }],
      candidates: [{ occupation_code: "15-1252.00" }],
      careerLookup: [],
      candidateNames: [],
    });
    expect(res.status).toBe(200);
    const json = await body(res);
    expect(json.results).toHaveLength(1);
    expect(json.results[0].provider).toBe("fallback");
    // Arrays are not valid maps: one swipe chunk + one candidate chunk D1.
    expect(selects()).toBe(2);
  });

  test("falls back to D1 when a lookup hit has an empty name (cubic P2)", async () => {
    const { db: cdb, selects } = countingDb(db);
    const res = await postRankWithDb(cdb, {
      swipes: [{ career_id: 9001, direction: "right" }],
      candidates: [
        { occupation_code: "15-1252.00", occupation_name: "Software Developers" },
      ],
      careerLookup: {
        "9001": { occupation_code: "15-1252.00", occupation_name: "" },
      },
    });
    expect(res.status).toBe(200);
    const json = await body(res);
    expect(json.results).toHaveLength(1);
    expect(json.results[0].provider).toBe("fallback");
    // Nameless hit is incomplete: swipe chunk goes through D1, candidates
    // already carry names so no candidate query.
    expect(selects()).toBe(1);
  });
});
