require "test_helper"
require "minitest/mock"

class JevFilterRouterServiceTest < ActiveSupport::TestCase
  VALID_EDUCATION = %w[no_degree associate bachelor graduate bootcamp apprenticeship no_match].freeze
  VALID_ENV = %w[office hybrid field remote shift no_match].freeze

  test "routes school-averse high-pay remote request in fallback" do
    old = ENV.delete("TYPESAFE_API_KEY")
    result = JevFilterRouterService.route("I hate school but want $80k+ remote")
    assert_equal :fallback, result.provider
    assert_includes %w[no_degree bootcamp apprenticeship], result.education_pathway
    assert_equal "remote", result.work_env
    assert result.min_salary >= 80_000
    refute result.requires_clarification
  ensure
    ENV["TYPESAFE_API_KEY"] = old if old
  end

  test "gibberish requires clarification" do
    old = ENV.delete("TYPESAFE_API_KEY")
    result = JevFilterRouterService.route("asdf qwerty blorple")
    assert result.requires_clarification
    assert_includes VALID_EDUCATION, result.education_pathway
    assert_includes VALID_ENV, result.work_env
  ensure
    ENV["TYPESAFE_API_KEY"] = old if old
  end

  test "never emits an invalid enum" do
    old = ENV.delete("TYPESAFE_API_KEY")
    [ "remote jobs", "I want a PhD path", "", "$$$", "nights and weekends" ].each do |text|
      result = JevFilterRouterService.route(text)
      assert_includes VALID_EDUCATION, result.education_pathway, text
      assert_includes VALID_ENV, result.work_env, text
    end
  ensure
    ENV["TYPESAFE_API_KEY"] = old if old
  end

  test "maps Jev parsed response" do
    fake_parsed = {
      "education_pathway" => { "type" => "choice", "choice" => "no_degree", "confidence" => 0.82 },
      "work_env" => { "type" => "choice", "choice" => "remote", "confidence" => 0.9 },
      "high_earner" => { "type" => "noul", "noul" => 0.93 },
      "requires_clarification" => { "type" => "noul", "noul" => 0.05 }
    }
    fake_response = Struct.new(:parsed).new(fake_parsed)
    fake_chat = Object.new
    fake_chat.define_singleton_method(:with_schema) { |*_args| self }
    fake_chat.define_singleton_method(:ask) { |*_args| fake_response }
    RubyLLM.stub(:chat, fake_chat) do
      ENV["TYPESAFE_API_KEY"] = "test-key"
      result = JevFilterRouterService.route("I hate school but want $80k+ remote")
      assert_equal :jev, result.provider
      assert_equal "no_degree", result.education_pathway
      assert_equal "remote", result.work_env
      assert_equal 80_000, result.min_salary
      refute result.requires_clarification
    end
  ensure
    ENV.delete("TYPESAFE_API_KEY")
  end
end
