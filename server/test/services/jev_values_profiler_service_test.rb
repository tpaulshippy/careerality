require "test_helper"
require "minitest/mock"

class JevValuesProfilerServiceTest < ActiveSupport::TestCase
  test "empty history returns neutral fallback profile" do
    old = ENV.delete("TYPESAFE_API_KEY")
    profile = JevValuesProfilerService.profile(swipes: [])
    assert_equal :fallback, profile.provider
    assert_equal 0.0, profile.salary_driven
    assert_equal 0.5, profile.confidence
  ensure
    ENV["TYPESAFE_API_KEY"] = old if old
  end

  test "salary taps drive salary_driven up in fallback" do
    old = ENV.delete("TYPESAFE_API_KEY")
    swipes = [ { reason: "salary" }, { reason: "salary" }, { reason: "culture" } ]
    profile = JevValuesProfilerService.profile(swipes: swipes)
    assert_in_delta 0.667, profile.salary_driven, 0.01
    assert_equal 0.0, profile.credential_averse
  ensure
    ENV["TYPESAFE_API_KEY"] = old if old
  end

  test "education rejections drive credential_averse up in fallback" do
    old = ENV.delete("TYPESAFE_API_KEY")
    swipes = [ { reason: "education" }, { reason: "education" } ]
    profile = JevValuesProfilerService.profile(swipes: swipes)
    assert_in_delta 1.0, profile.credential_averse, 0.001
  ensure
    ENV["TYPESAFE_API_KEY"] = old if old
  end

  test "app swipe records count feedback as reasons in fallback" do
    old = ENV.delete("TYPESAFE_API_KEY")
    swipes = [ { "feedback" => "salary" }, { "feedback" => "security" } ]
    profile = JevValuesProfilerService.profile(swipes: swipes)
    assert_in_delta 0.5, profile.salary_driven, 0.01
    assert_in_delta 0.5, profile.stability_need, 0.01
  ensure
    ENV["TYPESAFE_API_KEY"] = old if old
  end

  test "maps Jev parsed response" do
    fake_parsed = {
      "salary_driven" => { "type" => "noul", "noul" => 0.91 },
      "credential_averse" => { "type" => "noul", "noul" => 0.2 },
      "stability_need" => { "type" => "noul", "noul" => 0.4 },
      "hands_on" => { "type" => "score", "score" => 1.7, "confidence" => 0.75 }
    }
    fake_response = Struct.new(:parsed).new(fake_parsed)
    fake_chat = Object.new
    fake_chat.define_singleton_method(:with_schema) { |*_args| self }
    fake_chat.define_singleton_method(:ask) { |*_args| fake_response }
    RubyLLM.stub(:chat, fake_chat) do
      ENV["TYPESAFE_API_KEY"] = "test-key"
      profile = JevValuesProfilerService.profile(swipes: [ { reason: "salary" } ])
      assert_equal :jev, profile.provider
      assert_in_delta 0.91, profile.salary_driven, 0.001
      assert_in_delta 1.7, profile.hands_on, 0.001
    end
  ensure
    ENV.delete("TYPESAFE_API_KEY")
  end
end
