# frozen_string_literal: true

class CreateOnetTasks < ActiveRecord::Migration[8.0]
  def change
    create_table :onet_tasks do |t|
      t.string :occupation_code, limit: 20, null: false
      t.integer :task_id, null: false
      t.text :task_description, null: false
      t.decimal :importance, precision: 5, scale: 2
      t.decimal :frequency, precision: 5, scale: 2
      t.string :task_type, limit: 50 # e.g., "Core", "Emerging"

      t.timestamps default: -> { "CURRENT_TIMESTAMP" }
    end

    # Add unique constraint for occupation_code + task_id combo
    add_index :onet_tasks, [ :occupation_code, :task_id ], unique: true
    add_index :onet_tasks, [ :occupation_code, :importance ], order: { importance: :desc }

    # Add foreign key to career_profiles
    add_foreign_key :onet_tasks, :career_profiles, column: :occupation_code, primary_key: :occupation_code
  end
end
