import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// Minimal serving set migrated from Postgres (see README + scripts/).
// Raw ETL tables (salaries, ipeds_*, onet_*, bls_*, *_crosswalk, etc.) stay
// in Postgres/the data pipeline; the API never reads them.

// Mirror of Postgres `career_roi` (serving table built by the ETL).
export const careerRoi = sqliteTable(
  "career_roi",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    occupation_code: text("occupation_code").notNull(),
    occupation_name: text("occupation_name"),
    area_code: text("area_code"),
    area_name: text("area_name"),
    annual_median_salary: real("annual_median_salary"),
    education_cost: real("education_cost"),
    years_to_breakeven: integer("years_to_breakeven"),
    roi_percentage: real("roi_percentage"),
    job_zone: integer("job_zone"),
    education_level: text("education_level"),
    // JSONB in Postgres -> JSON text here. Parsed on serialize.
    skills: text("skills"),
    cost_of_living_index: real("cost_of_living_index"),
    adjusted_salary: real("adjusted_salary"),
    industry_code: text("industry_code"),
    industry_name: text("industry_name"),
    demand_rank: integer("demand_rank"),
    avg_annual_openings: integer("avg_annual_openings"),
    projected_growth_percent: real("projected_growth_percent"),
    demand_score: real("demand_score"),
    created_at: text("created_at").notNull(),
    updated_at: text("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("index_career_roi_on_unique_key").on(t.occupation_code, t.area_code, t.industry_code),
    index("index_career_roi_on_area_code").on(t.area_code),
    index("index_career_roi_on_area_code_and_roi_percentage").on(t.area_code, t.roi_percentage),
    index("index_career_roi_on_area_code_and_annual_median_salary").on(t.area_code, t.annual_median_salary),
    index("index_career_roi_on_area_code_and_years_to_breakeven").on(t.area_code, t.years_to_breakeven),
    index("index_career_roi_on_area_code_and_demand_score").on(t.area_code, t.demand_score),
    index("index_career_roi_on_roi_percentage").on(t.roi_percentage),
    index("index_career_roi_on_annual_median_salary").on(t.annual_median_salary),
    index("index_career_roi_on_years_to_breakeven").on(t.years_to_breakeven),
  ],
);

// Mirror of Postgres `career_contents` (day-in-the-life narratives + video).
export const careerContents = sqliteTable(
  "career_contents",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    occupation_code: text("occupation_code").notNull(),
    day_in_life_summary: text("day_in_life_summary"),
    day_in_life_full: text("day_in_life_full"),
    video_url: text("video_url"),
    created_at: text("created_at").notNull(),
    updated_at: text("updated_at").notNull(),
  },
  (t) => [uniqueIndex("index_career_contents_on_occupation_code").on(t.occupation_code)],
);

// Mirror of Postgres `salary_occupations` (backing GET /api/careers).
export const salaryOccupations = sqliteTable(
  "salary_occupations",
  {
    occupation_code: text("occupation_code").primaryKey(),
    occupation_name: text("occupation_name"),
    occupation_description: text("occupation_description"),
    display_level: integer("display_level"),
    selectable: text("selectable"),
    sort_sequence: integer("sort_sequence"),
  },
  (t) => [index("index_salary_occupations_on_selectable_and_sort_sequence").on(t.selectable, t.sort_sequence)],
);

// Mirror of Postgres `career_images`. No endpoint reads it yet (same as
// Rails); kept so generated images survive the migration without a later DDL.
export const careerImages = sqliteTable(
  "career_images",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    occupation_code: text("occupation_code").notNull(),
    image_url: text("image_url"),
    prompt_used: text("prompt_used"),
    position: integer("position").notNull(),
    created_at: text("created_at").notNull(),
    updated_at: text("updated_at").notNull(),
  },
  (t) => [uniqueIndex("index_career_images_on_occupation_code_and_position").on(t.occupation_code, t.position)],
);

// Mirror of Postgres `swipes` (user swipe history).
export const swipes = sqliteTable(
  "swipes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    career_id: integer("career_id").references(() => careerRoi.id, {
      onDelete: "set null",
    }),
    user_id: text("user_id"),
    direction: text("direction"),
    feedback: text("feedback"),
    created_at: text("created_at").notNull(),
    updated_at: text("updated_at").notNull(),
  },
  (t) => [
    index("index_swipes_on_user_id").on(t.user_id),
    index("index_swipes_on_user_id_and_direction").on(t.user_id, t.direction),
    index("index_swipes_on_user_id_and_created_at").on(t.user_id, t.created_at),
  ],
);
