# frozen_string_literal: true

require 'minitest/autorun'
require_relative 'pipeline'

# Pipeline is the shared source for the slot count and the SOC code mapping that
# filenames, checkpoint keys, R2 object names and database lookups all depend on.
# The last few commits in this PR each fixed a distinct bug in exactly this
# conversion, so it is pinned here. Run with:
#
#   ruby data/content_generation/pipeline_test.rb
class TestPipeline < Minitest::Test
  def test_compact_handles_every_input_shape
    # The API and career_profiles use the SOC form; the narrative index and image
    # filenames use the compact form. All three must collapse to one key.
    %w[11-1011.00 11-1011 111011].each do |input|
      assert_equal '111011', Pipeline.compact(input), "compact(#{input.inspect})"
    end
  end

  def test_compact_handles_dashed_and_compact_pairs
    assert_equal '132011', Pipeline.compact('13-2011')
    assert_equal '132011', Pipeline.compact('132011')
  end

  def test_compact_leaves_short_input_alone
    assert_equal '12345', Pipeline.compact('12345')
    assert_equal '', Pipeline.compact('')
  end

  def test_compact_refuses_to_coerce_a_malformed_code
    # Coercing these would resolve to a *different* career and generate or upload
    # assets under its name.
    ['11101x1', '11-101', 'abc', '11-1011.0', '11-1011-00', '1110111', '  '].each do |bad|
      assert_equal bad.strip, Pipeline.compact(bad), "compact(#{bad.inspect}) must not coerce"
    end
  end

  def test_soc_restores_the_database_form
    assert_equal '11-1011.00', Pipeline.soc('111011')
    assert_equal '29-1141.00', Pipeline.soc('291141')
  end

  def test_soc_passes_through_non_six_digit_input
    assert_equal '12345', Pipeline.soc('12345')
  end

  def test_round_trip
    %w[11-1011.00 13-2011.00 33-3011.00].each do |soc|
      assert_equal soc, Pipeline.soc(Pipeline.compact(soc))
    end
  end

  def test_slots_are_one_based_and_bounded
    assert Pipeline.slot?(1)
    assert Pipeline.slot?(Pipeline::IMAGE_COUNT)
    refute Pipeline.slot?(0)
    refute Pipeline.slot?(Pipeline::IMAGE_COUNT + 1)
    refute Pipeline.slot?('1')
  end

  # The generator emits one prompt per SHOT_STYLES entry and the uploader accepts
  # slots up to IMAGE_COUNT; both must track the same number.
  def test_image_count_matches_the_number_of_shot_styles
    assert_equal Pipeline::IMAGE_COUNT, Pipeline::SHOT_STYLES.size
  end

  def test_every_shot_style_has_framing_and_direction
    Pipeline::SHOT_STYLES.each do |style|
      assert style[:framing].is_a?(String), 'missing framing'
      assert style[:direction].is_a?(String), 'missing direction'
    end
  end
end
