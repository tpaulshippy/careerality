import { Hono } from "hono";
import { and, asc, sql } from "drizzle-orm";
import type { AppDb } from "../db/client";
import { careerRoi } from "../db/schema";
import type { Env } from "../env";

export function areasRoute(db: AppDb) {
  const app = new Hono<{ Bindings: Env }>();

  app.get("/states", async (c) => {
    // State-level entries: numeric area codes of length <= 2 whose names
    // are not metro-style ("City, ST"). GLOB spells the old ~ '^[0-9]+$';
    // the '[0-9]*' clause additionally excludes empty codes, which the
    // Postgres regex rejected but '*[^0-9]*' negation alone would allow.
    const rows = await db
      .select({ area_code: careerRoi.area_code, area_name: careerRoi.area_name })
      .from(careerRoi)
      .where(
        and(
          sql`${careerRoi.area_code} NOT GLOB '*[^0-9]*'`,
          sql`${careerRoi.area_code} GLOB '[0-9]*'`,
          sql`length(${careerRoi.area_code}) <= 2`,
          sql`${careerRoi.area_name} NOT LIKE '%,%'`,
        ),
      )
      .groupBy(careerRoi.area_code, careerRoi.area_name)
      .orderBy(asc(careerRoi.area_name));
    return c.json({
      states: rows.map((s) => ({
        area_code: s.area_code,
        area_name: s.area_name,
      })),
    });
  });

  return app;
}
