class Api::RoiController < ApplicationController
  def index
    roi_records = CareerRoi.where(area_code: area_code).order(roi_percentage: :desc)
    render json: roi_records.as_json
  end

  def show
    roi = CareerRoi.find_by(occupation_code: params[:id], area_code: area_code)
    if roi
      render json: roi.as_json
    else
      render json: { error: 'Career ROI not found' }, status: :not_found
    end
  end

  def by_salary
    roi_records = CareerRoi.where(area_code: area_code).order(annual_median_salary: :desc).limit(50)
    render json: roi_records.as_json
  end

  def by_roi
    roi_records = CareerRoi.where(area_code: area_code).order(roi_percentage: :desc).limit(50)
    render json: roi_records.as_json
  end

  def by_breakeven
    roi_records = CareerRoi.where(area_code: area_code).order(years_to_breakeven: :asc).limit(50)
    render json: roi_records.as_json
  end

  def search
    query = params[:q]
    if query.present?
      roi_records = CareerRoi.where(area_code: area_code).where("occupation_name ILIKE ?", "%#{query}%").order(roi_percentage: :desc)
      render json: roi_records.as_json
    else
      render json: { error: 'Query parameter q is required' }, status: :bad_request
    end
  end

  private

  def area_code
    params[:area] || '99'
  end
end
