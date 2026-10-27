-- D1 (SQLite) schema for the Careerality API.
-- Minimal serving set migrated from Postgres; see ../README.md ("Data migration").
-- Applied automatically by `wrangler deploy` / `wrangler dev` via migrations_dir.
-- Keep in sync with src/db/schema.ts (drizzle-kit source of truth).

CREATE TABLE career_roi (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  occupation_code TEXT NOT NULL,
  occupation_name TEXT,
  area_code TEXT,
  area_name TEXT,
  annual_median_salary REAL,
  education_cost REAL,
  years_to_breakeven INTEGER,
  roi_percentage REAL,
  job_zone INTEGER,
  education_level TEXT,
  skills TEXT,
  cost_of_living_index REAL,
  adjusted_salary REAL,
  industry_code TEXT,
  industry_name TEXT,
  demand_rank INTEGER,
  avg_annual_openings INTEGER,
  projected_growth_percent REAL,
  demand_score REAL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX index_career_roi_on_unique_key ON career_roi (occupation_code, area_code, industry_code);
CREATE INDEX index_career_roi_on_area_code ON career_roi (area_code);
CREATE INDEX index_career_roi_on_area_code_and_roi_percentage ON career_roi (area_code, roi_percentage);
CREATE INDEX index_career_roi_on_area_code_and_annual_median_salary ON career_roi (area_code, annual_median_salary);
CREATE INDEX index_career_roi_on_area_code_and_years_to_breakeven ON career_roi (area_code, years_to_breakeven);
CREATE INDEX index_career_roi_on_area_code_and_demand_score ON career_roi (area_code, demand_score);
CREATE INDEX index_career_roi_on_roi_percentage ON career_roi (roi_percentage);
CREATE INDEX index_career_roi_on_annual_median_salary ON career_roi (annual_median_salary);
CREATE INDEX index_career_roi_on_years_to_breakeven ON career_roi (years_to_breakeven);

CREATE TABLE career_contents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  occupation_code TEXT NOT NULL,
  day_in_life_summary TEXT,
  day_in_life_full TEXT,
  video_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX index_career_contents_on_occupation_code ON career_contents (occupation_code);

CREATE TABLE salary_occupations (
  occupation_code TEXT PRIMARY KEY,
  occupation_name TEXT,
  occupation_description TEXT,
  display_level INTEGER,
  selectable TEXT,
  sort_sequence INTEGER
);
CREATE INDEX index_salary_occupations_on_selectable_and_sort_sequence ON salary_occupations (selectable, sort_sequence);

CREATE TABLE career_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  occupation_code TEXT NOT NULL,
  image_url TEXT,
  prompt_used TEXT,
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX index_career_images_on_occupation_code_and_position ON career_images (occupation_code, position);

CREATE TABLE swipes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  career_id INTEGER REFERENCES career_roi (id) ON DELETE SET NULL,
  user_id TEXT,
  direction TEXT,
  feedback TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX index_swipes_on_user_id ON swipes (user_id);
CREATE INDEX index_swipes_on_user_id_and_direction ON swipes (user_id, direction);
CREATE INDEX index_swipes_on_user_id_and_created_at ON swipes (user_id, created_at);
