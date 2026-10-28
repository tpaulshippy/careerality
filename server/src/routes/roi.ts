import { Hono } from "hono";
import {
  and,
  count,
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
import { careerContents, careerRoi, swipes } from "../db/schema";
import type { Env } from "../env";
import { normalizeOccupationCode } from "../lib/normalize";
import { offset, pagy, parsePage } from "../lib/pagination";

export const HIGH_ROI_THRESHOLD = 15;
const ROI_PER_PAGE = 20;
const ROI_TOP_PER_PAGE = 50;

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

async function pagedRoi(
  db: AppDb,
  where: Where,
  order: SQL,
  page: number,
  perPage: number,
) {
  const cond = where ? and(where) : undefined;
  const totalRows = await db
    .select({ n: count() })
    .from(careerRoi)
    .where(cond);
  const total = totalRows[0]?.n ?? 0;
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

    const conditions: Where[] = [areaFilter(area), ...salaryFilters(q)];
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
      const demandRows = await db
        .select({ n: count() })
        .from(careerRoi)
        .where(
          filterWhere
            ? and(filterWhere, isNotNull(careerRoi.demand_score))
            : isNotNull(careerRoi.demand_score),
        );
      const demandCount = demandRows[0]?.n ?? 0;
      if (demandCount > 0) {
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
    const body = await pagedRoi(db, finalWhere, order, page, ROI_PER_PAGE);
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
    return c.json(response);
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
    const states: Record<string, unknown> = {};
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
    return c.json({ states });
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
