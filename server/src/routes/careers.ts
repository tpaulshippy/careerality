import { Hono } from "hono";
import { asc, count, eq } from "drizzle-orm";
import type { AppDb } from "../db/client";
import { salaryOccupations } from "../db/schema";
import type { Env } from "../env";
import { normalizeOccupationCode } from "../lib/normalize";
import { offset, pagy, parsePage } from "../lib/pagination";

export interface CareerRow {
  occupation_code: string;
  occupation_name: string | null;
  occupation_description: string | null;
  display_level: number | null;
}

// Mirrors Rails Career#as_json.
export function careerJson(row: CareerRow) {
  return {
    code: row.occupation_code,
    name: row.occupation_name,
    description: row.occupation_description,
    level: row.display_level,
  };
}

const CAREERS_PER_PAGE = 10;

export function careersRoute(db: AppDb) {
  const app = new Hono<{ Bindings: Env }>();

  app.get("/", async (c) => {
    const page = parsePage(c.req.query("page"));
    const whereSelectable = eq(salaryOccupations.selectable, "T");
    const totalRows = await db
      .select({ n: count() })
      .from(salaryOccupations)
      .where(whereSelectable);
    const total = totalRows[0]?.n ?? 0;
    const rows = await db
      .select({
        occupation_code: salaryOccupations.occupation_code,
        occupation_name: salaryOccupations.occupation_name,
        occupation_description: salaryOccupations.occupation_description,
        display_level: salaryOccupations.display_level,
      })
      .from(salaryOccupations)
      .where(whereSelectable)
      .orderBy(asc(salaryOccupations.sort_sequence))
      .limit(CAREERS_PER_PAGE)
      .offset(offset(page, CAREERS_PER_PAGE));
    return c.json({
      careers: rows.map(careerJson),
      pagy: pagy(total, page, CAREERS_PER_PAGE),
    });
  });

  app.get("/:id", async (c) => {
    const normalized = normalizeOccupationCode(c.req.param("id"));
    if (normalized === null) {
      return c.json({ error: "Invalid occupation code" }, 400);
    }
    const rows = await db
      .select({
        occupation_code: salaryOccupations.occupation_code,
        occupation_name: salaryOccupations.occupation_name,
        occupation_description: salaryOccupations.occupation_description,
        display_level: salaryOccupations.display_level,
      })
      .from(salaryOccupations)
      .where(eq(salaryOccupations.occupation_code, normalized))
      .limit(1);
    const row = rows[0];
    if (!row) return c.json({ error: "Career not found" }, 404);
    return c.json(careerJson(row));
  });

  return app;
}
