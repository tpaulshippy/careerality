# frozen_string_literal: true

require_relative 'narrative_generation'

class GenerateNarratives
  def initialize
    NarrativeGeneration.establish_connection
  end

  def generate_day_in_life(occupation_data, occupation_name)
    singular_name = NarrativeGeneration.singularize_occupation(occupation_name)
    occupation_description = occupation_data['OnetDescription'] || ''

    task_list = NarrativeGeneration.format_task_list(occupation_data['Tasks'] || [], '. ', 5)
    skill_list = NarrativeGeneration.format_skill_list(occupation_data['Skills'] || [])

    prompt = <<~PROMPT
      Write a brief 1-2 sentence summary suitable for a swipe card about what a #{singular_name} does daily.
      
      Occupation overview: #{occupation_description}
      The role involves: #{task_list}.
      Key skills needed: #{skill_list}.

      Format as a single engaging sentence suitable for a quick career overview.
    PROMPT

    prompt.strip
  end

  def generate_full_narrative(occupation_data, occupation_name)
    singular_name = NarrativeGeneration.singularize_occupation(occupation_name)
    occupation_description = occupation_data['OnetDescription'] || ''

    task_list = NarrativeGeneration.format_task_list(occupation_data['Tasks'] || [], "\n- ", 7)
    skill_list = NarrativeGeneration.format_skill_list_multiline(occupation_data['Skills'] || [], true)

    prompt = <<~PROMPT
      Write a detailed "day in the life" narrative (2-3 paragraphs) for a #{singular_name}.
      
      Occupation definition (canonical O*NET description): #{occupation_description}

      Include:
      - Typical tasks: - #{task_list}
      - Required skills: - #{skill_list}
      - What makes this career rewarding

      Write in a compelling, narrative style that's grounded in the occupation definition above.
    PROMPT

    prompt.strip
  end

  def process_all(occupation_codes = nil)
    codes = occupation_codes || NarrativeGeneration.load_all_occupation_codes

    results = {}

    codes.each do |code|
      puts "Generating prompts for #{code}..."

      occupation_data = NarrativeGeneration.load_occupation_data(code)
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
