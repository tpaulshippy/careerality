class Api::RoiController < ApplicationController
  include OccupationCodeNormalizer

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
          demand_query.order(Arel.sql(
            "demand_score DESC NULLS LAST, " \
            "demand_rank ASC NULLS LAST, " \
            "projected_growth_percent DESC NULLS LAST, " \
            "occupation_code ASC"
          ))
        else
          base_query.order(roi_percentage: :desc)
        end
    else base_query.order(roi_percentage: :desc)
    end

    if params[:user_id].present?
      swiped_ids = Swipe.where(user_id: params[:user_id]).select(:career_id)
      roi_records = roi_records.where.not(id: swiped_ids)
    end

    pagy, records = pagy(roi_records.includes(:career_content), items: 20)

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
     normalized_code = normalize_occupation_code(params[:id])
     if normalized_code.nil?
       render json: { error: "Invalid occupation code; expected format XX-XXXX.00" }, status: :bad_request
       return
     end
     roi = CareerRoi.includes(:career_content).find_by(occupation_code: normalized_code, area_code: area)
     if roi
       render json: roi.as_json
     else
       render json: { error: "Career ROI not found" }, status: :not_found
     end
   end

  def by_salary
    area = params[:area] || "99"
    roi_records = CareerRoi.where(area_code: area).order(annual_median_salary: :desc)
    pagy, records = pagy(roi_records.includes(:career_content), items: 50)
    render json: { records: records.as_json, pagy: { page: pagy.page, items: pagy.items, count: pagy.count, pages: pagy.pages } }
  end

  def by_roi
    area = params[:area] || "99"
    roi_records = CareerRoi.where(area_code: area).order(roi_percentage: :desc)
    pagy, records = pagy(roi_records.includes(:career_content), items: 50)
    render json: { records: records.as_json, pagy: { page: pagy.page, items: pagy.items, count: pagy.count, pages: pagy.pages } }
  end

  def by_breakeven
    area = params[:area] || "99"
    roi_records = CareerRoi.where(area_code: area).order(years_to_breakeven: :asc)
    pagy, records = pagy(roi_records.includes(:career_content), items: 50)
    render json: { records: records.as_json, pagy: { page: pagy.page, items: pagy.items, count: pagy.count, pages: pagy.pages } }
  end

  def search
    query = params[:q]
    area = params[:area] || "99"
    if query.present?
      roi_records = CareerRoi.where(area_code: area).where("occupation_name ILIKE ?", "%#{query}%").order(roi_percentage: :desc)
pagy, records = pagy(roi_records.includes(:career_content), items: 50)
      render json: { records: records.as_json, pagy: { page: pagy.page, items: pagy.items, count: pagy.count, pages: pagy.pages } }
    else
      render json: { error: "Query parameter q is required" }, status: :bad_request
    end
  end

  def map_summary
    rows = CareerRoi
      .where("area_code ~ ? AND area_code <> ?", "^[0-9]{1,2}$", "99")
      .group(:area_code)
      .pluck(
        :area_code,
        Arel.sql("COUNT(*)"),
        Arel.sql("AVG(annual_median_salary)"),
        Arel.sql("AVG(adjusted_salary)"),
        Arel.sql("PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY roi_percentage)"),
        Arel.sql("COUNT(*) FILTER (WHERE roi_percentage >= #{HIGH_ROI_THRESHOLD})"),
        Arel.sql("COUNT(*) FILTER (WHERE demand_score IS NOT NULL OR demand_rank IS NOT NULL)"),
        Arel.sql("AVG(demand_rank) FILTER (WHERE demand_rank IS NOT NULL)")
      )

    render json: {
      states: rows.to_h do |area_code, count, avg_salary, adjusted_salary, median_roi, high_roi_count, demand_count, demand_avg_rank|
        [area_code, {
          hasRecords: count.positive?,
          avgSalary: avg_salary&.to_f,
          adjustedSalary: adjusted_salary&.to_f,
          medianRoi: median_roi&.to_f,
          highRoiCount: high_roi_count,
          demandCount: demand_count,
          demandAvgRank: demand_avg_rank&.to_f
        }]
      end
    }
  end

  private

  def area_name
    area_code = params[:area_code] || params[:area] || params[:location]
    return nil unless area_code.present?
    area_name = CareerRoi.where(area_code: area_code).pick(:area_name)
    area_name || "State #{area_code}"
  end

  HIGH_ROI_THRESHOLD = 15
end
