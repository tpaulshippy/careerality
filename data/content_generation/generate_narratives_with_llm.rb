# frozen_string_literal: true

require 'json'
require 'net/http'
require 'uri'

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
      occupation_name = prompt_info['occupation_name'] || code

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
        occupation_name: occupation_name || code,
        day_in_life_summary: "Failed to generate: #{e.class}",
        full_narrative: "Failed to generate: #{e.class}",
        video_url: prompt_info['video_url']
      }
    end

    results
  end

  def generate_from_prompt(prompt, occupation_name)
    response = call_ollama(prompt)
    response if response && response != "Failed to generate"
  rescue StandardError => e
    warn "Error generating narrative for #{occupation_name}: #{e.class} - #{e.message}"
    "Failed to generate: #{e.class}"
  end

  def call_ollama(prompt)
    uri = URI("#{@uri}/api/generate")
    http = Net::HTTP.new(uri.host, uri.port)
    http.read_timeout = 300

    request = Net::HTTP::Post.new(uri.path, { 'Content-Type' => 'application/json' })
    request.body = JSON.generate({
      model: @model,
      prompt: prompt,
      stream: false
    })

    response = http.request(request)
    if response.is_a?(Net::HTTPSuccess)
      data = JSON.parse(response.body)
      data['response'] || "No response from model"
    else
      "Failed to generate"
    end
  rescue StandardError => e
    warn "Ollama API error: #{e.class} - #{e.message}"
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
  model = ARGV[2] || ENV['LLM_MODEL'] || 'llama3.2'
  uri = ARGV[3] || ENV['LLM_URI'] || 'http://localhost:11434'

  generator = GenerateNarrativesWithLLM.new(model: model, uri: uri)
  generator.save_results(prompts_file, output)
end

