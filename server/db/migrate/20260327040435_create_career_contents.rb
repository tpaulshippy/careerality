class CreateCareerContents < ActiveRecord::Migration[8.0]
  def change
    create_table :career_contents do |t|
      t.string :occupation_code
      t.text :day_in_life_summary
      t.text :day_in_life_full
      t.string :video_url

      t.timestamps
    end
    add_index :career_contents, :occupation_code, unique: true
  end
end
