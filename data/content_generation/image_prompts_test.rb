# frozen_string_literal: true

require 'minitest/autorun'
require 'json'
require 'tmpdir'
require 'fileutils'
require_relative 'image_prompts'

# Prompt construction is the part of the pipeline that decides what an image looks
# like, and it is pure string logic over the narrative index. These cover the O*NET
# fallback, which only runs for a career with no narrative JSON and so was never
# exercised: all 1082 current careers have one. A nil narrative used to raise
# NoMethodError on nil.empty? there and abort the entire prompt build.
#
# Loads without ActiveRecord, so it runs in the data-scripts CI job.
class TestImagePrompts < Minitest::Test
  ONET = {
    'OnetTitle' => 'Electricians',
    'OnetDescription' => 'Install and repair electrical wiring and equipment.',
    'Tasks' => [{ 'task_description' => 'Read blueprints and inspect electrical systems' }],
    'Skills' => []
  }.freeze

  NARRATIVE = {
    'occupation_name' => 'Chief Executives',
    'day_in_life_summary' => 'You sit at the head of a long table staring at a budget report.',
    'full_narrative' => 'You start early in a quiet corner office. The city is below you.'
  }.freeze

  def test_narrative_moment_survives_a_nil_narrative
    moment = ImagePrompts.narrative_moment(nil, ONET)
    assert moment.include?('Read blueprints'), 'should fall back to the O*NET task'
  end

  def test_narrative_setting_survives_a_nil_narrative
    setting = ImagePrompts.narrative_setting(nil, ONET)
    assert setting.include?('electrical wiring'), 'should fall back to the O*NET description'
  end

  def test_blank_narrative_fields_fall_back_rather_than_producing_blanks
    blank = { 'day_in_life_summary' => '', 'full_narrative' => '' }
    assert ImagePrompts.narrative_moment(blank, ONET).include?('Read blueprints')
    assert ImagePrompts.narrative_setting(blank, ONET).include?('electrical wiring')
  end

  def test_narrative_is_preferred_when_present
    assert ImagePrompts.narrative_moment(NARRATIVE, ONET).include?('head of a long table')
    assert ImagePrompts.narrative_setting(NARRATIVE, ONET).include?('corner office')
  end

  # A single very long opening sentence, so the two-sentence cap does not bound it
  # and the explicit truncate has to.
  def test_setting_is_truncated_to_a_sane_prompt_length
    long = { 'full_narrative' => "#{'A very long clause about the work ' * 40}. Then more." }
    setting = ImagePrompts.narrative_setting(long, ONET)
    assert setting.length <= 325, "got #{setting.length} chars"
    assert setting.end_with?('...')
  end

  def test_setting_uses_only_the_opening_sentences
    long = { 'full_narrative' => 'First line here. Second line here. Third line here. Fourth.' }
    setting = ImagePrompts.narrative_setting(long, ONET)
    assert setting.include?('First line here.')
    assert setting.include?('Second line here.')
    refute setting.include?('Third line here.'), 'should stop after two sentences'
  end

  def test_build_prompts_produces_one_distinct_prompt_per_slot
    prompts = ImagePrompts.build_prompts(ONET, 'Electricians', nil)
    assert_equal Pipeline::IMAGE_COUNT, prompts.size
    assert_equal prompts.size, prompts.uniq.size, 'each slot should differ'
  end

  def test_build_prompts_uses_the_narrative_for_every_slot
    prompts = ImagePrompts.build_prompts(ONET, 'Chief Executives', NARRATIVE)
    prompts.each { |p| assert p.include?('head of a long table') }
  end

  # Slot 3 moves in tight on the subject's hands, which is the shot most likely to
  # expose hand artefacts, so the guidance must be present.
  def test_close_detail_shot_explains_the_framing
    prompts = ImagePrompts.build_prompts(ONET, 'Electricians', nil)
    assert prompts.last.include?('Move in tight on their hands')
  end

  def test_narrative_index_ignores_non_object_documents
    dir = File.join(Dir.tmpdir, 'narratives-validity')
    FileUtils.mkdir_p(dir)
    File.write(File.join(dir, 'a.json'), JSON.generate({ 'occupation_code' => '111011' }))
    File.write(File.join(dir, 'b.json'), 'null')
    File.write(File.join(dir, 'c.json'), '[]')
    File.write(File.join(dir, 'd.json'), 'not json at all')

    index = ImagePrompts.narrative_index(dir)
    assert_equal ['111011'], index.keys
  ensure
    FileUtils.rm_rf(dir)
  end
end