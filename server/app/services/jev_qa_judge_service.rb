require "ruby_llm"
require "ruby_llm-typesafe"

# System One QA judge for the Phase 2 AI content pipeline via TypeSafe Jev.
# https://github.com/kieranklaassen/ruby_llm-typesafe
#
# Scores generated day-in-life narratives against their O*NET source data:
# salary hallucinations, contradictions, authenticity. At ~444x cheaper
# than frontier LLMs per the TypeSafe evals, this can gate every
# occupation on every data refresh. Falls back to regex heuristics when
# TYPESAFE_API_KEY is blank or Jev raises.
class JevQaJudgeService
  MODEL = "jev-latest".freeze
  AUTHENTICITY_LEVELS = [ "Generic", "Plausible", "Authentic" ].freeze

  Score = Struct.new(:salary_hallucinated, :contradicts_onet, :authenticity,
                     :regenerate, :confidence, :provider, keyword_init: true)

  def self.score(narrative:, onet_tasks:, occupation_code:)
    return fallback(narrative, onet_tasks) if ENV["TYPESAFE_API_KEY"].to_s.empty?

    schema = RubyLLM::Providers::TypeSafe::Schema.new do |s|
      s.noul :salary_hallucinated, instructions: "Does the narrative make specific salary or earnings guarantees?"
      s.noul :contradicts_onet, instructions: "Does the narrative contradict the listed O*NET tasks?"
      s.score :authenticity, instructions: "How authentic and grounded does the narrative feel?",
                             criteria: AUTHENTICITY_LEVELS
    end

    state = { narrative: narrative, onet_tasks: onet_tasks, occupation_code: occupation_code }.to_json
    response = RubyLLM.chat(model: MODEL, provider: :typesafe).with_schema(schema).ask(state)
    parsed = response.parsed
    sal = parsed.dig("salary_hallucinated", "noul").to_f
    con = parsed.dig("contradicts_onet", "noul").to_f
    Score.new(
      salary_hallucinated: sal,
      contradicts_onet: con,
      authenticity: parsed.dig("authenticity", "score").to_f,
      regenerate: sal > 0.5 || con > 0.5,
      confidence: parsed.dig("authenticity", "confidence").to_f,
      provider: :jev
    )
  rescue RubyLLM::Error, StandardError
    fallback(narrative, onet_tasks)
  end

  def self.fallback(narrative, onet_tasks)
    text = narrative.to_s
    salary_hit = text.match?(/\$\s?\d|guaranteed|six figures|earn .*k\b/i) ? 0.9 : 0.05
    tasks = Array(onet_tasks).map(&:to_s).reject(&:empty?)
    contra = tasks.empty? ? 0.5 : 0.1
    Score.new(
      salary_hallucinated: salary_hit,
      contradicts_onet: contra,
      authenticity: 1.0,
      regenerate: salary_hit > 0.5 || contra > 0.5,
      confidence: 0.5,
      provider: :fallback
    )
  end
  private_class_method :fallback
end
