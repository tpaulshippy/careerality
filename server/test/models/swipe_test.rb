require "test_helper"

class SwipeTest < ActiveSupport::TestCase
  test "should be valid with all attributes" do
    swipe = Swipe.new(
      career_id: 1,
      user_id: "user123",
      direction: "right",
      feedback: "Great career option"
    )
    assert swipe.valid?
  end

  test "should require career_id" do
    swipe = Swipe.new(user_id: "user123", direction: "right")
    assert_not swipe.valid?
    assert_includes swipe.errors[:career_id], "can't be blank"
  end

  test "should require user_id" do
    swipe = Swipe.new(career_id: 1, direction: "right")
    assert_not swipe.valid?
    assert_includes swipe.errors[:user_id], "can't be blank"
  end

  test "should require direction" do
    swipe = Swipe.new(career_id: 1, user_id: "user123")
    assert_not swipe.valid?
    assert_includes swipe.errors[:direction], "can't be blank"
  end

  test "direction should be left or right" do
    swipe = Swipe.new(career_id: 1, user_id: "user123", direction: "invalid")
    assert_not swipe.valid?
    assert_includes swipe.errors[:direction], "is not included in the list"
  end
end
