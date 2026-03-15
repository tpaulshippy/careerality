class CareerRoi < ApplicationRecord
  self.table_name = 'career_roi'
  self.primary_key = 'id'

  def as_json(options = {})
    {
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
      industry_name: industry_name
    }
  end
end
