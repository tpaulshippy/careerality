class Api::RoiController < ApplicationController
  def index
    sort_by = params[:sort] || "demand"

    # Determine area code from various parameter names
    area = params[:area_code] || params[:area] || params[:location]
    base_query = if area.present?
      CareerRoi.where(area_code: area)
    else
      CareerRoi.all
    end

    # Salary filters (support both new and old param names)
    if params[:min_salary].present?
      base_query = base_query.where("annual_median_salary >= ?", params[:min_salary].to_f)
    end
    if params[:salary_min].present?
      base_query = base_query.where("annual_median_salary >= ?", params[:salary_min].to_f)
    end
    if params[:max_salary].present?
      base_query = base_query.where("annual_median_salary <= ?", params[:max_salary].to_f)
    end
    if params[:salary_max].present?
      base_query = base_query.where("annual_median_salary <= ?", params[:salary_max].to_f)
    end

    roi_records = case sort_by
    when "roi" then base_query.order(roi_percentage: :desc)
    when "salary" then base_query.order(annual_median_salary: :desc)
    when "breakeven" then base_query.order(years_to_breakeven: :asc)
    when "demand"
        demand_query = base_query.where("demand_score IS NOT NULL")
        if demand_query.count > 0
          # Use pre-computed demand_score (weighted combination of demand_rank and growth)
          # plus small random component for variety
          demand_query.order(Arel.sql("
            demand_score + RANDOM() * 2.0 DESC,
            demand_rank ASC,
            projected_growth_percent DESC
          "))
        else
          demand_query.order(roi_percentage: :desc)
        end
    else base_query.order(roi_percentage: :desc)
    end

    if params[:user_id].present?
      swiped_ids = Swipe.where(user_id: params[:user_id]).select(:career_id)
      roi_records = roi_records.where.not(id: swiped_ids)
    end

    pagy, records = pagy(roi_records, items: 20)

    render_response = {
      records: records.as_json,
      pagy: { page: pagy.page, items: pagy.items, count: pagy.count, pages: pagy.pages }
    }

    if area.present?
      render_response[:area_code] = area
      render_response[:area_name] = area_name
    end

    render json: render_response
  end

  def show
    area = params[:area] || "99"
    roi = CareerRoi.find_by(occupation_code: params[:id], area_code: area)
    if roi
      render json: roi.as_json
    else
      render json: { error: "Career ROI not found" }, status: :not_found
    end
  end

  def by_salary
    area = params[:area] || "99"
    roi_records = CareerRoi.where(area_code: area).order(annual_median_salary: :desc)
    pagy, records = pagy(roi_records, items: 50)
    render json: { records: records.as_json, pagy: { page: pagy.page, items: pagy.items, count: pagy.count, pages: pagy.pages } }
  end

  def by_roi
    area = params[:area] || "99"
    roi_records = CareerRoi.where(area_code: area).order(roi_percentage: :desc)
    pagy, records = pagy(roi_records, items: 50)
    render json: { records: records.as_json, pagy: { page: pagy.page, items: pagy.items, count: pagy.count, pages: pagy.pages } }
  end

  def by_breakeven
    area = params[:area] || "99"
    roi_records = CareerRoi.where(area_code: area).order(years_to_breakeven: :asc)
    pagy, records = pagy(roi_records, items: 50)
    render json: { records: records.as_json, pagy: { page: pagy.page, items: pagy.items, count: pagy.count, pages: pagy.pages } }
  end

  def search
    query = params[:q]
    area = params[:area] || "99"
    if query.present?
      roi_records = CareerRoi.where(area_code: area).where("occupation_name ILIKE ?", "%#{query}%").order(roi_percentage: :desc)
pagy, records = pagy(roi_records, items: 50)
      render json: { records: records.as_json, pagy: { page: pagy.page, items: pagy.items, count: pagy.count, pages: pagy.pages } }
    else
      render json: { error: "Query parameter q is required" }, status: :bad_request
    end
  end

  private

  def area_name
    area_code = params[:area_code] || params[:area] || params[:location]
    return nil unless area_code.present?
    area_name = CareerRoi.where(area_code: area_code).pick(:area_name)
    area_name || "State #{area_code}"
  end
end
