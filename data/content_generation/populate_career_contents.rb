# frozen_string_literal: true

require 'json'
require 'open3'
require 'active_record'

require_relative 'generate_narratives'
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

  def generate_with_llm(prompt)
    cmd = [
      'curl', '--silent',
      '-X', 'POST',
      LLM_URI + '/api/generate',
      '-d', JSON.dump({
        model: LLM_MODEL,
        prompt: prompt,
        stream: false
      })
    ]

    begin
      stdout, _stderr, status = Open3.capture3(*cmd)
      if status.success?
        result = JSON.parse(stdout)
        response = result['response']
        if response.nil? || response.empty?
          response = result['thinking']
        end
        if response
          response = response.strip
          if response.start_with?('```json')
            response = response.sub(/^```json\n?/, '').sub(/\n?```$/, '')
          elsif response.start_with?('```')
            response = response.sub(/^```\n?/, '').sub(/\n?```$/, '')
          end
        end
        response
      else
        nil
      end
    rescue StandardError => e
      puts "LLM error: #{e.message}"
      nil
    end
  end

  def generate_narratives(prompts)
    results = {}

    prompts.each do |code, data|
      puts "Generating narrative for #{code}..."

      summary_result = generate_with_llm(data[:summary_prompt])
      full_result = generate_with_llm(data[:full_prompt])

      results[code] = {
        summary: summary_result || "Failed to generate summary",
        full: full_result || "Failed to generate narrative",
        video_url: data[:video_url] || ''
      }

      sleep(1)
    end

    results
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
  occupation_codes = ARGV.empty? ? nil : ARGV

  puts 'Step 1: Generating narrative prompts from database...'
  narrative_gen = GenerateNarratives.new
  prompts = narrative_gen.process_all(occupation_codes)

  puts 'Step 2: Generating narratives with LLM...'
  populator = PopulateCareerContents.new
  results = populator.generate_narratives(prompts)

  puts 'Step 3: Saving to database...'
  populator.save_to_database(results)

  r2_config = {
    'bucket_url' => ENV['R2_BUCKET_URL']
  }

  flux_model = ENV.fetch('FLUX_MODEL', 'x/flux2-klein:latest')

  puts 'Step 4: Generating career images...'
  image_gen = GenerateImages.new(r2_config, ollama_uri: PopulateCareerContents::LLM_URI, flux_model: flux_model)
  image_results = image_gen.process_all(occupation_codes)

  puts 'Step 5: Saving images to database...'
  populator.save_images_to_database(image_results)

  puts 'Done!'
end
