import { beforeEach, describe, expect, test } from "vitest";
import type { Client } from "@libsql/client";
import type { AppDb } from "../src/db/client";
import { careerContents, careerRoi, swipes } from "../src/db/schema";
import { body, createTestDb, testApp, testEnv } from "./setup";

let db: AppDb;
let client: Client;
const stamp = "2026-01-01T00:00:00.000Z";

async function seedCareer() {
  const [row] = await db
    .insert(careerRoi)
    .values({
      occupation_code: "15-1252.00",
      occupation_name: "Software Developers",
      area_code: "99",
      area_name: "National",
      annual_median_salary: 80000,
      roi_percentage: 12,
      industry_code: "00",
      created_at: stamp,
      updated_at: stamp,
    })
    .returning({ id: careerRoi.id });
  await db.insert(careerContents).values({
    occupation_code: "15-1252.00",
    day_in_life_summary: "summary",
    day_in_life_full: "full",
    video_url: null,
    created_at: stamp,
    updated_at: stamp,
  });
  return row!.id;
}

function postSwipe(payload: unknown, query = "") {
  return testApp(db).request(`/api/swipes${query}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }, testEnv);
}

beforeEach(async () => {
  ({ db, client } = await createTestDb());
});

describe("swipes", () => {
  test("POST validates like the Rails model", async () => {
    const careerId = await seedCareer();
    const invalid = await postSwipe({
      user_id: "u1",
      direction: "up",
    });
    expect(invalid.status).toBe(422);
    expect(await body(invalid)).toEqual({
      error: ["Career can't be blank", "Direction is not included in the list"],
    });

    const missingDirection = await postSwipe({
      career_id: careerId,
      user_id: "u1",
    });
    expect(missingDirection.status).toBe(422);
    // Rails presence + inclusion validators both fire on a missing direction.
    expect(await body(missingDirection)).toEqual({
      error: [
        "Direction can't be blank",
        "Direction is not included in the list",
      ],
    });

    const blankUser = await postSwipe({
      career_id: careerId,
      user_id: "   ",
      direction: "left",
    });
    expect(blankUser.status).toBe(422);
    expect(await body(blankUser)).toEqual({
      error: ["User can't be blank"],
    });

    const fractionalId = await postSwipe({
      career_id: 1.5,
      user_id: "u1",
      direction: "left",
    });
    expect(fractionalId.status).toBe(422);
    expect(await body(fractionalId)).toEqual({
      error: ["Career can't be blank"],
    });
  });

  test("GET lists newest first", async () => {
    const careerId = await seedCareer();
    const app = testApp(db);
    for (const [direction, at] of [
      ["left", "2026-01-01T00:00:00.000Z"],
      ["right", "2026-01-02T00:00:00.000Z"],
    ] as const) {
      await db.insert(swipes).values({
        career_id: careerId,
        user_id: "u1",
        direction,
        feedback: null,
        created_at: at,
        updated_at: at,
      });
    }
    const res = await body(
      await app.request("/api/swipes?user_id=u1", {}, testEnv),
    );
    expect(
      res.swipes.map((s: { direction: string }) => s.direction),
    ).toEqual(["right", "left"]);
  });

  test("liked / destroy / destroy_all", async () => {
    const careerId = await seedCareer();
    const app = testApp(db);

    const created = await postSwipe({
      career_id: careerId,
      user_id: "u1",
      direction: "right",
      feedback: "great pay",
    });
    expect(created.status).toBe(201);
    const swipe = await body(created);
    expect(swipe.direction).toBe("right");

    const liked = await body(
      await app.request("/api/swipes/liked?user_id=u1", {}, testEnv),
    );
    expect(liked.records).toHaveLength(1);
    expect(liked.records[0]).toMatchObject({
      occupation_code: "15-1252.00",
      swipe_id: swipe.id,
      day_in_life_summary: "summary",
    });

    const removed = await app.request(
      `/api/swipes/${swipe.id}?user_id=u1`,
      { method: "DELETE" },
      testEnv,
    );
    expect(await body(removed)).toEqual({ success: true });
    const missing = await app.request(
      `/api/swipes/${swipe.id}?user_id=u1`,
      { method: "DELETE" },
      testEnv,
    );
    expect(missing.status).toBe(404);
  });

  test("DELETE /api/swipes/destroy_all requires user_id and deletes", async () => {
    const careerId = await seedCareer();
    const app = testApp(db);
    for (const q of ["", "?user_id=%20%20"]) {
      const noUser = await app.request(
        `/api/swipes/destroy_all${q}`,
        { method: "DELETE" },
        testEnv,
      );
      expect(noUser.status).toBe(400);
    }
    await db.insert(swipes).values([
      { career_id: careerId, user_id: "u1", direction: "left", feedback: null, created_at: stamp, updated_at: stamp },
      { career_id: careerId, user_id: "u1", direction: "right", feedback: null, created_at: stamp, updated_at: stamp },
      { career_id: careerId, user_id: "u2", direction: "right", feedback: null, created_at: stamp, updated_at: stamp },
    ]);
    const res = await body(
      await app.request("/api/swipes/destroy_all?user_id=u1", { method: "DELETE" }, testEnv),
    );
    expect(res).toEqual({ deleted: 2 });
    const u1Left = await body(
      await app.request("/api/swipes?user_id=u1", {}, testEnv),
    );
    expect(u1Left.swipes).toEqual([]);
    const u2Left = await body(
      await app.request("/api/swipes?user_id=u2", {}, testEnv),
    );
    expect(u2Left.swipes).toHaveLength(1);
  });
});
