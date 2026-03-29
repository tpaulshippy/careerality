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
      You are writing for a career exploration app aimed at teens and young adults.

      Write one vivid, engaging sentence that captures what it FEELS LIKE to be a #{singular_name}
      on a typical workday — not a job description, but a glimpse into their actual day.

      Ground it in concrete, sensory details: what are they doing, deciding, or dealing with?

      Occupation context (use as background, not as text to rephrase):
      - Overview: #{occupation_description}
      - Common tasks: #{task_list}
      - Key skills: #{skill_list}

      Write as if you're showing a teenager what this job actually looks like at 10am on a Tuesday.
      One sentence. No jargon. Make it feel real.
    PROMPT

    prompt.strip
  end

  def generate_full_narrative(occupation_data, occupation_name)
    singular_name = NarrativeGeneration.singularize_occupation(occupation_name)
    occupation_description = occupation_data['OnetDescription'] || ''

    task_list = NarrativeGeneration.format_task_list(occupation_data['Tasks'] || [], "\n- ", 7)
    skill_list = NarrativeGeneration.format_skill_list_multiline(occupation_data['Skills'] || [], true)


    prompt = <<~PROMPT
    You are writing for a career exploration app aimed at teens and young adults discovering careers.

    Write a vivid, immersive "day in the life" narrative (2-3 paragraphs) for a #{singular_name}.
    Write in second person ("You start your morning by...") to make it feel personal and immediate.

    This is NOT a job description. Do not list duties or rephrase the occupation definition.
    Instead, tell a story: what does this person actually experience on a typical Tuesday?
    What decisions do they make? What problems land on their desk? What does the environment feel like?
    End with one sentence about what makes this career meaningful or rewarding.

    Background context (use to inform the story, do not copy or paraphrase directly):
    - Role overview: #{occupation_description}
    - Common tasks: #{task_list}
    - Key skills: #{skill_list}

    Write for a curious 16-year-old. No jargon. Make it feel real and alive.
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
        occupation_name: name,
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
