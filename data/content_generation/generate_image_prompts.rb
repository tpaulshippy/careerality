# frozen_string_literal: true

require_relative 'image_prompts'

class GenerateImagePrompts
  def initialize
    ImagePrompts.establish_connection
  end

  def generate_image_prompt(occupation_data, occupation_name)
    singular_name = ImagePrompts.singularize_occupation(occupation_name)
    primary_task = ImagePrompts.primary_task(occupation_data)
    work_context = ImagePrompts.work_context(occupation_data)

    prompt = <<~PROMPT
      Cinematic documentary photograph of a #{singular_name} at work.
      
      Scene: #{primary_task}.
      Environment: #{work_context}.
      
      Shot on 35mm, shallow depth of field, natural window light, candid mid-action moment.
      Photorealistic, editorial style, no text, no logos.
      Subject is focused and competent, not posed or looking at camera.
    PROMPT

    prompt.strip
  end

  def process_all(occupation_codes = nil)
    codes = occupation_codes || ImagePrompts.load_all_occupation_codes

    results = {}

    codes.each do |code|
      puts "Generating prompt for #{code}..."

      occupation_data = ImagePrompts.load_occupation_data(code)
      unless occupation_data
        puts "No data found for #{code}, skipping"
        next
      end

      name = occupation_data['OnetTitle'] || code
      prompt = generate_image_prompt(occupation_data, name)

      results[code] = {
        occupation_name: name,
        prompt: prompt
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
  output = ARGV[0] || File.expand_path('image_prompts.json', __dir__)
  codes = ARGV[1]&.split(',') || nil

  generator = GenerateImagePrompts.new
  generator.save_prompts(output, codes)
end
