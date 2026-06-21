# frozen_string_literal: true

class AddApiHotPathIndexes < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def up
    add_index :career_roi, :area_code, algorithm: :concurrently
    add_index :career_roi, [ :area_code, :roi_percentage ], algorithm: :concurrently
    add_index :career_roi, [ :area_code, :annual_median_salary ], algorithm: :concurrently
    add_index :career_roi, [ :area_code, :years_to_breakeven ], algorithm: :concurrently
    add_index :career_roi, [ :area_code, :demand_score ], algorithm: :concurrently

    add_index :swipes, :user_id, algorithm: :concurrently
    add_index :swipes, [ :user_id, :direction ], algorithm: :concurrently
    add_index :swipes, [ :user_id, :created_at ], algorithm: :concurrently

    add_index :salary_occupations, [ :selectable, :sort_sequence ], algorithm: :concurrently
  end

  def down
    remove_index :salary_occupations, [ :selectable, :sort_sequence ]
    remove_index :swipes, [ :user_id, :created_at ]
    remove_index :swipes, [ :user_id, :direction ]
    remove_index :swipes, :user_id
    remove_index :career_roi, [ :area_code, :demand_score ]
    remove_index :career_roi, [ :area_code, :years_to_breakeven ]
    remove_index :career_roi, [ :area_code, :annual_median_salary ]
    remove_index :career_roi, [ :area_code, :roi_percentage ]
    remove_index :career_roi, :area_code
  end
end
