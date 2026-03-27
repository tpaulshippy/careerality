class CreateCareerImages < ActiveRecord::Migration[8.0]
  def change
    create_table :career_images do |t|
      t.string :occupation_code
      t.text :image_url
      t.text :prompt_used
      t.integer :order

      t.timestamps
    end
    add_index :career_images, :occupation_code
  end
end
