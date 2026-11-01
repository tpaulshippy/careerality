import { Hono } from "hono";
import { and, asc, sql } from "drizzle-orm";
import type { AppDb } from "../db/client";
import { careerRoi, states } from "../db/schema";
import type { Env } from "../env";

// The states list changes only when career_roi is re-seeded, so the
// response is edge-cached for a day (Cache API, per-PoP — free, no binding,
// no daily op quota). Source of truth is the materialized `states` table
// (~55 rows, refreshed by import_to_d1.sh); the live career_roi derivation
// below only runs as a fallback when the table is empty (fresh DB, or a
// seed that predates the refresh step), and backfills it so the full-table
// scan happens at most once.
const CACHE_MAX_AGE_SECONDS = 86_400;

export function areasRoute(db: AppDb) {
  const app = new Hono<{ Bindings: Env }>();

  app.get("/states", async (c) => {
    try {
      if (typeof caches !== "undefined") {
        const hit = await caches.default.match(c.req.url);
        if (hit) return hit;
      }
    } catch {
      // Cache API unavailable (tests, wrangler dev without cache) — D1 path.
    }

    let rows: { area_code: string | null; area_name: string | null }[] = await db
      .select({ area_code: states.area_code, area_name: states.area_name })
      .from(states)
      .orderBy(asc(states.area_name));

    if (rows.length === 0) {
      // State-level entries: numeric area codes of length <= 2 whose names
      // are not metro-style ("City, ST"). GLOB spells the old ~ '^[0-9]+$';
      // the '[0-9]*' clause additionally excludes empty codes, which the
      // Postgres regex rejected but '*[^0-9]*' negation alone would allow.
      const derived = await db
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
      // NULL codes can't satisfy the predicates above, but the type doesn't
      // know that — narrow before backfilling the NOT NULL table.
      const seedable = derived.filter(
        (r): r is { area_code: string; area_name: string } =>
          r.area_code !== null && r.area_name !== null,
      );
      if (seedable.length > 0) {
        await db.insert(states).values(seedable).onConflictDoNothing();
      }
      rows = derived;
    }

    const res = c.json({
      states: rows.map((s) => ({
        area_code: s.area_code,
        area_name: s.area_name,
      })),
    });
    res.headers.set("Cache-Control", `public, max-age=${CACHE_MAX_AGE_SECONDS}`);
    try {
      if (typeof caches !== "undefined") {
        c.executionCtx.waitUntil(caches.default.put(c.req.url, res.clone()));
      }
    } catch {
      // Best-effort edge cache only — the response is already built.
    }
    return res;
  });

  return app;
}
