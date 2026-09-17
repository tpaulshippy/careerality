class Api::JevController < ApplicationController
  # POST /api/jev/route_filters — natural language to Smart Filters.
  # Falls back gracefully when TYPESAFE_API_KEY is missing (see service).
  def route_filters
    result = JevFilterRouterService.route(params[:text].to_s)
    render json: { filters: result.to_h }
  end
end
