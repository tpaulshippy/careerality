class Api::JevController < ApplicationController
  # POST /api/jev/qa_score — score one generated narrative (demo/test surface
  # for the JevQaJudgeService batch gate in populate_career_contents.rb).
  # Falls back gracefully when TYPESAFE_API_KEY is missing (see service).
  def qa_score
    score = JevQaJudgeService.score(
      narrative: params[:narrative].to_s,
      onet_tasks: Array(params[:onet_tasks]),
      occupation_code: params[:occupation_code].to_s
    )
    render json: { score: score.to_h }
  end

  # POST /api/jev/rank — ranks candidate careers for the Discover feed.
  # Falls back gracefully when TYPESAFE_API_KEY is missing (see service).
  #
  # Bounded: each candidate costs one TypeSafe call, so oversized requests
  # are rejected instead of fanning out.
  MAX_CANDIDATES = 50

  def rank
    swipes = Array(params[:swipes]).map { |s| s.respond_to?(:to_unsafe_h) ? s.to_unsafe_h : s.to_h }
    candidates = Array(params[:candidates]).map { |c| c.respond_to?(:to_unsafe_h) ? c.to_unsafe_h : c.to_h }
    if candidates.length > MAX_CANDIDATES
      return render json: { error: "too many candidates (max #{MAX_CANDIDATES})" },
                    status: :unprocessable_entity
    end
    results = JevRankingService.rank(swipes: swipes, candidates: candidates)
    render json: { results: results.map(&:to_h) }
  end
end
