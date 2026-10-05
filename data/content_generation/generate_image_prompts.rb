# frozen_string_literal: true

require_relative 'image_prompts'

# Writes image_prompts.json: one entry per occupation, each carrying IMAGE_COUNT
# prompts so the in-app slideshow has distinct framings to cycle through.
#
# Runs entirely off generated_narratives/ by default. The database is only
# touched for a career with no narrative, and only if one is reachable.
class GenerateImagePrompts
  def initialize(connect_to_db: true)
    ImagePrompts.establish_connection if connect_to_db
  end

  def generate_image_prompts(occupation_data, occupation_name, narrative = nil)
    ImagePrompts.build_prompts(occupation_data, occupation_name, narrative)
  end

  def process_all(occupation_codes = nil)
    narratives = ImagePrompts.narrative_index
    # Default to the narratives: they are the prompt source, they are keyed by the
    # compact 6-digit code the generation and upload scripts expect, and reading
    # them needs no database. The DB is only consulted for a career that has no
    # narrative, to borrow its O*NET task text.
    codes = occupation_codes || narratives.keys.sort
    results = {}
    from_narrative = 0
    missing_narrative = []

    codes.each do |code|
      narrative = narratives[code]
      occupation_data = nil

      if narrative
        from_narrative += 1
      else
        missing_narrative << code
        occupation_data = ImagePrompts.load_occupation_data(code)
      end

      name = narrative&.dig('occupation_name') ||
             occupation_data&.dig('OnetTitle') ||
             code

      results[code] = {
        'occupation_name' => name,
        'source' => narrative ? 'narrative' : 'onet',
        'prompts' => generate_image_prompts(
          occupation_data || { 'OnetTitle' => name },
          name,
          narrative
        )
      }
    end

    puts "Prompts built from narratives: #{from_narrative}, from O*NET: #{missing_narrative.size}"
    unless missing_narrative.empty?
      puts "  no narrative (needs career_profiles): #{missing_narrative.first(10).join(', ')}"
    end
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