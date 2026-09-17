class Api::JevController < ApplicationController
  # POST /api/jev/triage — counselor intent triage + next-task recommendation.
  # Falls back gracefully when TYPESAFE_API_KEY is missing (see service).
  def triage
    result = JevTriageService.triage(message: params[:message].to_s,
                                     context: params[:context]&.to_unsafe_h || {})
    render json: { triage: result.to_h }
  end
end
