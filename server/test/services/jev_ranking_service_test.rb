require "test_helper"
require "minitest/mock"

class JevRankingServiceTest < ActiveSupport::TestCase
  CANDIDATES = [
    { occupation_code: "15-1252.00", occupation_name: "Software Developer", annual_median_salary: 130_000 },
    { occupation_code: "29-1141.00", occupation_name: "Registered Nurse", annual_median_salary: 86_000 }
  ].freeze

  SWIPES = [
    { occupation_code: "15-1252.00", direction: "right", reason: "salary" }
  ].freeze

  test "fallback ranks without API key" do
    old = ENV.delete("TYPESAFE_API_KEY")
    results = JevRankingService.rank(swipes: SWIPES, candidates: CANDIDATES)
    assert_equal 2, results.length
    assert results.all? { |r| r.provider == :fallback }
    assert results.first.p_like >= results.last.p_like
  ensure
    ENV["TYPESAFE_API_KEY"] = old if old
  end

  test "score_candidate maps Jev parsed response" do
    fake_parsed = {
      "will_like" => { "type" => "noul", "noul" => 0.87 },
      "fit_level" => { "type" => "score", "score" => 1.8 },
      "primary_driver" => { "type" => "choice", "choice" => "salary", "confidence" => 0.8 }
    }
    fake_response = Struct.new(:parsed).new(fake_parsed)
    fake_chat = Object.new
    fake_chat.define_singleton_method(:with_schema) { |*_args| self }
    fake_chat.define_singleton_method(:ask) { |*_args| fake_response }
    RubyLLM.stub(:chat, fake_chat) do
      ENV["TYPESAFE_API_KEY"] = "test-key"
      result = JevRankingService.score_candidate(swipes: SWIPES, candidate: CANDIDATES.first)
      assert_equal :jev, result.provider
      assert_in_delta 0.87, result.p_like, 0.001
      assert_equal "salary", result.driver
    end
  ensure
    ENV.delete("TYPESAFE_API_KEY")
  end

  test "novelty boost lifts unseen careers on low confidence" do
    old = ENV.delete("TYPESAFE_API_KEY")
    results = JevRankingService.rank(swipes: SWIPES, candidates: CANDIDATES)
    unseen = results.find { |r| r.occupation_code == "29-1141.00" }
    assert unseen.p_like > 0.5, "expected novelty boost above neutral"
  ensure
    ENV["TYPESAFE_API_KEY"] = old if old
  end

  test "raw app swipe records resolve career_id to occupation codes" do
    old = ENV.delete("TYPESAFE_API_KEY")
    fake_scope = Object.new
    fake_scope.define_singleton_method(:pluck) { |*_args| [ [ 7, "15-1252.00" ] ] }
    CareerRoi.stub(:where, fake_scope) do
      swipes = [ { "career_id" => 7, "direction" => "right", "feedback" => "salary" } ]
      results = JevRankingService.rank(swipes: swipes, candidates: CANDIDATES)
      seen = results.find { |r| r.occupation_code == "15-1252.00" }
      unseen = results.find { |r| r.occupation_code == "29-1141.00" }
      assert_equal 0.5, seen.p_like, "seen career gets no novelty boost"
      assert unseen.p_like > seen.p_like
    end
  ensure
    ENV["TYPESAFE_API_KEY"] = old if old
  end
end
