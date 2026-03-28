# frozen_string_literal: true

require 'json'
require 'active_record'

require_relative 'fetch_careeronestop'
require_relative 'generate_narratives'
require_relative 'generate_images'

class PopulateCareerContents
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
        {
          occupation_code: code,
          day_in_life_summary: data[:summary],
          day_in_life_full: data[:full],
          video_url: data[:video_url]
        }
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
        {
          occupation_code: code,
          image_url: data[:image_url],
          prompt_used: data[:prompt]
        }
      )
    end
  end
end

if __FILE__ == $PROGRAM_NAME
  api_key = ENV['CAREERONESTOP_API_KEY']

  unless api_key
    puts 'Error: Set CAREERONESTOP_API_KEY environment variable'
    exit 1
  end

  puts 'Step 1: Fetching CareerOneStop data...'
  fetcher = FetchCareerOneStop.new(api_key)

  occupation_codes = ARGV.empty? ? [] : ARGV
  if occupation_codes.empty?
    puts 'Usage: ruby populate_career_contents.rb <occupation_code1> [occupation_code2] ...'
    exit 1
  end

  temp_file = 'temp_careeronestop.json'
  fetcher.fetch_all_for_occupations(occupation_codes, temp_file)

  puts 'Step 2: Generating narrative prompts...'
  narrative_gen = GenerateNarratives.new(temp_file)
  prompts = narrative_gen.process_all

  puts 'Step 3: Saving to database...'
  populator = PopulateCareerContents.new

  results = {}
  prompts.each do |code, data|
    results[code] = {
      summary: "[LLM Generated Summary for #{code}]",
      full: "[LLM Generated Full Narrative for #{code}]",
      video_url: data[:video_url] || ''
    }
  end

  populator.save_to_database(results)

  puts 'Done!'

  File.delete(temp_file) if File.exist?(temp_file)
end
