class Api::JevController < ApplicationController
  # POST /api/jev/rank — ranks candidate careers for the Discover feed.
  # Falls back gracefully when TYPESAFE_API_KEY is missing (see service).
  def rank
    swipes = params[:swipes] || []
    candidates = params[:candidates] || []
    results = JevRankingService.rank(swipes: swipes, candidates: candidates)
    render json: { results: results.map(&:to_h) }
  end
end
