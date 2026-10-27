import { Hono } from "hono";
import { and, desc, eq, isNull, type SQL } from "drizzle-orm";
import type { AppDb } from "../db/client";
import { careerContents, careerRoi, swipes } from "../db/schema";
import type { Env } from "../env";
import { roiJson, type RoiRow } from "./roi";

function nowIso(): string {
  return new Date().toISOString();
}

// Mirrors Rails `where(user_id: ...)` exactly: a missing user_id matches
// IS NULL (i.e. nothing, since user_id is always set on write).
function userIdMatch(userId: string | null): SQL {
  return userId == null ? isNull(swipes.user_id) : eq(swipes.user_id, userId);
}

export function swipesRoute(db: AppDb) {
  const app = new Hono<{ Bindings: Env }>();

  app.get("/", async (c) => {
    const userId = c.req.query("user_id") ?? null;
    const rows = await db
      .select()
      .from(swipes)
      .where(userIdMatch(userId))
      .orderBy(desc(swipes.created_at));
    return c.json({ swipes: rows });
  });

  app.get("/liked", async (c) => {
    const userId = c.req.query("user_id") ?? null;
    const rows = await db
      .select({
        swipe_id: swipes.id,
        swiped_at: swipes.created_at,
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
        day_in_life_summary: careerContents.day_in_life_summary,
        day_in_life_full: careerContents.day_in_life_full,
        video_url: careerContents.video_url,
      })
      .from(swipes)
      .leftJoin(careerRoi, eq(careerRoi.id, swipes.career_id))
      .leftJoin(
        careerContents,
        eq(careerContents.occupation_code, careerRoi.occupation_code),
      )
      .where(and(userIdMatch(userId), eq(swipes.direction, "right")))
      .orderBy(desc(swipes.created_at));

    const records = rows.flatMap((r) => {
      // Matches Rails filter_map: swipes whose career was deleted drop out.
      if (r.id == null || r.occupation_code == null) return [];
      const base = roiJson(r as RoiRow);
      return [
        {
          ...base,
          swipe_id: r.swipe_id,
          swiped_at: r.swiped_at,
        },
      ];
    });
    return c.json({ records });
  });

  app.post("/", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const errors: string[] = [];
    const careerId =
      typeof body?.career_id === "number" ? body.career_id : null;
    const userId =
      typeof body?.user_id === "string" && body.user_id !== ""
        ? body.user_id
        : null;
    const direction =
      body?.direction === "left" || body?.direction === "right"
        ? body.direction
        : null;
    if (careerId == null) errors.push("Career can't be blank");
    if (userId == null) errors.push("User can't be blank");
    if (direction == null)
      errors.push("Direction is not included in the list");
    if (errors.length > 0) return c.json({ error: errors }, 422);

    const timestamp = nowIso();
    const inserted = await db
      .insert(swipes)
      .values({
        career_id: careerId,
        user_id: userId,
        direction,
        feedback:
          typeof body?.feedback === "string" ? body.feedback : null,
        created_at: timestamp,
        updated_at: timestamp,
      })
      .returning();
    return c.json(inserted[0], 201);
  });

  app.delete("/destroy_all", async (c) => {
    const userId = c.req.query("user_id");
    if (!userId) {
      return c.json({ error: "user_id is required" }, 400);
    }
    const deleted = await db
      .delete(swipes)
      .where(eq(swipes.user_id, userId))
      .returning({ id: swipes.id });
    return c.json({ deleted: deleted.length });
  });

  app.delete("/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const userId = c.req.query("user_id") ?? null;
    if (!Number.isInteger(id)) {
      return c.json({ error: "Swipe not found" }, 404);
    }
    const found = await db
      .select({ id: swipes.id })
      .from(swipes)
      .where(and(eq(swipes.id, id), userIdMatch(userId)))
      .limit(1);
    if (!found[0]) return c.json({ error: "Swipe not found" }, 404);
    await db.delete(swipes).where(eq(swipes.id, id));
    return c.json({ success: true });
  });

  return app;
}
