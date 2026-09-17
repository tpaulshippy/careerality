require "test_helper"
require "minitest/mock"

class JevQaJudgeServiceTest < ActiveSupport::TestCase
  TASKS = [ "Debug production issues", "Pair-program with junior engineers" ].freeze

  test "flags salary guarantee in fallback" do
    old = ENV.delete("TYPESAFE_API_KEY")
    score = JevQaJudgeService.score(narrative: "You will earn $200k guaranteed in year one.",
                                    onet_tasks: TASKS, occupation_code: "15-1252.00")
    assert_equal :fallback, score.provider
    assert score.salary_hallucinated > 0.5
    assert score.regenerate
  ensure
    ENV["TYPESAFE_API_KEY"] = old if old
  end

  test "grounded narrative passes fallback" do
    old = ENV.delete("TYPESAFE_API_KEY")
    score = JevQaJudgeService.score(narrative: "Debugged a production issue for three hours, then pair-programmed.",
                                    onet_tasks: TASKS, occupation_code: "15-1252.00")
    assert_equal :fallback, score.provider
    assert score.salary_hallucinated < 0.5
    refute score.regenerate
  ensure
    ENV["TYPESAFE_API_KEY"] = old if old
  end

  test "empty narrative handled without raising" do
    old = ENV.delete("TYPESAFE_API_KEY")
    score = JevQaJudgeService.score(narrative: "", onet_tasks: [], occupation_code: "15-1252.00")
    assert_equal :fallback, score.provider
  ensure
    ENV["TYPESAFE_API_KEY"] = old if old
  end

  test "maps Jev parsed response" do
    fake_parsed = {
      "salary_hallucinated" => { "type" => "noul", "noul" => 0.92 },
      "contradicts_onet" => { "type" => "noul", "noul" => 0.1 },
      "authenticity" => { "type" => "score", "score" => 0.4, "confidence" => 0.7 }
    }
    fake_response = Struct.new(:parsed).new(fake_parsed)
    fake_chat = Object.new
    fake_chat.define_singleton_method(:with_schema) { |*_args| self }
    fake_chat.define_singleton_method(:ask) { |*_args| fake_response }
    RubyLLM.stub(:chat, fake_chat) do
      ENV["TYPESAFE_API_KEY"] = "test-key"
      score = JevQaJudgeService.score(narrative: "x", onet_tasks: TASKS, occupation_code: "15-1252.00")
      assert_equal :jev, score.provider
      assert_in_delta 0.92, score.salary_hallucinated, 0.001
      assert score.regenerate
    end
  ensure
    ENV.delete("TYPESAFE_API_KEY")
  end
end
