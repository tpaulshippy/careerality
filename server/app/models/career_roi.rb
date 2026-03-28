class CareerRoi < ApplicationRecord
  self.table_name = "career_roi"
  self.primary_key = "id"

  has_one :career_content, foreign_key: :occupation_code, primary_key: :occupation_code

  def as_json(options = {})
    content = career_content
    base = {
      id: id,
      occupation_code: occupation_code,
      occupation_name: occupation_name,
      area_code: area_code,
      area_name: area_name,
      annual_median_salary: annual_median_salary,
      education_cost: education_cost,
      years_to_breakeven: years_to_breakeven,
      roi_percentage: roi_percentage,
      job_zone: job_zone,
      education_level: education_level,
      skills: skills,
      cost_of_living_index: cost_of_living_index,
      adjusted_salary: adjusted_salary,
      industry_code: industry_code,
      industry_name: industry_name,
      demand_rank: demand_rank,
      avg_annual_openings: avg_annual_openings,
      projected_growth_percent: projected_growth_percent,
      demand_score: demand_score
    }

    if content
      base[:day_in_life_summary] = content.day_in_life_summary
      base[:day_in_life_full] = content.day_in_life_full
      base[:video_url] = content.video_url
    end

    base
  end
end
