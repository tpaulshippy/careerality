# frozen_string_literal: true

require 'minitest/autorun'
require_relative 'generate_images'

# The generator's configuration is entirely environment-driven, and two of those
# knobs are destructive when set wrong. image_count in particular interacts with the
# stale-slot cleanup: any slot beyond image_count is deleted, so a count of 0 would
# remove every generated PNG in the output directory.
#
# Requires stdlib only, so it runs in the data-scripts CI job.
class TestGenerateImagesConfig < Minitest::Test
  def with_env(vars)
    previous = vars.keys.to_h { |k| [k, ENV.fetch(k, nil)] }
    vars.each { |k, v| v.nil? ? ENV.delete(k) : ENV[k] = v }
    yield
  ensure
    previous.each { |k, v| v.nil? ? ENV.delete(k) : ENV[k] = v }
  end

  def test_default_image_count_matches_the_pipeline
    with_env('IMAGE_COUNT' => nil) do
      assert_equal Pipeline::IMAGE_COUNT, GenerateImages.new.config[:image_count]
    end
  end

  # Guards the bug this file exists for: ENV read at load time meant a variable set
  # after the require was silently ignored.
  def test_env_is_read_at_construction_not_load_time
    with_env('IMAGE_COUNT' => '2') do
      assert_equal 2, GenerateImages.new.config[:image_count]
    end
    with_env('IMAGE_COUNT' => '1') do
      assert_equal 1, GenerateImages.new.config[:image_count]
    end
  end

  def test_image_count_of_zero_is_refused
    # Not merely useless: run() deletes every slot beyond image_count, so 0 would
    # wipe the output directory.
    e = assert_raises(ArgumentError) { GenerateImages.new(image_count: 0) }
    assert_match(/delete/, e.message)
  end

  def test_image_count_above_the_slot_contract_is_refused
    # Slot 4 is never published: the uploader's parser only accepts 1..IMAGE_COUNT,
    # so the work would be discarded.
    assert_raises(ArgumentError) { GenerateImages.new(image_count: 4) }
    assert_raises(ArgumentError) { GenerateImages.new(image_count: 99) }
    assert_raises(ArgumentError) { GenerateImages.new(image_count: -1) }
  end

  def test_image_count_must_be_an_integer
    [nil, '3', 1.5, :three].each do |bad|
      assert_raises(ArgumentError, "image_count=#{bad.inspect} should be refused") do
        GenerateImages.new(image_count: bad)
      end
    end
  end

  def test_valid_image_counts_are_accepted
    (1..Pipeline::IMAGE_COUNT).each do |n|
      assert_equal n, GenerateImages.new(image_count: n).config[:image_count]
    end
  end

  def test_invalid_env_image_count_is_refused_rather_than_defaulted
    with_env('IMAGE_COUNT' => '0') do
      assert_raises(ArgumentError) { GenerateImages.new }
    end
    with_env('IMAGE_COUNT' => 'notanumber') do
      assert_raises(ArgumentError) { GenerateImages.new }
    end
  end

  def test_seeds_are_deterministic_per_code_slot_and_attempt
    a = GenerateImages.seed_for('111011', 1, 1)
    assert_equal a, GenerateImages.seed_for('111011', 1, 1)
    refute_equal a, GenerateImages.seed_for('111011', 1, 2)
    refute_equal a, GenerateImages.seed_for('111011', 2, 1)
    refute_equal a, GenerateImages.seed_for('291141', 1, 1)
  end

  # Normalised into config itself, so config[:endpoint] is the URL actually requested
  # rather than a raw value that only looks like it.
  def test_endpoint_trailing_slash_is_normalised
    with_env('IMAGE_API_URL' => 'http://m5.local:8777/') do
      assert_equal 'http://m5.local:8777', GenerateImages.new.config[:endpoint]
    end
    with_env('IMAGE_API_URL' => 'http://m5.local:8777///') do
      assert_equal 'http://m5.local:8777', GenerateImages.new.config[:endpoint]
    end
  end

  def test_verify_defaults_on_and_can_be_disabled
    with_env('VERIFY_IMAGES' => nil) { assert GenerateImages.new.config[:verify] }
    with_env('VERIFY_IMAGES' => 'true') { assert GenerateImages.new.config[:verify] }
    with_env('VERIFY_IMAGES' => 'false') { refute GenerateImages.new.config[:verify] }
  end
end
