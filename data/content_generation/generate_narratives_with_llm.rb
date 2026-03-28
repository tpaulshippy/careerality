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

  def save_results(prompts_file, output_dir)
    prompts_data = load_prompts(prompts_file)
    
    # Create output directory if it doesn't exist
    Dir.mkdir(output_dir) unless Dir.exist?(output_dir)
    
    count = 0
    prompts_data.each do |code, prompt_info|
      puts "Generating narrative for #{code}..."

      summary_prompt = prompt_info['summary_prompt']
      full_prompt = prompt_info['full_prompt']
      occupation_name = prompt_info['occupation_name'] || code

      unless summary_prompt && full_prompt
        puts "Skipping #{code}: missing prompts"
        next
      end

      begin
        # Generate both summary and full narrative from LLM
        summary_content = generate_from_prompt(summary_prompt, occupation_name)
        full_content = generate_from_prompt(full_prompt, occupation_name)

        result = {
          occupation_code: code,
          occupation_name: occupation_name,
          day_in_life_summary: summary_content,
          full_narrative: full_content,
          video_url: prompt_info['video_url']
        }

        # Save individual file per occupation
        file_path = File.join(output_dir, "#{code}.json")
        File.write(file_path, JSON.pretty_generate(result))
        count += 1
      rescue StandardError => e
        warn "Error processing #{code}: #{e.class} - #{e.message}"
      end
    end

    puts "Saved narratives for #{count} occupations to #{output_dir}"
  end
end

if __FILE__ == $PROGRAM_NAME
  prompts_file = ARGV[0] || File.expand_path('narrative_prompts.json', __dir__)
  output_dir = ARGV[1] || File.expand_path('generated_narratives', __dir__)
  model = ARGV[2] || ENV['LLM_MODEL'] || 'llama3.2'
  uri = ARGV[3] || ENV['LLM_URI'] || 'http://localhost:11434'

  generator = GenerateNarrativesWithLLM.new(model: model, uri: uri)
  generator.save_results(prompts_file, output_dir)
end

