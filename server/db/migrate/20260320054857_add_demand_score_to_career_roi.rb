class AddDemandScoreToCareerRoi < ActiveRecord::Migration[8.0]
  def change
    add_column :career_roi, :demand_score, :decimal, precision: 10, scale: 4
  end
end
