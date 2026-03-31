class Api::CareersController < ApplicationController
  include OccupationCodeNormalizer

  def index
    careers = Career.where(selectable: "T").order(sort_sequence: :asc)
    pagy, records = pagy(careers, items: 10)
    render json: { careers: records.as_json, pagy: { page: pagy.page, items: pagy.items, count: pagy.count, pages: pagy.pages } }
  end

  def show
     normalized_code = normalize_occupation_code(params[:id])
     if normalized_code.nil?
       render json: { error: "Invalid occupation code" }, status: :bad_request and return
     end
     career = Career.find_by(occupation_code: normalized_code)
     if career
       render json: career.as_json
     else
       render json: { error: "Career not found" }, status: :not_found
     end
   end
end
