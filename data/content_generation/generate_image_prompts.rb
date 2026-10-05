# frozen_string_literal: true

require_relative 'image_prompts'

# Writes image_prompts.json: one entry per occupation, each carrying IMAGE_COUNT
# prompts so the in-app slideshow has distinct framings to cycle through.
#
# Requires a database connection for O\*NET task/skill fallback, but every occupation
# that has a narrative generates without one.
class GenerateImagePrompts
  def initialize(connect_to_db: true)
    ImagePrompts.establish_connection if connect_to_db
  end

  def generate_image_prompts(occupation_data, occupation_name, narrative = nil)
    ImagePrompts.build_prompts(occupation_data, occupation_name, narrative)
  end

  def process_all(occupation_codes = nil)
    codes = occupation_codes || ImagePrompts.load_all_occupation_codes
    narratives = ImagePrompts.narrative_index
    results = {}
    from_narrative = 0

    codes.each do |code|
      occupation_data = ImagePrompts.load_occupation_data(code)
      narrative = narratives[code]

      # Prefer the narrative's own name; fall back to O\*NET, then the code.
      name = narrative&.dig('occupation_name') ||
             occupation_data&.dig('OnetTitle') ||
             code

      prompts = generate_image_prompts(
        occupation_data || { 'OnetTitle' => name },
        name,
        narrative
      )

      from_narrative += 1 if narrative

      results[code] = {
        'occupation_name' => name,
        'source' => narrative ? 'narrative' : 'onet',
        'prompts' => prompts
      }
    end

    puts "Prompts built from narratives: #{from_narrative}, from O*NET: #{codes.size - from_narrative}"
    results
  end

  def save_prompts(output_file, occupation_codes = nil)
    results = process_all(occupation_codes)
    File.write(output_file, JSON.pretty_generate(results))
    puts "Saved #{results.size} occupations x #{ImagePrompts::IMAGE_COUNT} prompts to #{output_file}"
    results
  end
end

if __FILE__ == $PROGRAM_NAME
  output = ARGV[0] || File.expand_path('image_prompts.json', __dir__)
  codes = ARGV[1]&.split(',')

  generator = GenerateImagePrompts.new
  generator.save_prompts(output, codes)
end