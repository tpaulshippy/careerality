require "test_helper"

class StaticPagesTest < ActionDispatch::IntegrationTest
  test "support page linked from the app drawer resolves" do
    get "/support"
    assert_response :success
    assert_includes response.body, "support@careerality.app"
  end

  test "privacy page linked from the app drawer resolves" do
    get "/privacy"
    assert_response :success
  end

  test "delete-data page resolves" do
    get "/delete-data"
    assert_response :success
  end

  test "landing page resolves" do
    get "/"
    assert_response :success
  end
end
