class Api::JevController < ApplicationController
  # POST /api/jev/rank — ranks candidate careers for the Discover feed.
  # Falls back gracefully when TYPESAFE_API_KEY is missing (see service).
  def rank
    swipes = Array(params[:swipes]).map { |s| s.respond_to?(:to_unsafe_h) ? s.to_unsafe_h : s.to_h }
    candidates = Array(params[:candidates]).map { |c| c.respond_to?(:to_unsafe_h) ? c.to_unsafe_h : c.to_h }
    results = JevRankingService.rank(swipes: swipes, candidates: candidates)
    render json: { results: results.map(&:to_h) }
  end
end
