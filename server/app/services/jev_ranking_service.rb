require "ruby_llm"
require "ruby_llm-typesafe"

# System One next-card ranking via TypeSafe Jev.
# https://github.com/kieranklaassen/ruby_llm-typesafe
#
# Unstructured state in (swipe history + candidate career), typed
# probabilistic decisions out. Falls back to a deterministic heuristic
# when TYPESAFE_API_KEY is blank or Jev raises, so tests and dev work
# without a key and the Discover feed never breaks.
class JevRankingService
  MODEL = "jev-latest".freeze
  FIT_LEVELS = [ "Poor fit", "Possible fit", "Strong fit" ].freeze
  DRIVERS = {
    salary: "Salary and earning potential",
    culture: "Work environment and culture",
    skills: "Skills involved",
    security: "Job security and stability",
    work_life: "Work-life balance"
  }.freeze

  Result = Struct.new(:occupation_code, :p_like, :fit_score, :driver, :confidence, :provider, keyword_init: true)

  def self.rank(swipes:, candidates:)
    swipes = with_codes(swipes)
    candidates = with_candidate_names(candidates)
    scored = candidates.map { |c| score_candidate(swipes: swipes, candidate: c) }
    # Explore/exploit: low confidence gets a novelty boost for unseen codes.
    seen = swipes.map { |s| s[:occupation_code] || s["occupation_code"] }.compact
    scored.each do |r|
      if r.confidence < 0.6 && !seen.include?(r.occupation_code)
        r.p_like = [ (r.p_like + 0.1), 1.0 ].min
      end
    end
    scored.sort_by { |r| -r.p_like }
  end

  def self.score_candidate(swipes:, candidate:)
    code = candidate[:occupation_code] || candidate["occupation_code"]
    return fallback_result(code) if ENV["TYPESAFE_API_KEY"].to_s.empty?

    schema = RubyLLM::Providers::TypeSafe::Schema.new do |s|
      s.noul :will_like, instructions: "Will this user swipe right on this career given their swipe history?"
      s.score :fit_level, instructions: "How strong is the long-term fit?", criteria: FIT_LEVELS
      s.choice :primary_driver, instructions: "What would drive the decision?", criteria: DRIVERS
    end

    state = { swipes: swipes.as_json, candidate: candidate.as_json }.to_json
    response = RubyLLM.chat(model: MODEL, provider: :typesafe).with_schema(schema).ask(state)
    parsed = response.parsed
    Result.new(
      occupation_code: code,
      p_like: parsed.dig("will_like", "noul").to_f,
      fit_score: parsed.dig("fit_level", "score").to_f,
      driver: parsed.dig("primary_driver", "choice"),
      confidence: parsed.dig("primary_driver", "confidence").to_f,
      provider: :jev
    )
  rescue RubyLLM::Error, StandardError
    fallback_result(code)
  end

  def self.fallback_result(code)
    Result.new(occupation_code: code, p_like: 0.5, fit_score: 1.0,
               driver: "security", confidence: 0.5, provider: :fallback)
  end
  private_class_method :fallback_result

  # The app posts raw swipe records (career_id, direction, feedback).
  # Resolve career_ids to occupation codes + names so history matches
  # candidates and Jev sees human-readable labels, not opaque SOC codes.
  def self.with_codes(swipes)
    swipes = Array(swipes).map(&:to_h)
    ids = swipes.map { |s| s[:career_id] || s["career_id"] }.compact.uniq
    rows = ids.empty? ? [] : CareerRoi.where(id: ids).pluck(:id, :occupation_code, :occupation_name)
    by_id = rows.to_h { |id, code, name| [ id, [ code, name ] ] }
    swipes.each do |s|
      cid = s[:career_id] || s["career_id"]
      if cid && by_id[cid]
        code, name = by_id[cid]
        s[:occupation_code] ||= s["occupation_code"] || code
        s[:occupation_name] ||= s["occupation_name"] || name
      end
      s[:reason] ||= s["reason"] || s[:feedback] || s["feedback"]
    end
  end
  private_class_method :with_codes

  # Candidates may arrive as code-only; fill missing names from the DB so
  # Jev always sees e.g. { occupation_code: "15-1252.00",
  # occupation_name: "Software Developers" }.
  def self.with_candidate_names(candidates)
    candidates = Array(candidates).map(&:to_h)
    missing = candidates.select { |c| (c[:occupation_name] || c["occupation_name"]).nil? }
                        .map { |c| c[:occupation_code] || c["occupation_code"] }.compact.uniq
    unless missing.empty?
      names = CareerRoi.where(occupation_code: missing).distinct.pluck(:occupation_code, :occupation_name).to_h
      candidates.each do |c|
        code = c[:occupation_code] || c["occupation_code"]
        if code && (c[:occupation_name] || c["occupation_name"]).nil? && names[code]
          c[:occupation_name] ||= names[code]
        end
      end
    end
    candidates
  end
  private_class_method :with_candidate_names
end
