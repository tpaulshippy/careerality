# frozen_string_literal: true

require 'json'
require 'ruby_llm'

class GenerateNarrativesWithLLM
  def initialize(model: 'llama3.2', uri: 'http://localhost:11434')
    @model = model
    @uri = uri
  end

  def load_data
    JSON.parse(File.read(@data_file))
  end

  def generate(occupation_data, occupation_name)
    details = occupation_data['details'] || {}
    tasks = details['Tasks'] || []
    skills = details['Skills'] || []
    work_env = details.dig('WorkEnvironment', 0) || {}

    task_list = tasks.take(10).map { |t| t['TaskDescription'] }.compact.join("\n- ")
    skill_list = skills.map { |s| "#{s['ElementName']} (#{s['Importance']})" }.compact.join("\n- ")
    work_context = work_env['WorkEnvironment'] || ''

    prompt = <<~PROMPT
      Write content for a career exploration app about being a #{occupation_name}.

      Write two things:
      1. DAY IN LIFE SUMMARY: A brief 1-2 sentence summary suitable for a swipe card.
      2. FULL NARRATIVE: A detailed "day in the life" narrative (2-3 paragraphs) in a compelling style.

      Occupation details:
      - Typical tasks: - #{task_list}
      - Required skills: - #{skill_list}
      - Work environment: #{work_context}

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

  def process_all(data_file)
    @data_file = data_file
    data = load_data

    results = {}

    data.each do |code, occupation_data|
      puts "Generating for #{code}..."

      name = occupation_data.dig('details', 'OnetTitle') || code

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
  data_file = ARGV[0] || File.expand_path('../careeronestop_data.json', __dir__)
  output = ARGV[1] || File.expand_path('generated_narratives.json', __dir__)
  model = ARGV[2] || 'llama3.2'
  uri = ARGV[3] || 'http://localhost:11434'

  generator = GenerateNarrativesWithLLM.new(model: model, uri: uri)
  generator.save_results(data_file, output)
end
