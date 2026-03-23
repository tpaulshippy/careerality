# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.0].define(version: 2026_03_20_054857) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "bls_soc_crosswalk", id: :serial, force: :cascade do |t|
    t.string "oews_code", limit: 10
    t.string "soc_code", limit: 20
    t.string "soc_title", limit: 255
    t.string "sector_code", limit: 10
    t.datetime "created_at", precision: nil, default: -> { "CURRENT_TIMESTAMP" }

    t.unique_constraint ["oews_code"], name: "bls_soc_crosswalk_oews_code_key"
  end

  create_table "bls_state_wages", id: :serial, force: :cascade do |t|
    t.string "area"
    t.text "area_title"
    t.integer "area_type"
    t.string "prim_state"
    t.string "naics"
    t.text "naics_title"
    t.string "i_group"
    t.integer "own_code"
    t.string "occ_code"
    t.text "occ_title"
    t.string "o_group"
    t.integer "tot_emp"
    t.decimal "emp_prse"
    t.decimal "h_mean"
    t.decimal "a_mean"
    t.decimal "h_median"
    t.decimal "a_median"
    t.integer "year", default: 2024

    t.unique_constraint ["occ_code", "area", "naics", "own_code"], name: "bls_state_wages_occ_code_area_naics_own_code_key"
  end

  create_table "career_cost_of_living", id: :serial, force: :cascade do |t|
    t.string "area_code", limit: 10
    t.string "area_name", limit: 255
    t.decimal "col_index"
    t.decimal "grocery_index"
    t.decimal "housing_index"
    t.decimal "utilities_index"
    t.decimal "transportation_index"
    t.decimal "misc_index"
    t.integer "year"
    t.integer "quarter"
    t.datetime "created_at", precision: nil, default: -> { "CURRENT_TIMESTAMP" }
    t.datetime "updated_at", precision: nil, default: -> { "CURRENT_TIMESTAMP" }

    t.unique_constraint ["area_code", "year", "quarter"], name: "career_cost_of_living_area_code_year_quarter_key"
  end

  create_table "career_education_costs", id: :serial, force: :cascade do |t|
    t.string "occupation_code", limit: 20
    t.integer "unitid"
    t.string "institution_name", limit: 255
    t.decimal "program_length_years"
    t.decimal "tuition_in_state"
    t.decimal "tuition_out_of_state"
    t.decimal "fees"
    t.decimal "room_and_board"
    t.decimal "books_and_supplies"
    t.decimal "other_costs"
    t.decimal "total_cost"
    t.jsonb "financial_aid"
    t.datetime "created_at", precision: nil, default: -> { "CURRENT_TIMESTAMP" }
    t.datetime "updated_at", precision: nil, default: -> { "CURRENT_TIMESTAMP" }
  end

  create_table "career_profiles", id: :serial, force: :cascade do |t|
    t.string "occupation_code", limit: 20
    t.string "occupation_name", limit: 255
    t.text "occupation_description"
    t.jsonb "onet_data"
    t.integer "job_zone"
    t.string "education_level", limit: 50
    t.string "experience_required", limit: 50
    t.jsonb "skills"
    t.jsonb "tasks"
    t.jsonb "work_activities"
    t.datetime "created_at", precision: nil, default: -> { "CURRENT_TIMESTAMP" }
    t.datetime "updated_at", precision: nil, default: -> { "CURRENT_TIMESTAMP" }

    t.unique_constraint ["occupation_code"], name: "career_profiles_occupation_code_key"
  end

  create_table "career_roi", force: :cascade do |t|
    t.string "occupation_code", limit: 20, null: false
    t.string "occupation_name", limit: 255
    t.string "area_code", limit: 10
    t.string "area_name", limit: 255
    t.decimal "annual_median_salary", precision: 12, scale: 2
    t.decimal "education_cost", precision: 12, scale: 2
    t.integer "years_to_breakeven"
    t.decimal "roi_percentage", precision: 10, scale: 2
    t.integer "job_zone"
    t.string "education_level", limit: 50
    t.jsonb "skills"
    t.decimal "cost_of_living_index", precision: 8, scale: 2
    t.decimal "adjusted_salary", precision: 12, scale: 2
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "industry_code", limit: 50
    t.string "industry_name", limit: 255
    t.integer "demand_rank"
    t.integer "avg_annual_openings"
    t.decimal "projected_growth_percent"
    t.decimal "demand_score", precision: 10, scale: 4
    t.index ["annual_median_salary"], name: "index_career_roi_on_annual_median_salary"
    t.index ["occupation_code", "area_code", "industry_code"], name: "index_career_roi_on_unique_key", unique: true
    t.index ["roi_percentage"], name: "index_career_roi_on_roi_percentage"
    t.index ["years_to_breakeven"], name: "index_career_roi_on_years_to_breakeven"
  end

  create_table "career_salaries", id: :serial, force: :cascade do |t|
    t.string "occupation_code", limit: 20
    t.string "area_code", limit: 10
    t.integer "year"
    t.decimal "hourly_mean_wage"
    t.decimal "annual_mean_wage"
    t.decimal "hourly_median_wage"
    t.decimal "annual_median_wage"
    t.decimal "hourly_10th_percentile"
    t.decimal "hourly_25th_percentile"
    t.decimal "hourly_75th_percentile"
    t.decimal "hourly_90th_percentile"
    t.decimal "annual_10th_percentile"
    t.decimal "annual_25th_percentile"
    t.decimal "annual_75th_percentile"
    t.decimal "annual_90th_percentile"
    t.integer "employment"
    t.decimal "location_quotient"
    t.datetime "created_at", precision: nil, default: -> { "CURRENT_TIMESTAMP" }
    t.datetime "updated_at", precision: nil, default: -> { "CURRENT_TIMESTAMP" }

    t.unique_constraint ["occupation_code", "area_code", "year"], name: "career_salaries_occupation_code_area_code_year_key"
  end

  create_table "cip_soc_crosswalk", id: :serial, force: :cascade do |t|
    t.string "soc_code", limit: 10
    t.string "cip_code", limit: 10
    t.string "cip_title", limit: 255
    t.boolean "is_primary", default: false
    t.datetime "created_at", precision: nil, default: -> { "CURRENT_TIMESTAMP" }
  end

  create_table "cost_of_living", id: :serial, force: :cascade do |t|
    t.string "area", limit: 255
    t.decimal "col_index"
    t.decimal "grocery_index"
    t.decimal "housing_index"
    t.decimal "utilities_index"
    t.decimal "transportation_index"
    t.decimal "misc_index"
    t.integer "year"
    t.integer "quarter"
  end

  create_table "education_cost_by_state_occupation", id: :serial, force: :cascade do |t|
    t.string "state", limit: 2
    t.string "occ_code", limit: 20
    t.string "occ_title", limit: 255
    t.decimal "median_annual_wage"
    t.string "education_level", limit: 100
    t.integer "education_data_value"
    t.string "cip_code", limit: 10
    t.string "cip_title", limit: 255
    t.decimal "avg_tuition"
    t.integer "total_completions"
    t.integer "year", default: 2024
    t.datetime "created_at", precision: nil, default: -> { "CURRENT_TIMESTAMP" }

    t.unique_constraint ["state", "occ_code"], name: "education_cost_by_state_occupation_state_occ_code_key"
  end

  create_table "institutional_characteristics", primary_key: "unitid", id: :integer, default: nil, force: :cascade do |t|
    t.string "tuition_pl", limit: 10
    t.string "room", limit: 1
    t.decimal "room_amt"
    t.string "board", limit: 1
    t.decimal "board_amt"
    t.decimal "applfee_u"
    t.decimal "year_school"
  end

  create_table "institutions", primary_key: "unitid", id: :integer, default: nil, force: :cascade do |t|
    t.string "institution_name", limit: 255
    t.string "address", limit: 255
    t.string "city", limit: 100
    t.string "state", limit: 2
    t.string "zip", limit: 20
    t.integer "sector"
    t.integer "control"
    t.integer "iclevel"
    t.integer "hloffer"
    t.integer "cbsa"
    t.integer "locele"
  end

  create_table "ipeds_completions", id: :serial, force: :cascade do |t|
    t.integer "unitid"
    t.string "cipcode", limit: 10
    t.integer "ctotalt"
    t.integer "year", default: 2023

    t.unique_constraint ["unitid", "cipcode", "year"], name: "ipeds_completions_unitid_cipcode_year_key"
  end

  create_table "ipeds_cost", id: :serial, force: :cascade do |t|
    t.integer "unitid"
    t.jsonb "data"
  end

  create_table "onet_data", id: :serial, force: :cascade do |t|
    t.string "data_type", limit: 50
    t.jsonb "data"
  end

  create_table "onet_education", id: :serial, force: :cascade do |t|
    t.string "onet_soc_code", limit: 20
    t.integer "category"
    t.string "category_label", limit: 100
    t.integer "data_value"
    t.string "data_value_label", limit: 100
    t.datetime "created_at", precision: nil, default: -> { "CURRENT_TIMESTAMP" }
  end

  create_table "onet_soc_crosswalk", id: :serial, force: :cascade do |t|
    t.string "onet_soc_code", limit: 20
    t.string "soc_2018_code", limit: 10
    t.string "soc_2018_title", limit: 255
    t.boolean "is_primary", default: true
  end

  create_table "salaries", id: :serial, force: :cascade do |t|
    t.string "area"
    t.text "area_title"
    t.integer "area_type"
    t.string "prim_state"
    t.string "naics"
    t.text "naics_title"
    t.string "i_group"
    t.integer "own_code"
    t.string "occ_code"
    t.text "occ_title"
    t.string "o_group"
    t.integer "tot_emp"
    t.decimal "emp_prse"
    t.decimal "jobs_1000"
    t.decimal "loc_quotient"
    t.decimal "pct_total"
    t.decimal "pct_rpt"
    t.decimal "h_mean"
    t.decimal "a_mean"
    t.decimal "mean_prse"
    t.decimal "h_pct10"
    t.decimal "h_pct25"
    t.decimal "h_median"
    t.decimal "h_pct75"
    t.decimal "h_pct90"
    t.decimal "a_pct10"
    t.decimal "a_pct25"
    t.decimal "a_median"
    t.decimal "a_pct75"
    t.decimal "a_pct90"
    t.decimal "annual"
    t.decimal "hourly"
    t.integer "year", default: 2024

    t.unique_constraint ["occ_code", "area", "naics", "own_code"], name: "salaries_occ_code_area_naics_own_code_key"
  end

  create_table "salary_areas", primary_key: "area_code", id: { type: :string, limit: 10 }, force: :cascade do |t|
    t.string "state_code", limit: 2
    t.string "areatype_code", limit: 1
    t.string "area_name", limit: 255
  end

  create_table "salary_data", primary_key: "series_id", id: { type: :string, limit: 50 }, force: :cascade do |t|
    t.integer "year"
    t.string "period", limit: 10
    t.decimal "value"
    t.string "footnote_codes", limit: 10
    t.string "occupation_code", limit: 20
    t.string "area_code", limit: 10
    t.string "industry_code", limit: 20
    t.string "datatype_code", limit: 10
    t.string "sector_code", limit: 10
  end

  create_table "salary_datatypes", primary_key: "datatype_code", id: { type: :string, limit: 10 }, force: :cascade do |t|
    t.string "datatype_name", limit: 255
  end

  create_table "salary_industries", id: :serial, force: :cascade do |t|
    t.string "industry_code", limit: 50
    t.string "industry_name", limit: 255
    t.integer "display_level"
    t.string "selectable", limit: 1
    t.integer "sort_sequence"
  end

  create_table "salary_occupations", primary_key: "occupation_code", id: { type: :string, limit: 20 }, force: :cascade do |t|
    t.string "occupation_name", limit: 255
    t.text "occupation_description"
    t.integer "display_level"
    t.string "selectable", limit: 1
    t.integer "sort_sequence"
  end

  create_table "salary_sector", primary_key: "sector_code", id: { type: :string, limit: 10 }, force: :cascade do |t|
    t.string "sector_name", limit: 255
  end

  create_table "state_employment_projections", id: :serial, force: :cascade do |t|
    t.string "state_fips", limit: 2, null: false
    t.string "state_abbr", limit: 2, null: false
    t.string "occ_code", limit: 10
    t.string "occupation_title", limit: 255
    t.integer "base_employment"
    t.integer "projected_employment"
    t.integer "employment_change"
    t.decimal "percent_change", precision: 10, scale: 2
    t.integer "avg_annual_openings"
    t.integer "base_year"
    t.integer "proj_year"
    t.string "projection_type", limit: 20
    t.datetime "created_at", precision: nil, default: -> { "now()" }
    t.index ["occ_code"], name: "idx_projections_occ_code"
    t.index ["projection_type"], name: "idx_projections_type"
    t.index ["state_fips"], name: "idx_projections_state"
    t.unique_constraint ["state_fips", "occ_code", "projection_type"], name: "state_employment_projections_state_fips_occ_code_projection_key"
  end

  create_table "state_high_demand_careers", id: :serial, force: :cascade do |t|
    t.string "state_fips", limit: 2, null: false
    t.string "state_abbr", limit: 2, null: false
    t.string "occ_code", limit: 10, null: false
    t.string "occupation_title", limit: 255
    t.integer "rank"
    t.string "demand_metric", limit: 50
    t.decimal "demand_value"
    t.integer "base_employment"
    t.integer "projected_employment"
    t.integer "employment_change"
    t.decimal "percent_change", precision: 10, scale: 2
    t.integer "avg_annual_openings"
    t.string "projection_type", limit: 20
    t.integer "base_year"
    t.integer "proj_year"
    t.datetime "created_at", precision: nil, default: -> { "now()" }
    t.index ["occ_code"], name: "idx_high_demand_occ"
    t.index ["state_fips", "state_abbr"], name: "idx_high_demand_state"
    t.unique_constraint ["state_fips", "occ_code", "projection_type", "demand_metric"], name: "state_high_demand_careers_state_fips_occ_code_projection_ty_key"
  end

  create_table "student_financial_aid", id: :serial, force: :cascade do |t|
    t.integer "unitid"
    t.jsonb "data"
  end

  create_table "swipes", force: :cascade do |t|
    t.integer "career_id"
    t.string "user_id"
    t.string "direction"
    t.text "feedback"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end
end
