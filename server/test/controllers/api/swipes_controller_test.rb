require "test_helper"

class Api::SwipesControllerTest < ActionDispatch::IntegrationTest
  setup do
    @career = CareerRoi.create!(
      occupation_code: "15-1251",
      occupation_name: "Software Developer",
      area_code: "99",
      area_name: "National",
      industry_code: "cross-industry"
    )
    @user = "user1"
  end

  test "liked returns right-swiped careers" do
    Swipe.create!(career_id: @career.id, user_id: @user, direction: "right")
    get "/api/swipes/liked", params: { user_id: @user }
    assert_response :success
    records = JSON.parse(response.body)["records"]
    assert_equal 1, records.length
    assert_equal @career.id, records.first["id"]
    assert_equal "Software Developer", records.first["occupation_name"]
  end

  test "liked excludes left swipes" do
    Swipe.create!(career_id: @career.id, user_id: @user, direction: "left")
    get "/api/swipes/liked", params: { user_id: @user }
    assert_response :success
    records = JSON.parse(response.body)["records"]
    assert_equal 0, records.length
  end

  test "liked skips orphaned swipes without emptying list" do
    orphan_career = CareerRoi.create!(
      occupation_code: "11-1021",
      occupation_name: "General Manager",
      area_code: "99",
      area_name: "National",
      industry_code: "cross-industry"
    )
    Swipe.create!(career_id: @career.id, user_id: @user, direction: "right")
    Swipe.create!(career_id: orphan_career.id, user_id: @user, direction: "right")
    orphan_career.destroy
    get "/api/swipes/liked", params: { user_id: @user }
    assert_response :success
    records = JSON.parse(response.body)["records"]
    assert_equal 1, records.length
    assert_equal @career.id, records.first["id"]
  end

  test "create persists swipe" do
    assert_difference("Swipe.count", 1) do
      post "/api/swipes",
           params: { career_id: @career.id, user_id: @user, direction: "right", feedback: "nice" }
    end
    assert_response :created
    assert Swipe.find_by(career_id: @career.id, user_id: @user, direction: "right")
  end

  test "create rejects invalid direction" do
    assert_no_difference("Swipe.count") do
      post "/api/swipes", params: { career_id: @career.id, user_id: @user, direction: "up" }
    end
    assert_response :unprocessable_entity
  end

  test "destroy removes own swipe" do
    swipe = Swipe.create!(career_id: @career.id, user_id: @user, direction: "right")
    assert_difference("Swipe.count", -1) do
      delete "/api/swipes/#{swipe.id}", params: { user_id: @user }
    end
    assert_response :success
    assert_nil Swipe.find_by(id: swipe.id)
  end

  test "destroy 404 for other user" do
    swipe = Swipe.create!(career_id: @career.id, user_id: @user, direction: "right")
    assert_no_difference("Swipe.count") do
      delete "/api/swipes/#{swipe.id}", params: { user_id: "other" }
    end
    assert_response :not_found
    assert Swipe.exists?(id: swipe.id)
  end

  test "destroy_all deletes all swipes for the user" do
    Swipe.create!(career_id: @career.id, user_id: @user, direction: "right")
    Swipe.create!(career_id: @career.id, user_id: @user, direction: "left")
    assert_difference("Swipe.count", -2) do
      delete "/api/swipes/destroy_all", params: { user_id: @user }
    end
    assert_response :success
    assert_equal 0, Swipe.where(user_id: @user).count
  end

  test "destroy_all leaves other users' swipes" do
    Swipe.create!(career_id: @career.id, user_id: @user, direction: "right")
    other = Swipe.create!(career_id: @career.id, user_id: "other", direction: "right")
    assert_difference("Swipe.count", -1) do
      delete "/api/swipes/destroy_all", params: { user_id: @user }
    end
    assert_response :success
    assert Swipe.exists?(id: other.id)
  end

  test "destroy_all returns deleted count" do
    Swipe.create!(career_id: @career.id, user_id: @user, direction: "right")
    Swipe.create!(career_id: @career.id, user_id: @user, direction: "left")
    delete "/api/swipes/destroy_all", params: { user_id: @user }
    assert_response :success
    assert_equal 2, JSON.parse(response.body)["deleted"]
  end

  test "destroy_all returns 400 without user_id" do
    assert_no_difference("Swipe.count") do
      delete "/api/swipes/destroy_all"
    end
    assert_response :bad_request
  end

  test "destroy_all returns 400 for blank user_id" do
    assert_no_difference("Swipe.count") do
      delete "/api/swipes/destroy_all", params: { user_id: "" }
    end
    assert_response :bad_request
  end
end
