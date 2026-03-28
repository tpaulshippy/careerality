# frozen_string_literal: true

require 'json'
require 'open3'
require 'active_record'

require_relative 'generate_images'

class PopulateCareerContents
  LLM_MODEL = ENV.fetch('LLM_MODEL', 'llama3.2')
  LLM_URI = ENV.fetch('LLM_URI', 'http://localhost:11434')

  DB_CONFIG = {
    adapter: ENV.fetch('DB_ADAPTER', 'postgresql'),
    database: ENV['DB_NAME'] || ENV['PGDATABASE'] || 'careerality',
    user: ENV['DB_USER'] || ENV['PGUSER'] || 'postgres',
    password: ENV['DB_PASSWORD'] || ENV['PGPASSWORD'] || 'postgres',
    host: ENV['DB_HOST'] || ENV['PGHOST'] || 'localhost'
  }.tap do |cfg|
    %i[database user password host].each do |key|
      value = cfg[key]
      if value.nil? || value.to_s.strip.empty?
        abort "Error: missing database configuration for #{key}. Set the appropriate environment variable (e.g. DB_*/PG*)."
      end
    end
  end

  def initialize
    establish_connection
  end

  def establish_connection
    ActiveRecord::Base.establish_connection(DB_CONFIG)
  end

  def load_narrative_from_file(narratives_dir, code)
    file_path = File.join(narratives_dir, "#{code}.json")
    return nil unless File.exist?(file_path)

    begin
      data = JSON.parse(File.read(file_path))
      {
        summary: data['day_in_life_summary'] || "Failed to generate summary",
        full: data['full_narrative'] || "Failed to generate narrative",
        video_url: data['video_url'] || ''
      }
    rescue StandardError => e
      warn "Error reading narrative file for #{code}: #{e.class} - #{e.message}"
      nil
    end
  end

  def load_narratives_from_directory(narratives_dir, occupation_codes = nil)
    results = {}

    if occupation_codes
      # Load specific occupations
      occupation_codes.each do |code|
        data = load_narrative_from_file(narratives_dir, code)
        results[code] = data if data
      end
    else
      # Load all narratives from directory
      Dir.glob(File.join(narratives_dir, '*.json')).each do |file_path|
        code = File.basename(file_path, '.json')
        data = load_narrative_from_file(narratives_dir, code)
        results[code] = data if data
      end
    end

    results
  end

  def save_to_database(results)
    results.each do |code, data|
      ActiveRecord::Base.connection.exec_insert(
        <<~SQL,
          INSERT INTO career_contents (occupation_code, day_in_life_summary, day_in_life_full, video_url, created_at, updated_at)
          VALUES ($1, $2, $3, $4, NOW(), NOW())
          ON CONFLICT (occupation_code) DO UPDATE SET
            day_in_life_summary = EXCLUDED.day_in_life_summary,
            day_in_life_full = EXCLUDED.day_in_life_full,
            video_url = EXCLUDED.video_url,
            updated_at = NOW()
        SQL
        nil,
        [code, data[:summary], data[:full], data[:video_url]]
      )
    end
  end

  def save_images_to_database(images_results)
    images_results.each do |code, data|
      next unless data[:image_url]

      ActiveRecord::Base.connection.exec_insert(
        <<~SQL,
          INSERT INTO career_images (occupation_code, image_url, prompt_used, position, created_at, updated_at)
          VALUES ($1, $2, $3, 0, NOW(), NOW())
          ON CONFLICT (occupation_code, position) DO UPDATE SET
            image_url = EXCLUDED.image_url,
            prompt_used = EXCLUDED.prompt_used,
            updated_at = NOW()
        SQL
        nil,
        [code, data[:image_url], data[:prompt]]
      )
    end
  end
end

if __FILE__ == $PROGRAM_NAME
  narratives_dir = ARGV[0] || File.expand_path('generated_narratives', __dir__)
  occupation_codes = ARGV[1]&.split(',')

  unless Dir.exist?(narratives_dir)
    abort "Error: narratives directory not found at #{narratives_dir}. Run generate_narratives_with_llm.rb first."
  end

  puts "Step 1: Loading narratives from #{narratives_dir}..."
  populator = PopulateCareerContents.new
  results = populator.load_narratives_from_directory(narratives_dir, occupation_codes)
  puts "Loaded #{results.length} narratives"

  puts 'Step 2: Saving to database...'
  populator.save_to_database(results)

  r2_config = {
    'bucket_url' => ENV['R2_BUCKET_URL']
  }

  flux_model = ENV.fetch('FLUX_MODEL', 'x/flux2-klein:latest')

  puts 'Step 3: Generating career images...'
  image_gen = GenerateImages.new(r2_config, ollama_uri: PopulateCareerContents::LLM_URI, flux_model: flux_model)
  image_results = image_gen.process_all(occupation_codes)

  puts 'Step 4: Saving images to database...'
  populator.save_images_to_database(image_results)

  puts 'Done!'
end
