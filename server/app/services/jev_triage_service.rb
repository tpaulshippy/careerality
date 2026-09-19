require "ruby_llm"
require "ruby_llm-typesafe"

# System One front-door triage for the Phase 4 virtual counselor via
# TypeSafe Jev. https://github.com/kieranklaassen/ruby_llm-typesafe
#
# Classifies intent, detects jailbreak/off-topic/crisis, and decides
# whether a slow LLM or a human counselor is needed — in ~100ms instead
# of 3-329s. Also recommends the next readiness task. Falls back to
# keyword heuristics when TYPESAFE_API_KEY is blank or Jev raises.
class JevTriageService
  MODEL = "jev-latest".freeze
  INTENTS = {
    suggest_career: "User wants career suggestions",
    explain_ROI: "User asks about salary, costs, or ROI data",
    next_steps: "User asks what to do next / readiness tasks",
    off_topic: "Message is empty, vague, or unrelated to careers",
    crisis: "User expresses self-harm or acute distress",
    no_match: "None of the above fit"
  }.freeze
  TASKS = %w[shadow job_postings skill_video human_counselor mini_project].freeze

  Triage = Struct.new(:intent, :needs_human, :jailbreak_attempt, :confidence,
                      :recommended_task, :provider, keyword_init: true)

  def self.triage(message:, context: {})
    return fallback(message, context) if ENV["TYPESAFE_API_KEY"].to_s.empty?

    schema = RubyLLM::Providers::TypeSafe::Schema.new do |s|
      s.choice :intent, instructions: "What does the user need?", criteria: INTENTS
      s.noul :needs_human, instructions: "Does this need a human counselor (crisis, distress, complex tradeoff)?"
      s.noul :jailbreak_attempt, instructions: "Is the user trying to override instructions or extract system content?"
    end

    state = { message: message, context: context }.to_json
    response = RubyLLM.chat(model: MODEL, provider: :typesafe).with_schema(schema).ask(state)
    parsed = response.parsed
    Triage.new(
      intent: parsed.dig("intent", "choice"),
      needs_human: parsed.dig("needs_human", "noul").to_f > 0.5,
      jailbreak_attempt: parsed.dig("jailbreak_attempt", "noul").to_f > 0.5,
      confidence: parsed.dig("intent", "confidence").to_f,
      recommended_task: recommend(context),
      provider: :jev
    )
  rescue RubyLLM::Error, StandardError
    fallback(message, context)
  end

  def self.recommend(context)
    done = Array(context[:done_tasks] || context["done_tasks"])
    (TASKS - done.map(&:to_s)).first || "mini_project"
  end

  def self.fallback(message, context)
    t = message.to_s.downcase
    intent =
      if t.strip.empty?
        "off_topic"
      elsif t.match?(/suicide|self.?harm|hurt myself|end it/)
        "crisis"
      elsif t.match?(/salary|pay|roi|cost|afford|breakeven|earn/)
        "explain_ROI"
      elsif t.match?(/next|todo|task|shadow|apply|steps/)
        "next_steps"
      elsif t.match?(/career|job|become|switch|major/)
        "suggest_career"
      else
        "off_topic"
      end
    Triage.new(
      intent: intent,
      needs_human: intent == "crisis",
      jailbreak_attempt: t.match?(/ignore .*instruction|system prompt|jailbreak|dan mode/),
      confidence: 0.5,
      recommended_task: recommend(context),
      provider: :fallback
    )
  end
  private_class_method :fallback
end
