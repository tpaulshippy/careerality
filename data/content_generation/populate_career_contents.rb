# frozen_string_literal: true

require 'json'
require 'active_record'

class PopulateCareerContents
  def normalize_occupation_code(code)
    return nil if code.nil?

    code = code.to_s.strip
    return nil if code.empty?

    return code if code.include?('.')

    if code.include?('-')
      return "#{code}.00"
    end

    if code.length == 6 && code.match?(/^\d+$/)
      return "#{code[0..1]}-#{code[2..5]}.00"
    end

    nil
  end

  DB_CONFIG = {
    adapter: ENV.fetch('DB_ADAPTER', 'postgresql'),
    database: ENV['DB_NAME'] || ENV['PGDATABASE'] || 'careerality',
    user: ENV['DB_USER'] || ENV['PGUSER'] || 'postgres',
    password: ENV['DB_PASSWORD'] || ENV['PGPASSWORD'] || 'postgres',
    host: ENV['DB_HOST'] || ENV['PGHOST'] || 'localhost',
    port: ENV['DB_PORT'] || ENV['PGPORT'] || 5432
  }.tap do |cfg|
    %i[database user password host port].each do |key|
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
      normalized_code = normalize_occupation_code(code)
      next unless normalized_code

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
        [normalized_code, data[:summary], data[:full], data[:video_url]]
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

  puts 'Done!'
end
