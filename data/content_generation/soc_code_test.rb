# frozen_string_literal: true

require 'minitest/autorun'
require_relative 'soc_code'

# SocCode is the single mapping the whole pipeline depends on: narrative index
# keys, image filenames, checkpoint keys, R2 object names and career_profiles
# lookups all have to agree. Run with:
#
#   ruby data/content_generation/soc_code_test.rb
class TestSocCode < Minitest::Test
  def test_compact_handles_every_input_shape
    # The API returns the SOC form; career_profiles does too; the narrative index
    # and image filenames use the compact form. All three must collapse to one key.
    %w[11-1011.00 11-1011 111011].each do |input|
      assert_equal '111011', SocCode.compact(input), "compact(#{input.inspect})"
    end
  end

  def test_compact_ignores_separators_rather_than_truncating_blindly
    assert_equal '132011', SocCode.compact('13-2011')
    assert_equal '132011', SocCode.compact('132011')
  end

  def test_compact_leaves_short_input_alone
    # Anything that is not a full SOC code is passed through rather than guessed at.
    assert_equal '12345', SocCode.compact('12345')
    assert_equal '', SocCode.compact('')
  end

  def test_soc_restores_the_database_form
    assert_equal '11-1011.00', SocCode.soc('111011')
    assert_equal '29-1141.00', SocCode.soc('291141')
  end

  def test_soc_passes_through_non_six_digit_input
    # Guessing here would produce a malformed WHERE clause.
    assert_equal '12345', SocCode.soc('12345')
  end

  def test_round_trip
    %w[11-1011.00 13-2011.00 33-3011.00].each do |soc|
      assert_equal soc, SocCode.soc(SocCode.compact(soc))
    end
  end
end