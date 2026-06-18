class AddSwipesCareerForeignKey < ActiveRecord::Migration[8.0]
  def up
    execute "ALTER TABLE swipes ALTER COLUMN career_id TYPE bigint"
    Swipe.where("career_id NOT IN (SELECT id FROM career_roi)").in_batches do |batch|
      batch.delete_all
    end
    add_foreign_key :swipes, :career_roi, column: :career_id, on_delete: :nullify
  end

  def down
    remove_foreign_key :swipes, column: :career_id
    execute "ALTER TABLE swipes ALTER COLUMN career_id TYPE integer"
  end
end
