require "test_helper"

module Counselor
  class EngineTest < ActiveSupport::TestCase
    setup do
      @nurses = CareerRoi.create!(
        occupation_code: "29-1141", occupation_name: "Registered Nurses",
        area_code: "99", area_name: "National",
        annual_median_salary: 93_600, education_cost: 45_675,
        years_to_breakeven: 2, roi_percentage: 9.4,
        education_level: "Bachelor's degree", skills: [ "Patient care", "Critical thinking" ],
        demand_rank: 5, demand_score: 98.1
      )
      @developers = CareerRoi.create!(
        occupation_code: "15-1252", occupation_name: "Software Developers",
        area_code: "99", area_name: "National",
        annual_median_salary: 130_160, education_cost: 40_000,
        years_to_breakeven: 2, roi_percentage: 22.5,
        education_level: "Bachelor's degree", skills: [ "Programming", "Problem solving" ],
        demand_rank: 3, demand_score: 99.0
      )
      @electricians = CareerRoi.create!(
        occupation_code: "47-2111", occupation_name: "Electricians",
        area_code: "99", area_name: "National",
        annual_median_salary: 60_240, education_cost: 8_000,
        years_to_breakeven: 1, roi_percentage: 40.0,
        education_level: "High school diploma or equivalent", skills: [ "Problem solving" ],
        demand_rank: 12, demand_score: 90.0
      )
      @dentrists = CareerRoi.create!(
        occupation_code: "29-1292", occupation_name: "Dentists",
        area_code: "99", area_name: "National",
        annual_median_salary: 170_000, education_cost: 250_000,
        years_to_breakeven: 9, roi_percentage: 4.0,
        education_level: "Doctoral or professional degree", skills: [ "Dexterity" ],
        demand_rank: 40, demand_score: 70.0
      )
      @user = "counselor-test-user"
    end

    # --- intent routing -----------------------------------------------------

    def intent_for(message)
      Engine.new(user_id: @user, message: message).detect_intent
    end

    test "routes greeting messages" do
      assert_equal :greeting, intent_for("hi")
      assert_equal :greeting, intent_for("Hello there")
      assert_equal :greeting, intent_for("help")
    end

    test "routes recommend messages" do
      assert_equal :recommend, intent_for("Recommend careers for me")
      assert_equal :recommend, intent_for("can you suggest something?")
    end

    test "routes explain_roi messages" do
      assert_equal :explain_roi, intent_for("Explain ROI for registered nurses")
      assert_equal :explain_roi, intent_for("Is dental school worth it?")
    end

    test "routes compare messages" do
      assert_equal :compare, intent_for("software developers vs electricians")
      assert_equal :compare, intent_for("nurses versus dentists")
    end

    test "routes next_steps messages" do
      assert_equal :next_steps, intent_for("What are my next steps?")
      assert_equal :next_steps, intent_for("how do I become a nurse?")
    end

    test "falls back for unrecognized messages" do
      assert_equal :fallback, intent_for("what is the weather today")
      assert_equal :fallback, intent_for("")
    end

    # --- response shapes ----------------------------------------------------

    test "greeting returns reply and quick replies without suggestions" do
      result = respond_to("hi")
      assert result[:reply].present?
      assert result[:quick_replies].is_a?(Array) && result[:quick_replies].any?
      assert_nil result[:suggestions]
    end

    test "recommend returns three suggestions excluding swiped careers and explains why" do
      Swipe.create!(career_id: @nurses.id, user_id: @user, direction: "right", feedback: "very_interested")
      Swipe.create!(career_id: @electricians.id, user_id: @user, direction: "right", feedback: "very_interested")

      result = respond_to("Recommend careers for me")
      suggestions = result[:suggestions]

      assert_equal 2, suggestions.size
      codes = suggestions.map { |s| s["occupation_code"] }
      assert_includes codes, @developers.occupation_code
      assert_includes codes, @dentrists.occupation_code
      assert_not_includes codes, @nurses.occupation_code
      suggestions.each do |suggestion|
        assert suggestion["occupation_name"].present?
        assert suggestion["annual_median_salary"].present?
      end
      assert_match(/very interested/i, result[:reply])
      assert_match(/Software Developers/, result[:reply])
      assert result[:quick_replies].any? { |qr| qr.include?("Explain ROI") }
    end

    test "recommend with empty history still returns suggestions" do
      result = respond_to("Recommend careers for me")
      assert_equal 3, result[:suggestions].size
      assert_match(/haven't swiped yet/, result[:reply])
    end

    test "explain_roi breaks down the matched career" do
      result = respond_to("Explain ROI for registered nurses")
      assert_match(/Registered Nurses/, result[:reply])
      assert_match(/\$93,600/, result[:reply])
      assert_match(/\$45,675/, result[:reply])
      assert_match(/2 years/, result[:reply])
      assert_match(/9\.4%/, result[:reply])
      assert_equal [ @nurses.occupation_code ], result[:suggestions].map { |s| s["occupation_code"] }
    end

    test "explain_roi asks which career when nothing matches" do
      result = respond_to("explain roi for underwater basket weaving")
      assert_nil result[:suggestions]
      assert_match(/couldn't tell which career/, result[:reply])
      assert result[:quick_replies].any?
    end

    test "compare names a winner per dimension for both careers" do
      result = respond_to("registered nurses vs dentists")
      reply = result[:reply]
      assert_match(/Registered Nurses vs Dentists/, reply)
      assert_match(/Salary:/, reply)
      assert_match(/Education cost:/, reply)
      assert_match(/Breakeven:/, reply)
      assert_match(/ROI:/, reply)
      assert_match(/comes out slightly ahead/, reply)
      assert_equal 2, result[:suggestions].size
    end

    test "compare handles unknown side gracefully" do
      result = respond_to("registered nurses vs wizardry")
      assert_nil result[:suggestions]
      assert_match(/wizardry/, result[:reply])
    end

    test "compare with identical sides is a tie" do
      result = respond_to("registered nurses vs nurses")
      assert_match(/tie/, result[:reply])
    end

    test "next_steps references liked career skills and onet link" do
      Swipe.create!(career_id: @nurses.id, user_id: @user, direction: "right", feedback: "somewhat_interested")
      result = respond_to("What are my next steps?")
      assert_match(/onetonline\.org/, result[:reply])
      assert_match(/Registered Nurses/, result[:reply])
      assert_match(/patient care/i, result[:reply])
    end

    test "next_steps without history gives generic checklist" do
      result = respond_to("how do I get started?")
      assert_match(/Discover/, result[:reply])
      assert result[:quick_replies].any?
    end

    # --- edge cases ---------------------------------------------------------

    test "nil message does not raise" do
      result = Engine.new(user_id: @user, message: nil).respond
      assert result[:reply].present?
    end

    test "unknown user gets generic recommendations not an error" do
      result = Engine.new(user_id: "no-such-user", message: "Recommend careers for me").respond
      assert_equal 3, result[:suggestions].size
    end

    private

    def respond_to(message)
      Engine.new(user_id: @user, message: message).respond
    end
  end
end
