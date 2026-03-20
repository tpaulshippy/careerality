class CreateSwipes < ActiveRecord::Migration[7.1]
  def change
    create_table :swipes do |t|
      t.integer :career_id
      t.string :user_id
      t.string :direction
      t.text :feedback

      t.timestamps
    end
  end
end
