# frozen_string_literal: true

module OccupationCodeNormalizer
  extend ActiveSupport::Concern

  private

  def normalize_occupation_code(code)
    return nil unless code.present?

    code = code.to_s.strip

    return code if code.include?('.')

    if code.include?('-')
      return "#{code}.00"
    end

    if code.length == 6 && code.match?(/^\d+$/)
      return "#{code[0..1]}-#{code[2..5]}.00"
    end

    nil
  end
end
