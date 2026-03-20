class Swipe < ApplicationRecord
  self.table_name = "swipes"

  validates :career_id, presence: true
  validates :user_id, presence: true
  validates :direction, presence: true, inclusion: { in: %w[left right] }
end
