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

  # The uploader bounds slots with Pipeline.slot? and the generator emits
  # SHOT_STYLES entries; both must track IMAGE_COUNT.
  def test_image_count_matches_the_number_of_shot_styles
    require_relative 'image_prompts'
    assert_equal Pipeline::IMAGE_COUNT, ImagePrompts::SHOT_STYLES.size
    assert_equal Pipeline::IMAGE_COUNT, ImagePrompts::IMAGE_COUNT
  end
end