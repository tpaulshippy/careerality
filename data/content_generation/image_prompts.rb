# frozen_string_literal: true

require 'active_record'
require 'active_support/inflector'
require 'json'
require_relative 'pipeline'

module ImagePrompts
  # Number of images generated per career, for the in-app slideshow.
  IMAGE_COUNT = Pipeline::IMAGE_COUNT

  DB_CONFIG = {
    adapter: ENV.fetch('DB_ADAPTER', 'postgresql'),
    database: ENV['DB_NAME'] || ENV['PGDATABASE'] || 'careerality',
    user: ENV['DB_USER'] || ENV['PGUSER'] || 'postgres',
    password: ENV['DB_PASSWORD'] || ENV['PGPASSWORD'] || 'postgres',
    host: ENV['DB_HOST'] || ENV['PGHOST'] || 'localhost'
  }.freeze

  def self.establish_connection
    ActiveRecord::Base.establish_connection(DB_CONFIG)
  end

  def self.load_occupation_data(occupation_code)
    profile = ActiveRecord::Base.connection.exec_query(
      "SELECT occupation_code, occupation_name, occupation_description, skills, tasks FROM career_profiles WHERE occupation_code = $1",
      nil,
      [occupation_code]
    ).first

    return nil unless profile

    tasks_data = ActiveRecord::Base.connection.exec_query(
      <<~SQL,
        SELECT task_description, importance, frequency, task_type
        FROM onet_tasks
        WHERE occupation_code = $1
        ORDER BY importance DESC NULLS LAST, frequency DESC NULLS LAST
        LIMIT 3
      SQL
      nil,
      [occupation_code]
    ).to_a

    if tasks_data.empty?
      legacy_tasks = profile['tasks']
      legacy_tasks = JSON.parse(legacy_tasks) if legacy_tasks.is_a?(String)
      tasks_data = legacy_tasks || []
    end

    skills = profile['skills']
    skills = JSON.parse(skills) if skills.is_a?(String)

    {
      'OnetTitle' => profile['occupation_name'],
      'OnetCode' => profile['occupation_code'],
      'OnetDescription' => profile['occupation_description'],
      'Tasks' => tasks_data || [],
      'Skills' => skills || []
    }
  end

  # Narratives are the primary prompt source: they describe the actual work in
  # sensory detail, which is what makes the generated photos specific rather
  # than a generic "person at a laptop". Falls back to nil when absent so the
  # caller can drop to O*NET tasks/skills.
  #
  # Keys are compact 6-digit SOC codes ("11-1011.00" -> "111011"), matching the
  # occupation_code format the generation and upload scripts expect.
  def self.narrative_index(dir = File.expand_path('generated_narratives', __dir__))
    @narrative_indexes ||= {}
    @narrative_indexes[dir] ||= Dir.glob(File.join(dir, '*.json')).each_with_object({}) do |path, index|
      data = begin
        JSON.parse(File.read(path))
      rescue JSON::ParserError
        next
      end

      # A stray file holding a valid non-object document (null, [], a string)
      # must not abort the whole index.
      next unless data.is_a?(Hash)

      code = data['occupation_code']
      index[compact_code(code)] = data if code
    end
  end

  # Delegates to Pipeline so the mapping has a single definition.
  def self.compact_code(code)
    Pipeline.compact(code)
  end

  def self.reset_narrative_index!
    @narrative_indexes = {}
  end

  def self.singularize_occupation(occupation_name)
    return occupation_name unless occupation_name

    occupation_name.singularize
  end

  def self.primary_task(occupation_data)
    tasks = occupation_data['Tasks'] || []
    return nil if tasks.empty?

    task = tasks.first
    task.is_a?(Hash) ? task['task_description'] : task
  end

  # The three shots cycle through framing styles so a career's images read as a
  # sequence rather than three near-identical portraits.
  SHOT_STYLES = [
    {
      framing: 'wide establishing shot',
      direction: 'Pull back far enough to show the whole room and the people around them.'
    },
    {
      framing: 'over-the-shoulder medium shot',
      direction: 'Stay close behind their shoulder, focused on what their hands are doing.'
    },
    {
      framing: 'close detail shot',
      direction: 'Move in tight on their hands and the work itself, the rest of the room falling out of focus.'
    }
  ].freeze

  STYLE_SUFFIX = 'Photorealistic editorial documentary photograph. Natural available light, ' \
                 'true-to-life colors, shallow depth of field, 35mm. The subject is absorbed in the ' \
                 'work and not aware of the camera. No text, no captions, no logos, no watermarks.'

  # Builds IMAGE_COUNT prompts that share a subject but differ in framing, so the
  # slideshow shows variety instead of three near-duplicates.
  def self.build_prompts(occupation_data, occupation_name, narrative = nil)
    singular_name = singularize_occupation(occupation_name)

    moment = narrative_moment(narrative, occupation_data)
    setting = narrative_setting(narrative, occupation_data)

    SHOT_STYLES.map do |style|
      [
        "A #{style[:framing]} of a #{singular_name} at work.",
        "",
        "This specific moment: #{moment}",
        "The setting: #{setting}",
        style[:direction],
        STYLE_SUFFIX
      ].join("\n")
    end
  end

  # The narrative summary is one sentence written about a real Tuesday morning, so
  # it already carries time of day, place and activity. Falls back to O*NET.
  def self.narrative_moment(narrative, occupation_data)
    summary = narrative && narrative['day_in_life_summary'].to_s.strip
    return summary unless summary.empty?

    task = primary_task(occupation_data)
    return task.to_s.strip unless task.to_s.strip.empty?

    'going about the core duties of the job'
  end

  # Prefers the opening of the full narrative, which describes the actual room and
  # time of day. The O*NET description is a generic job definition, so it is only a
  # last resort.
  def self.narrative_setting(narrative, occupation_data)
    opening = narrative && narrative['full_narrative'].to_s.strip
    unless opening.empty?
      sentences = opening.split(/(?<=[.!?])\s+/).first(2).join(' ')
      return truncate(sentences, 320)
    end

    description = occupation_data['OnetDescription'].to_s.strip
    return description unless description.empty?

    "the usual workplace of a #{singularize_occupation(occupation_data['OnetTitle'])}"
  end

  def self.truncate(text, limit)
    return text if text.length <= limit

    "#{text[0, limit].rstrip.sub(/[.,;:]?\s*\S*\z/, '')}..."
  end
end