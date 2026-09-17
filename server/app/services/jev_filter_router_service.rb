require "ruby_llm"
require "ruby_llm-typesafe"

# System One NL-to-filters router via TypeSafe Jev.
# https://github.com/kieranklaassen/ruby_llm-typesafe
#
# Maps free text ("I hate school but want $80k+ remote") onto the app's
# rigid Smart Filters. Jev can only pick options we list, so it can never
# emit an invalid enum — the shape guarantee System One is built for.
# Falls back to a keyword heuristic when TYPESAFE_API_KEY is blank or
# Jev raises.
class JevFilterRouterService
  MODEL = "jev-latest".freeze
  EDUCATION_OPTIONS = {
    no_degree: "No degree required",
    associate: "Associate's degree",
    bachelor: "Bachelor's degree",
    graduate: "Graduate degree",
    bootcamp: "Bootcamp or certificate",
    apprenticeship: "Apprenticeship",
    no_match: "No education preference expressed"
  }.freeze
  WORK_ENV_OPTIONS = {
    office: "Office",
    hybrid: "Hybrid",
    field: "Field / on-site",
    remote: "Remote",
    shift: "Shift work",
    no_match: "No work environment preference expressed"
  }.freeze

  Result = Struct.new(:education_pathway, :work_env, :min_salary,
                      :requires_clarification, :confidence, :provider, keyword_init: true)

  def self.route(text)
    return fallback(text) if ENV["TYPESAFE_API_KEY"].to_s.empty?

    schema = RubyLLM::Providers::TypeSafe::Schema.new do |s|
      s.choice :education_pathway, instructions: "Which education pathway does the user want?", criteria: EDUCATION_OPTIONS
      s.choice :work_env, instructions: "Which work environment does the user want?", criteria: WORK_ENV_OPTIONS
      s.noul :high_earner, instructions: "Does the user want high pay ($80k or more)?"
      s.noul :requires_clarification, instructions: "Is this message too vague or off-topic to map to filters?"
    end

    response = RubyLLM.chat(model: MODEL, provider: :typesafe).with_schema(schema).ask(text)
    parsed = response.parsed
    Result.new(
      education_pathway: parsed.dig("education_pathway", "choice"),
      work_env: parsed.dig("work_env", "choice"),
      min_salary: parsed.dig("high_earner", "noul").to_f > 0.5 ? 80_000 : nil,
      requires_clarification: parsed.dig("requires_clarification", "noul").to_f > 0.5,
      confidence: parsed.dig("education_pathway", "confidence").to_f,
      provider: :jev
    )
  rescue RubyLLM::Error, StandardError
    fallback(text)
  end

  def self.fallback(text)
    t = text.to_s.downcase
    education =
      if t.match?(/no degree|hate school|without school|no school|dropout/)
        "no_degree"
      elsif t.match?(/bootcamp|certificate/)
        "bootcamp"
      elsif t.match?(/apprentice/)
        "apprenticeship"
      elsif t.match?(/associate/)
        "associate"
      elsif t.match?(/bachelor|college|degree/)
        "bachelor"
      elsif t.match?(/master|phd|graduate/)
        "graduate"
      else
        "no_match"
      end
    work_env =
      if t.match?(/remote|work from home|wfh/)
        "remote"
      elsif t.match?(/hybrid/)
        "hybrid"
      elsif t.match?(/field|outdoors|on-site|onsite/)
        "field"
      elsif t.match?(/shift|nights|weekend/)
        "shift"
      elsif t.match?(/office/)
        "office"
      else
        "no_match"
      end
    salary = t.match(/\$?\s?(\d+)\s?k/) ? Regexp.last_match(1).to_i * 1000 : nil
    salary = 80_000 if salary.nil? && t.match?(/80k|80,?000|high pay|high salary|good pay/)
    Result.new(
      education_pathway: education,
      work_env: work_env,
      min_salary: salary,
      requires_clarification: education == "no_match" && work_env == "no_match" && salary.nil?,
      confidence: 0.5,
      provider: :fallback
    )
  end
  private_class_method :fallback
end
