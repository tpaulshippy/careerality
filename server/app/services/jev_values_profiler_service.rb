require "ruby_llm"
require "ruby_llm-typesafe"

# System One latent values profiler via TypeSafe Jev.
# https://github.com/kieranklaassen/ruby_llm-typesafe
#
# Turns swipe + reason-tap history into a calibrated values vector the
# app can branch on (e.g. salary_driven > 0.8 → boost ROI sort).
# Falls back to a deterministic tap-count heuristic when
# TYPESAFE_API_KEY is blank or Jev raises.
class JevValuesProfilerService
  MODEL = "jev-latest".freeze
  HANDS_ON_LEVELS = [ "Desk work", "Mixed", "Hands-on" ].freeze

  Profile = Struct.new(:salary_driven, :credential_averse, :stability_need,
                       :hands_on, :confidence, :provider, keyword_init: true)

  def self.profile(swipes:)
    return fallback(swipes) if ENV["TYPESAFE_API_KEY"].to_s.empty?

    schema = RubyLLM::Providers::TypeSafe::Schema.new do |s|
      s.noul :salary_driven, instructions: "Is this user primarily motivated by salary and earning potential?"
      s.noul :credential_averse, instructions: "Does this user avoid careers with heavy education or training requirements?"
      s.noul :stability_need, instructions: "Does this user prioritize job security and stability?"
      s.score :hands_on, instructions: "Does this user prefer hands-on work over desk work?", criteria: HANDS_ON_LEVELS
    end

    response = RubyLLM.chat(model: MODEL, provider: :typesafe).with_schema(schema).ask(swipes.to_json)
    parsed = response.parsed
    Profile.new(
      salary_driven: parsed.dig("salary_driven", "noul").to_f,
      credential_averse: parsed.dig("credential_averse", "noul").to_f,
      stability_need: parsed.dig("stability_need", "noul").to_f,
      hands_on: parsed.dig("hands_on", "score").to_f,
      confidence: parsed.dig("hands_on", "confidence").to_f,
      provider: :jev
    )
  rescue RubyLLM::Error, StandardError
    fallback(swipes)
  end

  def self.fallback(swipes)
    reasons = swipes.map { |s| s[:reason] || s["reason"] }.compact
    total = [ reasons.length, 1 ].max.to_f
    Profile.new(
      salary_driven: reasons.count { |r| r == "salary" } / total,
      credential_averse: reasons.count { |r| r == "education" } / total,
      stability_need: reasons.count { |r| r == "security" } / total,
      hands_on: 1.0,
      confidence: 0.5,
      provider: :fallback
    )
  end
  private_class_method :fallback
end
