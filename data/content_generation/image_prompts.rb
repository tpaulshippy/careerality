# frozen_string_literal: true

require 'active_record'
require 'active_support/inflector'
require 'json'

module ImagePrompts
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
      "SELECT occupation_code, occupation_name, occupation_description, onet_data, skills, tasks, work_activities FROM career_profiles WHERE occupation_code = $1",
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

    work_activities = profile['work_activities']
    work_activities = JSON.parse(work_activities) if work_activities.is_a?(String)

    onet_data = profile['onet_data']
    onet_data = JSON.parse(onet_data) if onet_data.is_a?(String)

    {
      'OnetTitle' => profile['occupation_name'],
      'OnetCode' => profile['occupation_code'],
      'OnetDescription' => profile['occupation_description'],
      'Tasks' => tasks_data || [],
      'Skills' => skills || [],
      'WorkEnvironment' => [{ 'WorkEnvironment' => profile['occupation_description'] || '' }],
      'InterestDataList' => onet_data&.dig('interests') || []
    }
  end

  def self.load_all_occupation_codes
    ActiveRecord::Base.connection.exec_query(
      "SELECT occupation_code FROM career_profiles"
    ).map { |row| row['occupation_code'] }
  end

  def self.singularize_occupation(occupation_name)
    return occupation_name unless occupation_name

    occupation_name.singularize
  end

  def self.primary_task(occupation_data)
    tasks = occupation_data['Tasks'] || []
    return nil if tasks.empty?

    task = tasks.first
    if task.is_a?(Hash)
      task['task_description']
    else
      task
    end
  end

  def self.work_context(occupation_data)
    work_env = occupation_data.dig('WorkEnvironment', 0)
    return '' unless work_env

    work_env['WorkEnvironment'] || ''
  end
end
