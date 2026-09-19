require "test_helper"

class Api::JevControllerTest < ActionDispatch::IntegrationTest
  test "rank returns fallback results without an API key" do
    old = ENV.delete("TYPESAFE_API_KEY")
    post "/api/jev/rank", params: {
      swipes: [ { occupation_code: "15-1252.00", direction: "right", reason: "salary" } ],
      candidates: [ { occupation_code: "15-1252.00" }, { occupation_code: "29-1141.00" } ]
    }, as: :json
    assert_response :success
    results = JSON.parse(response.body)["results"]
    assert_equal 2, results.length
    assert results.all? { |r| r["provider"] == "fallback" }
  ensure
    ENV["TYPESAFE_API_KEY"] = old if old
  end

  test "rank rejects candidate lists over the maximum" do
    post "/api/jev/rank", params: {
      swipes: [],
      candidates: Array.new(Api::JevController::MAX_CANDIDATES + 1) { { occupation_code: "15-1252.00" } }
    }, as: :json
    assert_response :unprocessable_entity
    assert_match(/too many candidates/, JSON.parse(response.body)["error"])
  end
end
