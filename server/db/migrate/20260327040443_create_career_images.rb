class CreateCareerImages < ActiveRecord::Migration[8.0]
  def change
    create_table :career_images do |t|
      t.string :occupation_code, null: false
      t.text :image_url
      t.text :prompt_used
      t.integer :position

      t.timestamps
    end
    add_index :career_images, [:occupation_code, :position], unique: true
  end
end
