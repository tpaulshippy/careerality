# frozen_string_literal: true

require 'json'
require 'active_record'

class GenerateNarratives
  DB_CONFIG = {
    adapter: ENV.fetch('DB_ADAPTER', 'postgresql'),
    database: ENV['DB_NAME'] || ENV['PGDATABASE'] || 'careerality',
    user: ENV['DB_USER'] || ENV['PGUSER'] || 'postgres',
    password: ENV['DB_PASSWORD'] || ENV['PGPASSWORD'] || 'postgres',
    host: ENV['DB_HOST'] || ENV['PGHOST'] || 'localhost'
  }

  def initialize
    establish_connection
  end

  def establish_connection
    ActiveRecord::Base.establish_connection(DB_CONFIG)
  end

  def load_occupation_data(occupation_code)
    profile = ActiveRecord::Base.connection.exec_query(
      "SELECT occupation_code, occupation_name, occupation_description, onet_data, skills, tasks, work_activities FROM career_profiles WHERE occupation_code = $1",
      nil,
      [occupation_code]
    ).first

    return nil unless profile

    {
      'OnetTitle' => profile['occupation_name'],
      'OnetCode' => profile['occupation_code'],
      'OnetDescription' => profile['occupation_description'],
      'Tasks' => profile['tasks'] || [],
      'Skills' => profile['skills'] || [],
      'WorkEnvironment' => [{ 'WorkEnvironment' => profile['occupation_description'] || '' }],
      'InterestDataList' => profile['onet_data']&.dig('interests') || []
    }
  end

  def load_all_occupation_codes
    ActiveRecord::Base.connection.exec_query(
      "SELECT occupation_code FROM career_profiles"
    ).map { |row| row['occupation_code'] }
  end

  def generate_day_in_life(occupation_data, occupation_name)
    tasks = occupation_data['Tasks'] || []
    skills = occupation_data['Skills'] || []
    work_context = occupation_data.dig('WorkEnvironment', 0)&.dig('WorkEnvironment') || ''

    task_list = tasks.take(5).map { |t| t.is_a?(Hash) ? t['TaskDescription'] : t }.compact.join('. ')
    skill_list = skills.take(5).map { |s| s.is_a?(Hash) ? s['ElementName'] : s }.compact.join(', ')

    prompt = <<~PROMPT
      Write a brief 1-2 sentence summary suitable for a swipe card about what a #{occupation_name} does daily.
      The role involves: #{task_list}.
      Key skills needed: #{skill_list}.
      Work context: #{work_context}.

      Format as a single engaging sentence suitable for a quick career overview.
    PROMPT

    prompt.strip
  end

  def generate_full_narrative(occupation_data, occupation_name)
    tasks = occupation_data['Tasks'] || []
    skills = occupation_data['Skills'] || []
    work_context = occupation_data.dig('WorkEnvironment', 0)&.dig('WorkEnvironment') || ''

    task_list = tasks.map { |t| t.is_a?(Hash) ? t['TaskDescription'] : t }.compact.join("\n- ")
    skill_list = skills.map { |s| s.is_a?(Hash) ? "#{s['ElementName']} (#{s['Importance']})" : s }.compact.join("\n- ")

    prompt = <<~PROMPT
      Write a detailed "day in the life" narrative (2-3 paragraphs) for a #{occupation_name}.

      Include:
      - Typical tasks: - #{task_list}
      - Required skills: - #{skill_list}
      - Work environment details: #{work_context}
      - What makes this career rewarding

      Write in a compelling, narrative style.
    PROMPT

    prompt.strip
  end

  def process_all(occupation_codes = nil)
    codes = occupation_codes || load_all_occupation_codes

    results = {}

    codes.each do |code|
      puts "Generating prompts for #{code}..."

      occupation_data = load_occupation_data(code)
      unless occupation_data
        puts "No data found for #{code}, skipping"
        next
      end

      name = occupation_data['OnetTitle'] || code

      summary_prompt = generate_day_in_life(occupation_data, name)
      full_prompt = generate_full_narrative(occupation_data, name)

      results[code] = {
        summary_prompt: summary_prompt,
        full_prompt: full_prompt,
        video_url: nil
      }
    end

    results
  end

  def save_prompts(output_file, occupation_codes = nil)
    results = process_all(occupation_codes)
    File.write(output_file, JSON.pretty_generate(results))
    puts "Saved prompts to #{output_file}"
  end
end

if __FILE__ == $PROGRAM_NAME
  output = ARGV[0] || File.expand_path('narrative_prompts.json', __dir__)
  codes = ARGV[1]&.split(',') || nil

  generator = GenerateNarratives.new
  generator.save_prompts(output, codes)
end
