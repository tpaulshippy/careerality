require 'json'

class GenerateNarratives
  def initialize(data_file)
    @data_file = data_file
  end

  def load_data
    JSON.parse(File.read(@data_file))
  end

  def generate_day_in_life(occupation_data, occupation_name)
    details = occupation_data['details'] || { }
    tasks = details.dig('Tasks', 0, 'Task') || [ ]
    skills = details.dig('Skills', 0, 'Skill') || [ ]
    work_env = details.dig('WorkEnvironment', 0, 'WorkEnvironment') || { }

    task_list = tasks.take(5).map { |t| t['TaskDescription'] }.compact.join('. ')
    skill_list = skills.take(5).map { |s| s['SkillName'] }.compact.join(', ')
    work_context = work_env['WorkContextDescription'] || ''

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
    details = occupation_data['details'] || { }
    tasks = details.dig('Tasks', 0, 'Task') || [ ]
    skills = details.dig('Skills', 0, 'Skill') || [ ]
    work_env = details.dig('WorkEnvironment', 0, 'WorkEnvironment') || { }

    task_list = tasks.map { |t| t['TaskDescription'] }.compact.join("\n- ")
    skill_list = skills.map { |s| "#{s['SkillName']} (#{s['Importance']})" }.compact.join("\n- ")

    prompt = <<~PROMPT
      Write a detailed "day in the life" narrative (2-3 paragraphs) for a #{occupation_name}.
      
      Include:
      - Typical tasks: - #{task_list}
      - Required skills: - #{skill_list}
      - Work environment details
      - What makes this career rewarding
      
      Write in a compelling, narrative style.
    PROMPT

    prompt.strip
  end

  def process_all
    data = load_data
    
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

if __FILE__ == $0
  data_file = ARGV[0] || '../careeronestop_data.json'
  output = ARGV[1] || 'narrative_prompts.json'
  
  generator = GenerateNarratives.new(data_file)
  generator.save_prompts(output)
end