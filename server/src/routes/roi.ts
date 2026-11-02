import { Hono } from "hono";
import {
  and,
  count,
  countDistinct,
  eq,
  gte,
  isNotNull,
  like,
  lte,
  notInArray,
  sql,
  type SQL,
} from "drizzle-orm";
import type { AppDb } from "../db/client";
import { careerContents, careerRoi, roiMapSummary, roiStats, swipes } from "../db/schema";
import type { Env } from "../env";
import { normalizeOccupationCode } from "../lib/normalize";
import { offset, pagy, parsePage } from "../lib/pagination";

export const HIGH_ROI_THRESHOLD = 15;
const ROI_PER_PAGE = 20;
const ROI_TOP_PER_PAGE = 50;

// Anonymous feeds change only on re-seed: long edge TTL. user_id feeds go
// stale on the user's own swipes: 60s TTL plus best-effort purge on swipe
// writes (see purgeUserFeedCache). Per-URL keying keeps users isolated.
const ANON_CACHE_MAX_AGE = 86_400;
const USER_CACHE_MAX_AGE = 60;

// Feed URLs cached per user, for swipe-write purges. Best-effort and
// per-isolate: entries on other isolates/PoPs expire via the short TTL.
// Bounded in both dimensions so a pathological user_id space can't grow
// isolate memory: per-user URL cap plus a total user cap (oldest evicted).
const userFeedUrls = new Map<string, Set<string>>();
const userFeedVersion = new Map<string, number>();
const MAX_TRACKED_URLS_PER_USER = 50;
const MAX_TRACKED_USERS = 500;

function trackUserFeedUrl(userId: string, url: string): void {
  let set = userFeedUrls.get(userId);
  if (!set) {
    set = new Set();
    userFeedUrls.set(userId, set);
    if (userFeedUrls.size > MAX_TRACKED_USERS) {
      const oldest = userFeedUrls.keys().next();
      if (!oldest.done) {
        userFeedUrls.delete(oldest.value);
        userFeedVersion.delete(oldest.value);
      }
    }
  }
  set.add(url);
  if (set.size > MAX_TRACKED_URLS_PER_USER) {
    const oldest = set.values().next();
    if (!oldest.done) set.delete(oldest.value);
  }
}

// Delete this user's cached feed responses (exact URLs only — Cache API has
// no prefix purge). Called after swipe writes; failures leave the 60s TTL
// as backstop. Bumps the per-user version first so a cache write still in
// flight can't re-register stale data after the purge (see the put path).
export async function purgeUserFeedCache(userId: string): Promise<void> {
  userFeedVersion.set(userId, (userFeedVersion.get(userId) ?? 0) + 1);
  const set = userFeedUrls.get(userId);
  if (!set) return;
  userFeedUrls.delete(userId);
  try {
    if (typeof caches !== "undefined") {
      await Promise.all([...set].map((url) => caches.default.delete(url)));
    }
  } catch {
    // Best-effort only.
  }
}

// Rails serializes PG NUMERIC/BigDecimal columns as JSON strings
// (e.g. "50000.0"), while integers stay numbers. Reproduce that formatting
// so the client contracts (which type these fields as string) keep working.
function dec(v: number | null): string | null {
  if (v == null) return null;
  return Number.isInteger(v) ? `${v}.0` : String(v);
}

// Full career_roi row plus the joined career_contents columns.
// content_id is non-null exactly when a content row was joined.
export type RoiRow = typeof careerRoi.$inferSelect & {
  content_id: number | null;
  day_in_life_summary: string | null;
  day_in_life_full: string | null;
  video_url: string | null;
};

function parseSkills(raw: string | null): unknown {
  if (raw == null || raw === "") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Mirrors Rails CareerRoi#as_json. The day-in-the-life keys are emitted only
// when a career_contents row exists, exactly like the Rails conditional.
export function roiJson(row: RoiRow) {
  const base = {
    id: row.id,
    occupation_code: row.occupation_code,
    occupation_name: row.occupation_name,
    area_code: row.area_code,
    area_name: row.area_name,
    annual_median_salary: dec(row.annual_median_salary),
    education_cost: dec(row.education_cost),
    years_to_breakeven: row.years_to_breakeven,
    roi_percentage: dec(row.roi_percentage),
    job_zone: row.job_zone,
    education_level: row.education_level,
    skills: parseSkills(row.skills),
    cost_of_living_index: dec(row.cost_of_living_index),
    adjusted_salary: dec(row.adjusted_salary),
    industry_code: row.industry_code,
    industry_name: row.industry_name,
    demand_rank: row.demand_rank,
    avg_annual_openings: row.avg_annual_openings,
    projected_growth_percent: dec(row.projected_growth_percent),
    demand_score: dec(row.demand_score),
  };
  if (row.content_id == null) return base;
  return {
    ...base,
    day_in_life_summary: row.day_in_life_summary,
    day_in_life_full: row.day_in_life_full,
    video_url: row.video_url,
  };
}

const roiColumns = {
  id: careerRoi.id,
  occupation_code: careerRoi.occupation_code,
  occupation_name: careerRoi.occupation_name,
  area_code: careerRoi.area_code,
  area_name: careerRoi.area_name,
  annual_median_salary: careerRoi.annual_median_salary,
  education_cost: careerRoi.education_cost,
  years_to_breakeven: careerRoi.years_to_breakeven,
  roi_percentage: careerRoi.roi_percentage,
  job_zone: careerRoi.job_zone,
  education_level: careerRoi.education_level,
  skills: careerRoi.skills,
  cost_of_living_index: careerRoi.cost_of_living_index,
  adjusted_salary: careerRoi.adjusted_salary,
  industry_code: careerRoi.industry_code,
  industry_name: careerRoi.industry_name,
  demand_rank: careerRoi.demand_rank,
  avg_annual_openings: careerRoi.avg_annual_openings,
  projected_growth_percent: careerRoi.projected_growth_percent,
  demand_score: careerRoi.demand_score,
  feedArea: careerRoi.feedArea,
  created_at: careerRoi.created_at,
  updated_at: careerRoi.updated_at,
  content_id: careerContents.id,
  day_in_life_summary: careerContents.day_in_life_summary,
  day_in_life_full: careerContents.day_in_life_full,
  video_url: careerContents.video_url,
};

function withContent(db: AppDb) {
  return db
    .select(roiColumns)
    .from(careerRoi)
    .leftJoin(
      careerContents,
      eq(careerRoi.occupation_code, careerContents.occupation_code),
    );
}

type Where = SQL | undefined;

function areaFilter(area: string | undefined): Where {
  return area ? eq(careerRoi.area_code, area) : undefined;
}

function parseSalaryBound(raw: string | undefined): number | null {
  // Rails checks `present?`, which is false for blank strings, so trim first
  // and skip. Non-numeric input coerces via to_f to 0.0 rather than filtering
  // everything out, so fall back to 0 instead of propagating NaN.
  const trimmed = raw?.trim() ?? "";
  if (trimmed === "") return null;
  const v = Number.parseFloat(trimmed);
  return Number.isFinite(v) ? v : 0;
}

function salaryFilters(params: Record<string, string | undefined>): Where[] {
  // Rails applies each alias independently when both are present, so the
  // strictest bound wins rather than one alias shadowing the other.
  const out: Where[] = [];
  for (const key of ["min_salary", "salary_min"]) {
    const bound = parseSalaryBound(params[key]);
    if (bound != null)
      out.push(gte(careerRoi.annual_median_salary, bound));
  }
  for (const key of ["max_salary", "salary_max"]) {
    const bound = parseSalaryBound(params[key]);
    if (bound != null)
      out.push(lte(careerRoi.annual_median_salary, bound));
  }
  return out;
}

// Explicit NULLS ordering to match Postgres semantics (PG: DESC defaults to
// NULLS FIRST, ASC to NULLS LAST; SQLite defaults are the opposite).
const orderRoiDesc = sql`${careerRoi.roi_percentage} DESC NULLS FIRST`;
const orderSalaryDesc = sql`${careerRoi.annual_median_salary} DESC NULLS FIRST`;
const orderBreakevenAsc = sql`${careerRoi.years_to_breakeven} ASC NULLS LAST`;
const orderDemand = sql`${careerRoi.demand_score} DESC NULLS LAST, ${careerRoi.demand_rank} ASC NULLS LAST, ${careerRoi.projected_growth_percent} DESC NULLS LAST, ${careerRoi.occupation_code} ASC`;

// Precomputed feed totals (migrations/0004_roi_stats.sql, refreshed post-seed
// by import_to_d1.sh). Single-row PK lookup; null when the cell is missing
// (fresh DB, unknown area) — callers fall back to a live COUNT(*) then.
async function summaryCount(db: AppDb, key: string): Promise<number | null> {
  const rows = await db
    .select({ n: roiStats.n })
    .from(roiStats)
    .where(eq(roiStats.key, key))
    .limit(1);
  return rows[0]?.n ?? null;
}

// Personalized totals without scanning: the user's swiped careers matching
// the feed scope, counted from the tiny swipes side (user-indexed, then PK
// joins). Callers subtract this from the summary cell.
async function excludedSwipeCount(
  db: AppDb,
  userId: string,
  extra: Where,
): Promise<number> {
  const conds = [eq(swipes.user_id, userId), isNotNull(swipes.career_id), extra].filter(
    (w): w is SQL => w !== undefined,
  );
  const rows = await db
    .select({ n: countDistinct(swipes.career_id) })
    .from(swipes)
    .innerJoin(careerRoi, eq(careerRoi.id, swipes.career_id))
    .where(and(...conds));
  return rows[0]?.n ?? 0;
}

async function pagedRoi(
  db: AppDb,
  where: Where,
  order: SQL,
  page: number,
  perPage: number,
  totalOverride: number | null = null,
) {
  const cond = where ? and(where) : undefined;
  const total =
    totalOverride ??
    (await db.select({ n: count() }).from(careerRoi).where(cond))[0]?.n ??
    0;
  const rows = await withContent(db)
    .where(cond)
    .orderBy(order)
    .limit(perPage)
    .offset(offset(page, perPage));
  return { records: rows.map(roiJson), pagy: pagy(total, page, perPage) };
}

export function roiRoute(db: AppDb) {
  const app = new Hono<{ Bindings: Env }>();

  app.get("/", async (c) => {
    const q = c.req.query();
    const sort = q["sort"] ?? "demand";
    const area = q["area_code"] ?? q["area"] ?? q["location"] ?? undefined;
    const page = parsePage(q["page"]);

    // Feeds are shared (anonymous) or per-user (user_id) but always
    // URL-keyed, so the edge cache is correct for both: crawlers, cold
    // boots, CI smoke, pagination, and refetches all hit it.
    const userId = q["user_id"] ?? null;
    const cacheTtl = userId ? USER_CACHE_MAX_AGE : ANON_CACHE_MAX_AGE;
    try {
      if (typeof caches !== "undefined") {
        const hit = await caches.default.match(c.req.url);
        if (hit) return hit;
      }
    } catch {
      // Cache API unavailable (tests, dev) — D1 path.
    }

    const salaryWheres = salaryFilters(q);
    // Metro rows (84% of the table) are unreachable through the app's
    // filters yet dominated unscoped feeds: scope every feed to national +
    // state areas via the feed_area generated column (see 0006). The shape
    // matches the feed_walk partial index predicate exactly, so the default
    // sort walks ~20 index rows.
    const conditions: Where[] = [
      sql`${careerRoi.feedArea} = 1`,
      areaFilter(area),
      ...salaryWheres,
    ];
    // Rails decides the demand-vs-roi sort from the area/salary filters
    // alone, before the per-user swipe exclusion is applied.
    const filterWhere = and(
      ...conditions.filter((w): w is SQL => w !== undefined),
    );
    if (q["user_id"]) {
      conditions.push(
        notInArray(
          careerRoi.id,
          db
            .select({ career_id: swipes.career_id })
            .from(swipes)
            .where(
              and(
                eq(swipes.user_id, q["user_id"]),
                // NULL career_id would make NOT IN match nothing; the Rails
                // query has no NULLs in practice (validated), this just guards it.
                isNotNull(swipes.career_id),
              ),
            ),
        ),
      );
    }
    const where = and(...conditions.filter((w): w is SQL => w !== undefined));

    let order: SQL;
    // Rails orders the demand-filtered relation when demand data exists,
    // so NULL-demand rows are excluded from demand-sorted feeds entirely
    // (not just sorted last).
    let demandOnly = false;
    if (sort === "salary") order = orderSalaryDesc;
    else if (sort === "breakeven") order = orderBreakevenAsc;
    else if (sort === "roi") order = orderRoiDesc;
    else if (sort === "demand") {
      // Existence probe, not a count: stops at the first demand row (~1 row
      // read) instead of scanning the table to count them all. SQLite has no
      // usable index for a bare `demand_score IS NOT NULL` predicate.
      const probe = await db
        .select({ one: sql`1` })
        .from(careerRoi)
        .where(
          filterWhere
            ? and(filterWhere, isNotNull(careerRoi.demand_score))
            : isNotNull(careerRoi.demand_score),
        )
        .limit(1);
      if (probe.length > 0) {
        order = orderDemand;
        demandOnly = true;
      } else {
        order = orderRoiDesc;
      }
    } else {
      order = orderRoiDesc;
    }

    const finalWhere = demandOnly
      ? and(where, isNotNull(careerRoi.demand_score))
      : where;
    // Precomputed total when the filter maps to a summary cell: no area and
    // no salary bounds means the national cells; a bare area means its cell.
    // Salary ranges have too many combinations — those stay live (and
    // anonymous URLs are edge-cached anyway). user_id exclusions are applied
    // as cell-minus-swiped below, not as a live anti-join count.
    let totalOverride: number | null = null;
    if (salaryWheres.length === 0) {
      totalOverride = await summaryCount(
        db,
        !area
          ? demandOnly
            ? "demand_total"
            : "total"
          : demandOnly
            ? `area:${area}:demand`
            : `area:${area}`,
      );
      if (q["user_id"] && totalOverride !== null) {
        // Personalized total without scanning: cell minus the user's swiped
        // careers under the same scope (driven by the tiny swipes side).
        // Mirrors finalWhere minus the swipe exclusion itself.
        const scopeExtra = demandOnly
          ? and(
              sql`${careerRoi.feedArea} = 1`,
              areaFilter(area),
              isNotNull(careerRoi.demand_score),
            )
          : and(sql`${careerRoi.feedArea} = 1`, areaFilter(area));
        totalOverride -= await excludedSwipeCount(db, q["user_id"], scopeExtra);
      }
    }
    const body = await pagedRoi(
      db,
      finalWhere,
      order,
      page,
      ROI_PER_PAGE,
      totalOverride,
    );
    const response: Record<string, unknown> = { ...body };
    if (area) {
      response["area_code"] = area;
      const areaRows = await db
        .select({ area_name: careerRoi.area_name })
        .from(careerRoi)
        .where(eq(careerRoi.area_code, area))
        .limit(1);
      response["area_name"] = areaRows[0]?.area_name ?? `State ${area}`;
    }
    const res = c.json(response);
    // Feed content changes on re-seed (anonymous, long TTL) or the user's
    // own swipes (per-user short TTL + purge on write). The client copy
    // stays private for user_id; the stored copy is rewritten public below
    // because Cache API put rejects private/no-store with a 413.
    res.headers.set(
      "Cache-Control",
      userId ? `private, max-age=${cacheTtl}` : `public, max-age=${cacheTtl}`,
    );
    try {
      if (typeof caches !== "undefined") {
        const url = c.req.url;
        const version = userId ? (userFeedVersion.get(userId) ?? 0) : 0;
        const storeable = res.clone();
        storeable.headers.set("Cache-Control", `public, max-age=${cacheTtl}`);
        const write = caches.default.put(url, storeable).then(
          async () => {
            if (!userId) return;
            // A swipe purged while this write was in flight: drop the stale
            // entry instead of re-tracking it.
            if ((userFeedVersion.get(userId) ?? 0) !== version) {
              try {
                await caches.default.delete(url);
              } catch {
                // TTL backstop covers it.
              }
              return;
            }
            trackUserFeedUrl(userId, url);
          },
          () => {},
        );
        try {
          c.executionCtx.waitUntil(write);
        } catch {
          // No executionCtx (tests, some dev servers): finish inline so
          // behavior stays deterministic; prod stays fire-and-forget.
          await write;
        }
      }
    } catch {
      // Best-effort edge cache only — the response is already built.
    }
    return res;
  });

  app.get("/by_salary", async (c) => {
    const area = c.req.query("area") ?? "99";
    const page = parsePage(c.req.query("page"));
    return c.json(
      await pagedRoi(
        db,
        eq(careerRoi.area_code, area),
        orderSalaryDesc,
        page,
        ROI_TOP_PER_PAGE,
        await summaryCount(db, `area:${area}`),
      ),
    );
  });

  app.get("/by_roi", async (c) => {
    const area = c.req.query("area") ?? "99";
    const page = parsePage(c.req.query("page"));
    return c.json(
      await pagedRoi(
        db,
        eq(careerRoi.area_code, area),
        orderRoiDesc,
        page,
        ROI_TOP_PER_PAGE,
        await summaryCount(db, `area:${area}`),
      ),
    );
  });

  app.get("/by_breakeven", async (c) => {
    const area = c.req.query("area") ?? "99";
    const page = parsePage(c.req.query("page"));
    return c.json(
      await pagedRoi(
        db,
        eq(careerRoi.area_code, area),
        orderBreakevenAsc,
        page,
        ROI_TOP_PER_PAGE,
        await summaryCount(db, `area:${area}`),
      ),
    );
  });

  app.get("/search", async (c) => {
    const rawQuery = c.req.query("q");
    // Rails uses query.present?, which also rejects whitespace-only input.
    const query = rawQuery?.trim() ?? "";
    const area = c.req.query("area") ?? "99";
    const page = parsePage(c.req.query("page"));
    if (query === "") {
      return c.json({ error: "Query parameter q is required" }, 400);
    }
    return c.json(
      await pagedRoi(
        db,
        and(
          eq(careerRoi.area_code, area),
          like(careerRoi.occupation_name, `%${query}%`),
        ),
        orderRoiDesc,
        page,
        ROI_TOP_PER_PAGE,
      ),
    );
  });

  app.get("/map_summary", async (c) => {
    // Identical for everyone: edge-cache by URL (map data changes on re-seed).
    try {
      if (typeof caches !== "undefined") {
        const hit = await caches.default.match(c.req.url);
        if (hit) return hit;
      }
    } catch {
      // Cache API unavailable — D1 path.
    }
    const states: Record<string, unknown> = {};
    const precomputed = await db.select().from(roiMapSummary);
    if (precomputed.length > 0) {
      // Seeded aggregates (~55 rows) — no career_roi scan.
      for (const a of precomputed) {
        states[a.area_code] = {
          hasRecords: a.n > 0,
          avgSalary: a.avgSalary,
          adjustedSalary: a.avgAdjusted,
          medianRoi: a.medianRoi,
          highRoiCount: a.highRoiCount,
          demandCount: a.demandCount,
          demandAvgRank: a.demandAvgRank,
        };
      }
    } else {
      // Fresh DB (not seeded yet): live computation, two full scans.
      // SQLite port of the Postgres aggregate: no PERCENTILE_CONT / FILTER /
      // regex match, so medians are computed in JS below.
      const aggregates = await db.all<{
        area_code: string;
        n: number;
        avg_salary: number | null;
        avg_adjusted: number | null;
        high_roi: number;
        demand_count: number;
        demand_avg_rank: number | null;
      }>(sql`SELECT area_code,
      COUNT(*) AS n,
      AVG(annual_median_salary) AS avg_salary,
      AVG(adjusted_salary) AS avg_adjusted,
      SUM(CASE WHEN roi_percentage >= ${HIGH_ROI_THRESHOLD} THEN 1 ELSE 0 END) AS high_roi,
      SUM(CASE WHEN demand_score IS NOT NULL OR demand_rank IS NOT NULL THEN 1 ELSE 0 END) AS demand_count,
      AVG(demand_rank) AS demand_avg_rank
      FROM career_roi
      WHERE (area_code GLOB '[0-9]' OR area_code GLOB '[0-9][0-9]') AND area_code <> '99'
      GROUP BY area_code`);
      const roiValues = await db.all<{ area_code: string; roi: number | null }>(
        sql`SELECT area_code, roi_percentage AS roi FROM career_roi
          WHERE (area_code GLOB '[0-9]' OR area_code GLOB '[0-9][0-9]') AND area_code <> '99'
          AND roi_percentage IS NOT NULL ORDER BY area_code, roi`,
      );
      const byArea = new Map<string, number[]>();
      for (const r of roiValues) {
        if (r.roi == null) continue;
        const list = byArea.get(r.area_code) ?? [];
        list.push(r.roi);
        byArea.set(r.area_code, list);
      }
      for (const a of aggregates) {
        const sorted = byArea.get(a.area_code) ?? [];
        states[a.area_code] = {
          hasRecords: a.n > 0,
          avgSalary: a.avg_salary,
          adjustedSalary: a.avg_adjusted,
          medianRoi: median(sorted),
          highRoiCount: a.high_roi,
          demandCount: a.demand_count,
          demandAvgRank: a.demand_avg_rank,
        };
      }
    }
    const res = c.json({ states });
    res.headers.set("Cache-Control", "public, max-age=86400");
    try {
      if (typeof caches !== "undefined") {
        c.executionCtx.waitUntil(caches.default.put(c.req.url, res.clone()));
      }
    } catch {
      // Best-effort edge cache only — the response is already built.
    }
    return res;
  });

  app.get("/:id", async (c) => {
    const area = c.req.query("area") ?? "99";
    const normalized = normalizeOccupationCode(c.req.param("id"));
    if (normalized === null) {
      return c.json(
        { error: "Invalid occupation code; expected format XX-XXXX.00" },
        400,
      );
    }
    const rows = await withContent(db)
      .where(
        and(
          eq(careerRoi.occupation_code, normalized),
          eq(careerRoi.area_code, area),
        ),
      )
      .limit(1);
    const row = rows[0];
    if (!row) return c.json({ error: "Career ROI not found" }, 404);
    return c.json(roiJson(row));
  });

  return app;
}

// Matches Postgres PERCENTILE_CONT(0.5) for the sorted non-null values.
function median(sorted: number[]): number | null {
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[mid] as number)
    : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}
