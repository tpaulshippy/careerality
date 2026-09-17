class Api::JevController < ApplicationController
  # POST /api/jev/values — latent values vector from swipe feedback.
  # Falls back gracefully when TYPESAFE_API_KEY is missing (see service).
  def values
    swipes = Array(params[:swipes]).map { |s| s.respond_to?(:to_unsafe_h) ? s.to_unsafe_h : s.to_h }
    profile = JevValuesProfilerService.profile(swipes: swipes)
    render json: { profile: profile.to_h }
  end
end
