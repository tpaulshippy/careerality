import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
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

afterEach(() => {
  vi.unstubAllGlobals();
});

function postRank(payload: unknown, env = testEnv) {
  return testApp(db).request(
    "/api/jev/rank",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    env,
  );
}

describe("POST /api/jev/rank", () => {
  test("rejects more than 50 candidates", async () => {
    const candidates = Array.from({ length: 51 }, (_, i) => ({
      occupation_code: `00-${String(i).padStart(4, "0")}.00`,
    }));
    const res = await postRank({ swipes: [], candidates });
    expect(res.status).toBe(422);
    expect(await body(res)).toEqual({
      error: "too many candidates (max 50)",
    });
  });

  test("falls back to input order without an API key", async () => {
    const res = await postRank(
      {
        swipes: [],
        candidates: [
          { occupation_code: "15-1252.00" },
          { occupation_code: "29-1141.00" },
        ],
      },
      { ...testEnv, TYPESAFE_API_KEY: undefined },
    );
    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({
      results: [
        {
          occupation_code: "15-1252.00",
          p_like: 0.5,
          fit_score: 1.0,
          driver: "security",
          confidence: 0.5,
          provider: "fallback",
        },
        {
          occupation_code: "29-1141.00",
          p_like: 0.5,
          fit_score: 1.0,
          driver: "security",
          confidence: 0.5,
          provider: "fallback",
        },
      ],
    });
  });

  test("calls TypeSafe System One and orders by probability", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        model: "jev-1.13.0",
        answers: {
          next_card: {
            type: "choice",
            choice: "29-1141.00",
            probabilities: { "15-1252.00": 0.2, "29-1141.00": 0.8 },
            confidence: 0.7,
          },
        },
        usage: { input_tokens: 10, output_tokens: 5 },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await postRank(
      {
        swipes: [{ career_id: 9999, direction: "right" }],
        candidates: [
          { occupation_code: "15-1252.00" },
          { occupation_code: "29-1141.00", occupation_name: "Custom" },
        ],
      },
      { ...testEnv, TYPESAFE_API_KEY: "test-key" },
    );
    expect(res.status).toBe(200);
    const json = await body(res);
    expect(json.results.map((r: { occupation_code: string }) => r.occupation_code)).toEqual([
      "29-1141.00",
      "15-1252.00",
    ]);
    expect(json.results[0]).toMatchObject({
      p_like: 0.8,
      fit_score: 0.8,
      driver: null,
      confidence: 0.7,
      provider: "jev",
    });

    // Wire contract mirrors the ruby_llm-typesafe gem exactly.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://api.typesafe.test/v1/systemone");
    expect((init.headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer test-key",
    );
    const reqBody = JSON.parse(init.body as string);
    expect(reqBody.model).toBe("jev-latest");
    // Code-only candidate got its name filled from the DB.
    expect(reqBody.questions.next_card.criteria).toEqual({
      "15-1252.00": "Software Developers",
      "29-1141.00": "Custom",
    });
    expect(reqBody.state.candidates).toHaveLength(2);
  });

  test("falls back when TypeSafe errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("boom", { status: 500 })),
    );
    const res = await postRank(
      { swipes: [], candidates: [{ occupation_code: "15-1252.00" }] },
      { ...testEnv, TYPESAFE_API_KEY: "test-key" },
    );
    const json = await body(res);
    expect(json.results[0].provider).toBe("fallback");
  });
});
