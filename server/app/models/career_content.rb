class CareerContent < ApplicationRecord
  self.table_name = "career_contents"
  self.primary_key = "id"

  def as_json(options = {})
    {
      occupation_code: occupation_code,
      day_in_life_summary: day_in_life_summary,
      day_in_life_full: day_in_life_full,
      video_url: video_url
    }
  end
end
