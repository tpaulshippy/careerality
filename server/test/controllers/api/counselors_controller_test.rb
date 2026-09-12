require "test_helper"

class Api::CounselorsControllerTest < ActionDispatch::IntegrationTest
  setup do
    @career = CareerRoi.create!(
      occupation_code: "15-1252",
      occupation_name: "Software Developers",
      area_code: "99",
      area_name: "National",
      annual_median_salary: 130_160,
      education_cost: 40_000,
      years_to_breakeven: 2,
      roi_percentage: 22.5,
      demand_rank: 3,
      demand_score: 99.0
    )
    @user = "counselor-controller-user"
  end

  test "chat returns a reply for a greeting" do
    post "/api/counselor/chat", params: { user_id: @user, message: "hi" }, as: :json
    assert_response :success
    body = JSON.parse(response.body)
    assert body["reply"].present?
    assert body["quick_replies"].is_a?(Array)
  end

  test "chat returns suggestions payload with career fields" do
    post "/api/counselor/chat", params: { user_id: @user, message: "Explain ROI for software developers" }, as: :json
    assert_response :success
    body = JSON.parse(response.body)
    suggestion = body["suggestions"].first
    assert_equal "Software Developers", suggestion["occupation_name"]
    assert_equal "15-1252", suggestion["occupation_code"]
    assert suggestion["annual_median_salary"].present?
  end

  test "chat returns 400 without user_id" do
    post "/api/counselor/chat", params: { message: "hi" }, as: :json
    assert_response :bad_request
  end

  test "chat returns 400 without message" do
    post "/api/counselor/chat", params: { user_id: @user }, as: :json
    assert_response :bad_request
  end

  test "chat returns 400 for blank message" do
    post "/api/counselor/chat", params: { user_id: @user, message: "   " }, as: :json
    assert_response :bad_request
  end
end
