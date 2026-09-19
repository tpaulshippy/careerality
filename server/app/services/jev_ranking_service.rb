require "ruby_llm"
require "ruby_llm-typesafe"

# System One next-card ranking via TypeSafe Jev.
# https://github.com/kieranklaassen/ruby_llm-typesafe
#
# One listwise call per rank: state in (swipe history + full candidate
# set), typed choice out. Falls back to preserving input order when
# TYPESAFE_API_KEY is blank or Jev raises, so tests and dev work
# without a key and the Discover feed never breaks.
class JevRankingService
  MODEL = "jev-latest".freeze

  Result = Struct.new(:occupation_code, :p_like, :fit_score, :driver, :confidence, :provider, keyword_init: true)

  def self.rank(swipes:, candidates:)
    swipes = with_codes(swipes)
    candidates = with_candidate_names(candidates)
    codes = candidates.map { |c| c[:occupation_code] || c["occupation_code"] }.compact
    return codes.map { |code| fallback_result(code) } if ENV["TYPESAFE_API_KEY"].to_s.empty?
    return [] if codes.empty?

    criteria = candidates.to_h do |c|
      [ c[:occupation_code] || c["occupation_code"], c[:occupation_name] || c["occupation_name"] ]
    end
    schema = RubyLLM::Providers::TypeSafe::Schema.new do |s|
      s.choice :next_card, instructions: "Which career should be shown next given the user's swipe history?", criteria: criteria
    end

    state = { swipes: swipes.as_json, candidates: candidates.as_json }.to_json
    response = RubyLLM.chat(model: MODEL, provider: :typesafe).with_schema(schema).ask(state)
    answer = response.parsed["next_card"] || {}
    probs = answer["probabilities"] || {}
    confidence = answer["confidence"].to_f
    ordered = probs.sort_by { |_, p| -p.to_f }.map(&:first)
    ordered |= codes
    ordered.map do |code|
      p_like = probs[code].to_f
      Result.new(occupation_code: code, p_like: p_like, fit_score: p_like,
                 driver: nil, confidence: confidence, provider: :jev)
    end
  rescue RubyLLM::Error, StandardError
    (defined?(codes) && codes || []).map { |code| fallback_result(code) }
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
