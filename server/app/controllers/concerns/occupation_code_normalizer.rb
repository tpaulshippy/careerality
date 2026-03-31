# frozen_string_literal: true

module OccupationCodeNormalizer
  extend ActiveSupport::Concern

  private

  def normalize_occupation_code(code)
    return nil unless code.present?

    code = code.to_s.strip

    # Accept only fully-formed codes matching "XX-XXXX.00"
    return code if code.match?(/^\d{2}-\d{4}\.00$/)

    # Accept "XX-XXXX" and normalize by appending ".00"
    if code.match?(/^\d{2}-\d{4}$/)
      return "#{code}.00"
    end

    # Accept compact form "XXXXXX" and normalize to "XX-XXXX.00"
    if code.length == 6 && code.match?(/^\d{6}$/)
      return "#{code[0..1]}-#{code[2..5]}.00"
    end

    nil
  end
end
