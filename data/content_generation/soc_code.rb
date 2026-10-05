# frozen_string_literal: true

# Single source of truth for SOC code formatting.
#
# The pipeline keys everything off the compact 6-digit form: narrative index keys,
# image filenames, state keys and R2 object names. career_profiles and the API use
# the SOC form "XX-XXXX.00". If these two representations ever disagree, generation
# and upload silently target different objects, so the mapping lives here alone.
#
# Deliberately dependency-free so the generator and uploader can require it without
# pulling in ActiveRecord.
module SocCode
  # "11-1011.00", "11-1011" and "111011" all become "111011".
  def self.compact(code)
    digits = code.to_s.strip.gsub(/[^0-9]/, '')
    digits.length > 6 ? digits[0, 6] : digits
  end

  # "111011" becomes "11-1011.00". Anything that is not exactly six digits is
  # returned unchanged rather than guessed at.
  def self.soc(compact)
    return compact unless compact.to_s =~ /\A\d{6}\z/

    "#{compact[0..1]}-#{compact[2..5]}.00"
  end
end