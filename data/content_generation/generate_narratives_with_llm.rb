# frozen_string_literal: true

require 'json'
require 'ruby_llm'
require 'active_record'

class GenerateNarrativesWithLLM
  DB_CONFIG = {
    adapter: ENV.fetch('DB_ADAPTER', 'postgresql'),
    database: ENV['DB_NAME'] || ENV['PGDATABASE'] || 'careerality',
    user: ENV['DB_USER'] || ENV['PGUSER'] || 'postgres',
    password: ENV['DB_PASSWORD'] || ENV['PGPASSWORD'] || 'postgres',
    host: ENV['DB_HOST'] || ENV['PGHOST'] || 'localhost'
  }

  def initialize(model: 'llama3.2', uri: 'http://localhost:11434')
    @model = model
    @uri = uri
    establish_connection
  end

  def establish_connection
    ActiveRecord::Base.establish_connection(DB_CONFIG)
  end

  def load_occupation_from_db(onet_code)
    profile = ActiveRecord::Base.connection.exec_query(
      "SELECT occupation_code, occupation_name, occupation_description FROM career_profiles WHERE occupation_code = $1",
      nil,
      [onet_code]
    ).first

    return nil unless profile

    # Load top tasks by importance from onet_tasks table
    tasks_data = ActiveRecord::Base.connection.exec_query(
      <<~SQL,
        SELECT task_description, importance, frequency, task_type
        FROM onet_tasks
        WHERE occupation_code = $1
        ORDER BY importance DESC NULLS LAST, frequency DESC NULLS LAST
        LIMIT 7
      SQL
      nil,
      [onet_code]
    ).to_a

    {
      'occupation_name' => profile['occupation_name'],
      'occupation_description' => profile['occupation_description'],
      'tasks' => tasks_data
    }
  end

  def load_all_data
    data = {}
    Dir.glob(File.join(@data_dir, '*.json')).each do |file|
      code = File.basename(file, '.json').gsub('_', '.')
      data[code] = JSON.parse(File.read(file))
    end
    data
  end

  def generate(occupation_data, occupation_name)
    occupation_description = occupation_data['occupation_description'] || ''
    tasks = occupation_data['tasks'] || []
    skills = occupation_data['Skills'] || []

    # Format tasks - they come from onet_tasks table with importance/frequency
    task_list = tasks.map { |t| t['task_description'] || t }.compact.take(7).join("\n- ")
    skill_list = skills.map { |s| "#{s['ElementName']} (#{s['Importance']})" }.compact.join("\n- ")

    prompt = <<~PROMPT
      Write content for a career exploration app about being a #{occupation_name}.

      Write two things:
      1. DAY IN LIFE SUMMARY: A brief 1-2 sentence summary suitable for a swipe card.
      2. FULL NARRATIVE: A detailed "day in the life" narrative (2-3 paragraphs) in a compelling style.

      Use this canonical occupation definition as your anchor/grounding signal:
      Occupation Definition: #{occupation_description}

      Occupation details (filtered by relevance):
      - Typical tasks: - #{task_list}
      - Required skills: - #{skill_list}

      Keep the narrative grounded in the occupation definition. Avoid over-rotating on unusual tasks.
      Format as JSON with keys "day_in_life_summary" and "full_narrative".
    PROMPT

    chat = RubyLLM.chat(model: @model, uri: @uri)
    response = chat.ask(prompt.strip)
    JSON.parse(response.content)
  rescue JSON::ParserError, StandardError => e
    warn "Error generating narrative for #{occupation_name}: #{e.class} - #{e.message}"
    {
      'day_in_life_summary' => "Failed to generate: #{e.class}",
      'full_narrative' => "Failed to generate: #{e.class}"
    }
  end

  def process_all(data_dir)
    @data_dir = data_dir
    data = load_all_data

    results = {}

    data.each do |code, occupation_data|
      puts "Generating for #{code}..."

      # Try to load from database first (newer path with proper task filtering)
      db_data = load_occupation_from_db(code)
      if db_data
        name = db_data['occupation_name']
        occupation_data = db_data.merge('Skills' => occupation_data['details']&.dig('Skills') || [])
      else
        name = occupation_data.dig('details', 'OnetTitle') || code
      end

      content = generate(occupation_data, name)

      results[code] = {
        occupation_name: name,
        day_in_life_summary: content['day_in_life_summary'],
        full_narrative: content['full_narrative'],
        video_url: occupation_data['video_url']
      }
    end

    results
  end

  def save_results(data_file, output_file)
    results = process_all(data_file)
    File.write(output_file, JSON.pretty_generate(results))
    puts "Saved narratives to #{output_file}"
  end
end

if __FILE__ == $PROGRAM_NAME
  data_dir = ARGV[0] || File.expand_path('careers', __dir__)
  output = ARGV[1] || File.expand_path('generated_narratives.json', __dir__)
  model = ARGV[2] || 'llama3.2'
  uri = ARGV[3] || 'http://localhost:11434'

  generator = GenerateNarrativesWithLLM.new(model: model, uri: uri)
  generator.save_results(data_dir, output)
end

