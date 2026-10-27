import { beforeEach, describe, expect, test } from "vitest";
import type { Client } from "@libsql/client";
import type { AppDb } from "../src/db/client";
import { careerContents, careerRoi, swipes } from "../src/db/schema";
import { body, createTestDb, testApp, testEnv } from "./setup";

let db: AppDb;
let client: Client;

const stamp = "2026-01-01T00:00:00.000Z";

async function seedRoi(
  occupation_code: string,
  area_code: string,
  extra: Partial<typeof careerRoi.$inferInsert> = {},
) {
  const [row] = await db
    .insert(careerRoi)
    .values({
      occupation_code,
      occupation_name: `Career ${occupation_code}`,
      area_code,
      area_name: `Area ${area_code}`,
      annual_median_salary: 50000,
      education_cost: 10000,
      years_to_breakeven: 2,
      roi_percentage: 10,
      job_zone: 1,
      education_level: "Bachelor's degree",
      cost_of_living_index: 100,
      adjusted_salary: 50000,
      industry_code: "00",
      industry_name: "Industry",
      skills: JSON.stringify(["skill-a"]),
      created_at: stamp,
      updated_at: stamp,
      ...extra,
    })
    .returning({ id: careerRoi.id });
  return row!.id;
}

beforeEach(async () => {
  ({ db, client } = await createTestDb());
});

describe("GET /api/roi", () => {
  test("demand sort is stable across pages (25 rows, 20 per page)", async () => {
    for (let i = 1; i <= 25; i++) {
      await seedRoi(`11-10${String(i).padStart(2, "0")}.00`, "S1", {
        demand_score: 26 - i,
      });
    }
    const app = testApp(db);
    const page1 = await body(await app.request("/api/roi?area_code=S1&sort=demand", {}, testEnv));
    const page2 = await body(await app.request("/api/roi?area_code=S1&sort=demand&page=2", {}, testEnv));
    expect(page1.records).toHaveLength(20);
    expect(page2.records).toHaveLength(5);
    expect(page1.pagy).toEqual({ page: 1, items: 20, count: 25, pages: 2 });
    const scores = page1.records.map(
      (r: { demand_score: number }) => r.demand_score,
    );
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    const allIds = new Set([
      ...page1.records.map((r: { id: number }) => r.id),
      ...page2.records.map((r: { id: number }) => r.id),
    ]);
    expect(allIds.size).toBe(25);
  });

  test("falls back to roi sort when no demand scores exist", async () => {
    await seedRoi("15-1252.00", "S2", { roi_percentage: 5, demand_score: null });
    await seedRoi("29-1141.00", "S2", {
      roi_percentage: 20,
      demand_score: null,
    });
    const res = await body(await testApp(db).request("/api/roi?area_code=S2", {}, testEnv));
    expect(res.records.map((r: { roi_percentage: number }) => r.roi_percentage)).toEqual([
      20, 5,
    ]);
  });

  test("salary filters accept old and new param names", async () => {
    await seedRoi("15-1252.00", "99", { annual_median_salary: 40000 });
    await seedRoi("29-1141.00", "99", { annual_median_salary: 90000 });
    const res = await body(await testApp(db).request("/api/roi?salary_min=50000", {}, testEnv));
    expect(res.records.map((r: { occupation_code: string }) => r.occupation_code)).toEqual([
      "29-1141.00",
    ]);
    const res2 = await body(await testApp(db).request("/api/roi?min_salary=50000&max_salary=95000", {}, testEnv));
    expect(res2.records).toHaveLength(1);
  });

  test("user_id excludes swiped careers and area echo works", async () => {
    const id = await seedRoi("15-1252.00", "06", { area_name: "California" });
    await seedRoi("29-1141.00", "06", { area_name: "California" });
    await db.insert(swipes).values({
      career_id: id,
      user_id: "u1",
      direction: "left",
      feedback: null,
      created_at: stamp,
      updated_at: stamp,
    });
    const res = await body(await testApp(db).request("/api/roi?area_code=06&user_id=u1", {}, testEnv));
    expect(res.records).toHaveLength(1);
    expect(res.records[0].occupation_code).toBe("29-1141.00");
    expect(res.area_code).toBe("06");
    expect(res.area_name).toBe("California");
  });

  test("merges career_contents and parses skills JSON", async () => {
    await seedRoi("15-1252.00", "99");
    await db.insert(careerContents).values({
      occupation_code: "15-1252.00",
      day_in_life_summary: "summary",
      day_in_life_full: "full",
      video_url: "https://example.test/v.mp4",
      created_at: stamp,
      updated_at: stamp,
    });
    const res = await body(await testApp(db).request("/api/roi?area_code=99", {}, testEnv));
    expect(res.records[0].day_in_life_summary).toBe("summary");
    expect(res.records[0].video_url).toBe("https://example.test/v.mp4");
    expect(res.records[0].skills).toEqual(["skill-a"]);
  });
});

describe("GET /api/roi/:id", () => {
  test("finds by code with default area 99; 400/404 otherwise", async () => {
    await seedRoi("15-1252.00", "99");
    const ok = await testApp(db).request("/api/roi/15-1252", {}, testEnv);
    expect(ok.status).toBe(200);
    expect((await body(ok)).occupation_code).toBe("15-1252.00");
    const bad = await testApp(db).request("/api/roi/nope", {}, testEnv);
    expect(bad.status).toBe(400);
    const missing = await testApp(db).request(
      "/api/roi/15-1252?area=06",
      {},
      testEnv,
    );
    expect(missing.status).toBe(404);
  });
});

describe("GET /api/roi/search", () => {
  test("requires q and matches by name", async () => {
    await seedRoi("15-1252.00", "99", {
      occupation_name: "Software Developers",
    });
    const missing = await testApp(db).request("/api/roi/search", {}, testEnv);
    expect(missing.status).toBe(400);
    const res = await body(await testApp(db).request("/api/roi/search?q=software", {}, testEnv));
    expect(res.records).toHaveLength(1);
  });
});

describe("GET /api/roi/by_*", () => {
  test("each orders as named", async () => {
    await seedRoi("15-1252.00", "99", {
      annual_median_salary: 40000,
      roi_percentage: 30,
      years_to_breakeven: 5,
    });
    await seedRoi("29-1141.00", "99", {
      annual_median_salary: 90000,
      roi_percentage: 5,
      years_to_breakeven: 1,
    });
    const app = testApp(db);
    const salary = await body(await app.request("/api/roi/by_salary", {}, testEnv));
    expect(salary.records[0].occupation_code).toBe("29-1141.00");
    const roi = await body(await app.request("/api/roi/by_roi", {}, testEnv));
    expect(roi.records[0].occupation_code).toBe("15-1252.00");
    const be = await body(await app.request("/api/roi/by_breakeven", {}, testEnv));
    expect(be.records[0].occupation_code).toBe("29-1141.00");
  });
});

describe("GET /api/roi/map_summary", () => {
  test("aggregates state areas, skipping 99 and metro codes", async () => {
    await seedRoi("15-1252.00", "06", {
      annual_median_salary: 100000,
      roi_percentage: 20,
      demand_score: 0.5,
      demand_rank: 3,
    });
    await seedRoi("29-1141.00", "06", {
      annual_median_salary: 80000,
      roi_percentage: 10,
      demand_score: null,
      demand_rank: null,
    });
    await seedRoi("15-1252.00", "99", { annual_median_salary: 1 });
    const res = await body(await testApp(db).request("/api/roi/map_summary", {}, testEnv));
    expect(Object.keys(res.states)).toEqual(["06"]);
    expect(res.states["06"]).toEqual({
      hasRecords: true,
      avgSalary: 90000,
      adjustedSalary: 50000,
      medianRoi: 15,
      highRoiCount: 1,
      demandCount: 1,
      demandAvgRank: 3,
    });
  });
});
