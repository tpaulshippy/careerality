require "test_helper"

class Api::RoiControllerTest < ActionDispatch::IntegrationTest
  setup do
    @industry = "00"
  end

  def make_roi(occupation_code, area_code:, demand_score: nil, roi_percentage: 10.0)
    CareerRoi.create!(
      occupation_code: occupation_code,
      occupation_name: "Career #{occupation_code}",
      area_code: area_code,
      area_name: "Area #{area_code}",
      industry_code: @industry,
      industry_name: "Industry",
      annual_median_salary: 50_000,
      education_cost: 10_000,
      years_to_breakeven: 2,
      roi_percentage: roi_percentage,
      job_zone: 1,
      education_level: "Bachelor's degree",
      cost_of_living_index: 100.0,
      adjusted_salary: 50_000,
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
end
