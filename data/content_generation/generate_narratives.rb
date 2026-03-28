# frozen_string_literal: true

require 'json'

class GenerateNarratives
  def initialize(data_dir)
    @data_dir = data_dir
  end

  def load_all_data
    data = {}
    Dir.glob(File.join(@data_dir, '*.json')).each do |file|
      code = File.basename(file, '.json').gsub('_', '.')
      data[code] = JSON.parse(File.read(file))
    end
    data
  end

  def generate_day_in_life(occupation_data, occupation_name)
    details = occupation_data['details'] || {}
    tasks = details['Tasks'] || []
    skills = details['Skills'] || []
    work_env = details.dig('WorkEnvironment', 0) || {}

    task_list = tasks.take(5).map { |t| t['TaskDescription'] }.compact.join('. ')
    skill_list = skills.take(5).map { |s| s['ElementName'] }.compact.join(', ')
    work_context = work_env['WorkEnvironment'] || ''

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
    details = occupation_data['details'] || {}
    tasks = details['Tasks'] || []
    skills = details['Skills'] || []
    work_env = details.dig('WorkEnvironment', 0) || {}

    task_list = tasks.map { |t| t['TaskDescription'] }.compact.join("\n- ")
    skill_list = skills.map { |s| "#{s['ElementName']} (#{s['Importance']})" }.compact.join("\n- ")
    work_context = work_env['WorkEnvironment'] || ''

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

  def process_all
    data = load_all_data

    results = {}

    data.each do |code, occupation_data|
      puts "Generating for #{code}..."

      name = occupation_data.dig('details', 'OnetTitle') || code

      summary_prompt = generate_day_in_life(occupation_data, name)
      full_prompt = generate_full_narrative(occupation_data, name)

      results[code] = {
        summary_prompt: summary_prompt,
        full_prompt: full_prompt,
        video_url: occupation_data['video_url']
      }
    end

    results
  end

  def save_prompts(output_file)
    results = process_all
    File.write(output_file, JSON.pretty_generate(results))
    puts "Saved prompts to #{output_file}"
  end
end

if __FILE__ == $PROGRAM_NAME
  data_dir = ARGV[0] || File.expand_path('careers', __dir__)
  output = ARGV[1] || File.expand_path('narrative_prompts.json', __dir__)

  generator = GenerateNarratives.new(data_dir)
  generator.save_prompts(output)
end
