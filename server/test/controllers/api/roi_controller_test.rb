require "test_helper"

class Api::RoiControllerTest < ActionDispatch::IntegrationTest
  setup do
    @industry = "00"
  end

  def make_roi(occupation_code, area_code:, demand_score: nil, roi_percentage: 10.0,
                 occupation_name: nil, annual_median_salary: 50_000, education_level: "Bachelor's degree",
                 skills: nil)
    CareerRoi.create!(
      occupation_code: occupation_code,
      occupation_name: occupation_name || "Career #{occupation_code}",
      area_code: area_code,
      area_name: "Area #{area_code}",
      industry_code: @industry,
      industry_name: "Industry",
      annual_median_salary: annual_median_salary,
      education_cost: 10_000,
      years_to_breakeven: 2,
      roi_percentage: roi_percentage,
      job_zone: 1,
      education_level: education_level,
      skills: skills,
      cost_of_living_index: 100.0,
      adjusted_salary: annual_median_salary,
      demand_score: demand_score
    )
  end

  def record_ids(page)
    get api_roi_index_path, params: { area_code: @area, sort: "demand", page: page }
    assert_response :success
    response.parsed_body["records"].map { |r| r["id"] }
  end

  test "demand sort is stable across pages" do
    @area = "S1"
    25.times do |i|
      make_roi(format("11-10%02d.00", i + 1), area_code: @area, demand_score: (25 - i).to_f)
    end

    page1_ids = record_ids(1)
    page2_ids = record_ids(2)

    assert_equal 20, page1_ids.size
    assert_equal 5, page2_ids.size
    assert_equal 25, response.parsed_body["pagy"]["count"]
    assert_equal 25, (page1_ids + page2_ids).uniq.size
  end

  test "demand sort orders by demand_score desc" do
    @area = "S2"
    5.times do |i|
      make_roi(format("12-20%02d.00", i + 1), area_code: @area, demand_score: (5 - i).to_f)
    end

    get api_roi_index_path, params: { area_code: @area, sort: "demand" }
    assert_response :success
    scores = response.parsed_body["records"].map { |r| r["demand_score"].to_f }
    assert_equal scores, scores.sort.reverse
  end

  test "demand falls back to roi when no demand_score" do
    @area = "S3"
    make_roi("13-3001.00", area_code: @area, demand_score: nil, roi_percentage: 30.0)
    make_roi("13-3002.00", area_code: @area, demand_score: nil, roi_percentage: 20.0)
    make_roi("13-3003.00", area_code: @area, demand_score: nil, roi_percentage: 10.0)

    get api_roi_index_path, params: { area_code: @area, sort: "demand" }
    assert_response :success
    records = response.parsed_body["records"]
    assert records.any?, "expected records to be returned"
    assert_equal [ 30.0, 20.0, 10.0 ], records.map { |r| r["roi_percentage"].to_f }
  end

  test "index filters by area_code" do
    make_roi("14-4001.00", area_code: "S4", demand_score: 0.5)
    make_roi("14-4002.00", area_code: "S4", demand_score: 0.4)
    make_roi("15-5001.00", area_code: "S5", demand_score: 0.9)

    get api_roi_index_path, params: { area_code: "S4", sort: "demand" }
    assert_response :success
    area_codes = response.parsed_body["records"].map { |r| r["area_code"] }.uniq
    assert_equal [ "S4" ], area_codes
    assert_equal 2, response.parsed_body["pagy"]["count"]
  end

  test "index excludes swiped careers" do
    @area = "S6"
    target = make_roi("16-6001.00", area_code: @area, demand_score: 0.5)
    other = make_roi("16-6002.00", area_code: @area, demand_score: 0.4)
    Swipe.create!(career_id: target.id, user_id: "u-s6", direction: "right")

    get api_roi_index_path, params: { area_code: @area, sort: "demand", user_id: "u-s6" }
    assert_response :success
    ids = response.parsed_body["records"].map { |r| r["id"] }
    assert_not_includes ids, target.id
    assert_includes ids, other.id
  end

  test "search filters by min_salary and echoes applied filters" do
    make_roi("17-7001.00", area_code: "S7", occupation_name: "Registered Nurse High",
             annual_median_salary: 120_000)
    make_roi("17-7002.00", area_code: "S7", occupation_name: "Registered Nurse Low",
             annual_median_salary: 40_000)

    get search_api_roi_index_path, params: { q: "Nurse", area: "S7", min_salary: 80_000 }
    assert_response :success
    records = response.parsed_body["records"]
    assert_equal [ "Registered Nurse High" ], records.map { |r| r["occupation_name"] }
    assert_equal 80_000.0, response.parsed_body["applied"]["min_salary"]
    assert_nil response.parsed_body["applied"]["education_pathway"]
  end

  test "search filters by education_pathway" do
    make_roi("17-7003.00", area_code: "S7", occupation_name: "Nurse Bachelor",
             education_level: "Bachelor's degree")
    make_roi("17-7004.00", area_code: "S7", occupation_name: "Nurse Diploma",
             education_level: "High school diploma")

    get search_api_roi_index_path, params: { q: "Nurse", area: "S7", education_pathway: "bachelor" }
    assert_response :success
    records = response.parsed_body["records"]
    assert_equal [ "Nurse Bachelor" ], records.map { |r| r["occupation_name"] }
    assert_equal "bachelor", response.parsed_body["applied"]["education_pathway"]
  end

  test "search leaves apprenticeship and unknown pathways unfiltered" do
    make_roi("17-7005.00", area_code: "S7", occupation_name: "Nurse Bachelor",
             education_level: "Bachelor's degree")
    make_roi("17-7006.00", area_code: "S7", occupation_name: "Nurse Diploma",
             education_level: "High school diploma")

    get search_api_roi_index_path, params: { q: "Nurse", area: "S7", education_pathway: "apprenticeship" }
    assert_response :success
    assert_equal 2, response.parsed_body["records"].size
    assert_nil response.parsed_body["applied"]["education_pathway"]

    get search_api_roi_index_path, params: { q: "Nurse", area: "S7", education_pathway: "no school lol" }
    assert_response :success
    assert_equal 2, response.parsed_body["records"].size
    assert_nil response.parsed_body["applied"]["education_pathway"]
  end

  test "search tokenizes sentences across name, skills and day-in-life" do
    make_roi("18-8001.00", area_code: "S8", occupation_name: "Registered Nurse",
             roi_percentage: 10.0)
    make_roi("18-8002.00", area_code: "S8", occupation_name: "Helper",
             skills: [ "Kindness" ], roi_percentage: 30.0)
    make_roi("18-8003.00", area_code: "S8", occupation_name: "Janitor",
             roi_percentage: 20.0)
    CareerContent.create!(
      occupation_code: "18-8003.00",
      day_in_life_summary: "A quiet day full of kindness and mops.",
      day_in_life_full: "Full."
    )

    get search_api_roi_index_path, params: { q: "nurse kindness", area: "S8" }
    assert_response :success
    names = response.parsed_body["records"].map { |r| r["occupation_name"] }
    assert_equal [ "Registered Nurse", "Helper", "Janitor" ], names
  end

  test "single keyword keeps ROI order" do
    make_roi("18-8004.00", area_code: "S8", occupation_name: "Nurse Low", roi_percentage: 5.0)
    make_roi("18-8005.00", area_code: "S8", occupation_name: "Nurse High", roi_percentage: 25.0)

    get search_api_roi_index_path, params: { q: "Nurse", area: "S8" }
    assert_response :success
    names = response.parsed_body["records"].map { |r| r["occupation_name"] }
    assert_equal [ "Nurse High", "Nurse Low" ], names
  end

  test "filters narrow the tokenized path" do
    make_roi("18-8006.00", area_code: "S8", occupation_name: "Office Nurse",
             annual_median_salary: 120_000, education_level: "Bachelor's degree")
    make_roi("18-8007.00", area_code: "S8", occupation_name: "Office Aide",
             annual_median_salary: 40_000, education_level: "High school diploma")

    get search_api_roi_index_path, params: {
      q: "I want an office job that pays plenty", area: "S8",
      min_salary: 80_000, education_pathway: "bachelor"
    }
    assert_response :success
    records = response.parsed_body["records"]
    assert_equal [ "Office Nurse" ], records.map { |r| r["occupation_name"] }
  end

  test "map summary aggregates state rows" do
    make_roi("16-6003.00", area_code: "7", demand_score: 0.5, roi_percentage: 6.0)
    make_roi("16-6004.00", area_code: "7", demand_score: nil, roi_percentage: 14.0)
    make_roi("16-6005.00", area_code: "7", demand_score: 0.2, roi_percentage: 20.0)
    make_roi("16-6006.00", area_code: "99", demand_score: 0.9, roi_percentage: 40.0)

    get map_summary_api_roi_index_path
    assert_response :success
    summary = response.parsed_body.fetch("states").fetch("7")
    assert_equal 1, summary["highRoiCount"]
    assert_equal 14.0, summary["medianRoi"]
    assert_equal 2, summary["demandCount"]
  end
end
