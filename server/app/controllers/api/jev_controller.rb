class Api::JevController < ApplicationController
  # POST /api/jev/values — latent values vector from swipe feedback.
  # Falls back gracefully when TYPESAFE_API_KEY is missing (see service).
  def values
    profile = JevValuesProfilerService.profile(swipes: params[:swipes] || [])
    render json: { profile: profile.to_h }
  end
end
