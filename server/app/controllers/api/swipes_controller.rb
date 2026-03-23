class Api::SwipesController < ApplicationController
  def index
    swipes = Swipe.where(user_id: params[:user_id]).order(created_at: :desc)
    render json: { swipes: swipes.as_json }
  end

  def liked
    records = Swipe
      .where(user_id: params[:user_id], direction: 'right')
      .joins("INNER JOIN career_roi ON career_roi.id = swipes.career_id")
      .select("swipes.id AS swipe_id, swipes.created_at AS swiped_at, career_roi.id, career_roi.occupation_code, career_roi.occupation_name, career_roi.area_code, career_roi.area_name, career_roi.annual_median_salary, career_roi.education_cost, career_roi.years_to_breakeven, career_roi.roi_percentage, career_roi.job_zone, career_roi.education_level, career_roi.skills, career_roi.cost_of_living_index, career_roi.adjusted_salary, career_roi.industry_code, career_roi.industry_name, career_roi.demand_rank, career_roi.avg_annual_openings, career_roi.projected_growth_percent, career_roi.demand_score")
      .order("swipes.created_at DESC")

    render json: { records: records.map { |r| 
      {
        id: r.id,
        occupation_code: r.occupation_code,
        occupation_name: r.occupation_name,
        area_code: r.area_code,
        area_name: r.area_name,
        annual_median_salary: r.annual_median_salary,
        education_cost: r.education_cost,
        years_to_breakeven: r.years_to_breakeven,
        roi_percentage: r.roi_percentage,
        job_zone: r.job_zone,
        education_level: r.education_level,
        skills: r.skills,
        cost_of_living_index: r.cost_of_living_index,
        adjusted_salary: r.adjusted_salary,
        industry_code: r.industry_code,
        industry_name: r.industry_name,
        demand_rank: r.demand_rank,
        avg_annual_openings: r.avg_annual_openings,
        projected_growth_percent: r.projected_growth_percent,
        demand_score: r.demand_score,
        swipe_id: r.swipe_id,
        swiped_at: r.swiped_at
      }
    } }
  end

  def create
    swipe = Swipe.new(swipe_params)
    if swipe.save
      render json: swipe.as_json, status: :created
    else
      render json: { error: swipe.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def destroy
    swipe = Swipe.find_by(id: params[:id], user_id: params[:user_id])
    if swipe
      swipe.destroy
      render json: { success: true }
    else
      render json: { error: 'Swipe not found' }, status: :not_found
    end
  end

  private

  def swipe_params
    params.permit(:career_id, :user_id, :direction, :feedback)
  end
end
