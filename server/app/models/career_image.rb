class CareerImage < ApplicationRecord
  self.table_name = "career_images"
  self.primary_key = "id"

  def as_json(options = {})
    {
      id: id,
      occupation_code: occupation_code,
      image_url: image_url,
      prompt_used: prompt_used,
      order: order
    }
  end
end