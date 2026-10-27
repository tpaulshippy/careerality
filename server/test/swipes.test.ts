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

beforeEach(async () => {
  ({ db, client } = await createTestDb());
});

describe("swipes", () => {
  test("POST validates, GET lists newest-first, DELETE removes", async () => {
    const careerId = await seedCareer();
    const app = testApp(db);

    const invalid = await app.request(
      "/api/swipes",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: "u1", direction: "up" }),
      },
      testEnv,
    );
    expect(invalid.status).toBe(422);
    expect(await body(invalid)).toEqual({
      error: ["Career can't be blank", "Direction is not included in the list"],
    });

    const created = await app.request(
      "/api/swipes",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          career_id: careerId,
          user_id: "u1",
          direction: "right",
          feedback: "great pay",
        }),
      },
      testEnv,
    );
    expect(created.status).toBe(201);
    const swipe = await body(created);
    expect(swipe.direction).toBe("right");

    const liked = await body(await app.request("/api/swipes/liked?user_id=u1", {}, testEnv));
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
    const noUser = await app.request(
      "/api/swipes/destroy_all",
      { method: "DELETE" },
      testEnv,
    );
    expect(noUser.status).toBe(400);
    await db.insert(swipes).values([
      { career_id: careerId, user_id: "u1", direction: "left", feedback: null, created_at: stamp, updated_at: stamp },
      { career_id: careerId, user_id: "u1", direction: "right", feedback: null, created_at: stamp, updated_at: stamp },
      { career_id: careerId, user_id: "u2", direction: "right", feedback: null, created_at: stamp, updated_at: stamp },
    ]);
    const res = await body(await app.request("/api/swipes/destroy_all?user_id=u1", { method: "DELETE" }, testEnv));
    expect(res).toEqual({ deleted: 2 });
  });
});
