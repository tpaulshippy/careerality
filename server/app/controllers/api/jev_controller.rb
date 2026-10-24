class Api::JevController < ApplicationController
  # POST /api/jev/triage — counselor intent triage + next-task recommendation.
  # Falls back gracefully when TYPESAFE_API_KEY is missing (see service).
  def triage
    result = JevTriageService.triage(message: params[:message].to_s,
                                     context: params[:context]&.to_unsafe_h || {})
    render json: { triage: result.to_h }
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
