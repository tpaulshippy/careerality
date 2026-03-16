class Api::CareersController < ApplicationController
  def index
    careers = Career.where(selectable: 'T').order(sort_sequence: :asc)
    pagy, records = pagy(careers, items: 10)
    render json: { careers: records.as_json, pagy: { page: pagy.page, items: pagy.items, count: pagy.count, pages: pagy.pages } }
  end

  def show
    career = Career.find_by(occupation_code: params[:id])
    if career
      render json: career.as_json
    else
      render json: { error: 'Career not found' }, status: :not_found
    end
  end
end