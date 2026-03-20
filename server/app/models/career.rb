class Career < ApplicationRecord
  self.table_name = "salary_occupations"
  self.primary_key = "occupation_code"

  def as_json(options = {})
    {
      code: occupation_code,
      name: occupation_name,
      description: occupation_description,
      level: display_level
    }
  end
end
