# frozen_string_literal: true

require 'json'
require 'ruby_llm'

class GenerateNarrativesWithLLM
  def initialize(model: 'llama3.2', uri: 'http://localhost:11434')
    @model = model
    @uri = uri
  end

  def load_prompts(prompts_file)
    unless File.exist?(prompts_file)
      raise "Prompts file not found: #{prompts_file}"
    end

    JSON.parse(File.read(prompts_file))
  end

  def generate_from_prompts(prompts_data)
    results = {}

    prompts_data.each do |code, prompt_info|
      puts "Generating narrative for #{code}..."

      summary_prompt = prompt_info['summary_prompt']
      full_prompt = prompt_info['full_prompt']
      occupation_name = prompt_info['occupation_name']

      unless summary_prompt && full_prompt
        puts "Skipping #{code}: missing prompts"
        next
      end

      # Generate both summary and full narrative from LLM
      summary_content = generate_from_prompt(summary_prompt, occupation_name)
      full_content = generate_from_prompt(full_prompt, occupation_name)

      results[code] = {
        occupation_name: occupation_name,
        day_in_life_summary: summary_content,
        full_narrative: full_content,
        video_url: prompt_info['video_url']
      }
    rescue StandardError => e
      warn "Error processing #{code}: #{e.class} - #{e.message}"
      results[code] = {
        occupation_name: occupation_name,
        day_in_life_summary: "Failed to generate: #{e.class}",
        full_narrative: "Failed to generate: #{e.class}",
        video_url: prompt_info['video_url']
      }
    end

    results
  end

  def generate_from_prompt(prompt, occupation_name)
    chat = RubyLLM.chat(model: @model, uri: @uri)
    response = chat.ask(prompt)
    response.content
  rescue JSON::ParserError, StandardError => e
    warn "Error generating narrative for #{occupation_name}: #{e.class} - #{e.message}"
    "Failed to generate: #{e.class}"
  end

  def save_results(prompts_file, output_file)
    prompts_data = load_prompts(prompts_file)
    results = generate_from_prompts(prompts_data)
    File.write(output_file, JSON.pretty_generate(results))
    puts "Saved narratives to #{output_file}"
  end
end

if __FILE__ == $PROGRAM_NAME
  prompts_file = ARGV[0] || File.expand_path('narrative_prompts.json', __dir__)
  output = ARGV[1] || File.expand_path('generated_narratives.json', __dir__)
  model = ARGV[2] || 'llama3.2'
  uri = ARGV[3] || 'http://localhost:11434'

  generator = GenerateNarrativesWithLLM.new(model: model, uri: uri)
  generator.save_results(prompts_file, output)
end

