class AddIndustryColumnsToCareerRoi < ActiveRecord::Migration[8.0]
  def change
    add_column :career_roi, :industry_code, :string, limit: 50, if_not_exists: true
    add_column :career_roi, :industry_name, :string, limit: 255, if_not_exists: true

    remove_index :career_roi, name: 'index_career_roi_on_occupation_code', if_exists: true
    add_index :career_roi, [:occupation_code, :area_code, :industry_code], unique: true, name: 'index_career_roi_on_unique_key', if_not_exists: true
  end
end
