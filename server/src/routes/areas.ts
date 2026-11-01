import { Hono } from "hono";
import { asc } from "drizzle-orm";
import type { AppDb } from "../db/client";
import { states } from "../db/schema";
import type { Env } from "../env";

// The states list is static scripted data (~55 rows in the `states` table,
// see migrations/0003_states_static.sql) — no code path scans career_roi.
// Responses are edge-cached for a day (Cache API, per-PoP — free, no binding,
// no daily op quota).
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

    const rows = await db
      .select({ area_code: states.area_code, area_name: states.area_name })
      .from(states)
      .orderBy(asc(states.area_name));

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
