class CreateCareerRoi < ActiveRecord::Migration[8.0]
  def change
    create_table :career_roi do |t|
      t.string :occupation_code, limit: 20, null: false
      t.string :occupation_name, limit: 255
      t.string :area_code, limit: 10
      t.string :area_name, limit: 255
      t.decimal :annual_median_salary, precision: 12, scale: 2
      t.decimal :education_cost, precision: 12, scale: 2
      t.integer :years_to_breakeven
      t.decimal :roi_percentage, precision: 10, scale: 2
      t.integer :job_zone
      t.string :education_level, limit: 50
      t.jsonb :skills
      t.decimal :cost_of_living_index, precision: 8, scale: 2
      t.decimal :adjusted_salary, precision: 12, scale: 2

      t.timestamps
    end

    add_index :career_roi, :occupation_code, unique: true
    add_index :career_roi, :roi_percentage
    add_index :career_roi, :annual_median_salary
    add_index :career_roi, :years_to_breakeven
  end
end
