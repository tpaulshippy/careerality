class AddDemandFieldsToCareerRoi < ActiveRecord::Migration[7.2]
  def change
    add_column :career_roi, :demand_rank, :integer
    add_column :career_roi, :avg_annual_openings, :integer
    add_column :career_roi, :projected_growth_percent, :numeric
  end
end
