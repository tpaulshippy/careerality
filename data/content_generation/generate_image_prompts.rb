# frozen_string_literal: true

require_relative 'image_prompts'

# Writes image_prompts.json: one entry per occupation, each carrying IMAGE_COUNT
# prompts so the in-app slideshow has distinct framings to cycle through.
#
# Runs entirely off generated_narratives/ by default. The database is only
# consulted for a career that has no narrative, and only if one is reachable.
class GenerateImagePrompts
  # "111011" -> "11-1011.00". career_profiles stores the SOC form, so a lookup for a
  # compact code has to restore it or the query silently matches nothing.
  def self.soc_code(compact)
    SocCode.soc(compact)
  end

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
    # them needs no database. The database is only consulted for a career with no
    # narrative, to borrow its task text as a fallback.
    codes = occupation_codes || narratives.keys.sort
    if codes.empty?
      raise 'No occupations to build prompts for. Expected narrative JSON files in ' \
            "#{File.expand_path('generated_narratives', __dir__)}; " \
            'pass explicit codes as the second argument to override.'
    end

    results = {}
    from_narrative = 0
    missing_narrative = []
    onet_misses = 0

    codes.each do |raw_code|
      # Normalise once: the narrative index and the output keys are compact codes,
      # while career_profiles is keyed by SOC format.
      code = ImagePrompts.compact_code(raw_code)
      narrative = narratives[code]
      occupation_data = nil

      if narrative
        from_narrative += 1
      else
        missing_narrative << code
        occupation_data = ImagePrompts.load_occupation_data(self.class.soc_code(code))
        onet_misses += 1 if occupation_data.nil?
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

    # onet_misses had no career_profiles row either, so they did not actually reach
    # ONET data and must not be counted with the ones that did.
    from_onet = missing_narrative.size - onet_misses
    puts "Prompts built from narratives: #{from_narrative}, from ONET fallback: #{from_onet}"
    unless missing_narrative.empty?
      puts "  no narrative: #{missing_narrative.first(10).join(', ')}#{missing_narrative.size > 10 ? ' ...' : ''}"
    end
    if onet_misses.positive?
      puts "  #{onet_misses} had no career_profiles row either, so generic copy was used"
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