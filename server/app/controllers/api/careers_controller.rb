class Api::CareersController < ApplicationController
  def index
    careers = Career.where(selectable: 'T').order(sort_sequence: :asc)
    render json: careers.as_json
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