# frozen_string_literal: true

require 'json'
require 'open3'
require 'active_record'

class GenerateImages
  DB_CONFIG = {
    adapter: ENV.fetch('DB_ADAPTER', 'postgresql'),
    database: ENV['DB_NAME'] || ENV['PGDATABASE'] || 'careerality',
    user: ENV['DB_USER'] || ENV['PGUSER'] || 'postgres',
    password: ENV['DB_PASSWORD'] || ENV['PGPASSWORD'] || 'postgres',
    host: ENV['DB_HOST'] || ENV['PGHOST'] || 'localhost'
  }

  def initialize(r2_config = {}, ollama_uri: 'http://localhost:11434', flux_model: 'flux')
    @r2_config = r2_config
    @ollama_uri = ollama_uri
    @flux_model = flux_model
    establish_connection
  end

  def establish_connection
    ActiveRecord::Base.establish_connection(DB_CONFIG)
  end

  def load_occupation_data(occupation_code)
    profile = ActiveRecord::Base.connection.exec_query(
      "SELECT occupation_code, occupation_name, occupation_description, onet_data, skills, tasks, work_activities FROM career_profiles WHERE occupation_code = $1",
      nil,
      [occupation_code]
    ).first

    return nil unless profile

    tasks = profile['tasks']
    tasks = JSON.parse(tasks) if tasks.is_a?(String)

    skills = profile['skills']
    skills = JSON.parse(skills) if skills.is_a?(String)

    work_activities = profile['work_activities']
    work_activities = JSON.parse(work_activities) if work_activities.is_a?(String)

    onet_data = profile['onet_data']
    onet_data = JSON.parse(onet_data) if onet_data.is_a?(String)

    {
      'OnetTitle' => profile['occupation_name'],
      'OnetCode' => profile['occupation_code'],
      'OnetDescription' => profile['occupation_description'],
      'Tasks' => tasks || [],
      'Skills' => skills || [],
      'WorkEnvironment' => [{ 'WorkEnvironment' => profile['occupation_description'] || '' }],
      'InterestDataList' => onet_data&.dig('interests') || []
    }
  end

  def load_all_occupation_codes
    ActiveRecord::Base.connection.exec_query(
      "SELECT occupation_code FROM career_profiles"
    ).map { |row| row['occupation_code'] }
  end

  def generate_image_prompt(occupation_data, occupation_name)
    tasks = occupation_data['Tasks'] || []
    work_context = occupation_data.dig('WorkEnvironment', 0)&.dig('WorkEnvironment') || ''

    task_list = tasks.take(3).map { |t| t.is_a?(Hash) ? t['TaskDescription'] : t }.compact.join(', ')

    prompt = <<~PROMPT
      Professional photograph of a #{occupation_name} at work.
      Scene: #{task_list}
      Setting: #{work_context}
      Style: Natural lighting, candid professional, workplace environment
    PROMPT

    prompt.strip
  end

  def generate_with_flux(prompt)
    puts "Generating image with FLUX at #{@ollama_uri}..."

    cmd = [
      'curl', '--silent',
      '-X', 'POST',
      "#{@ollama_uri}/api/generate",
      '-d', JSON.dump({
                        model: @flux_model,
                        prompt: prompt,
                        stream: false,
                        options: { num_ctx: 2048 }
                      })
    ]

    begin
      stdout, stderr, status = Open3.capture3(*cmd)

      if status.success?
        result = JSON.parse(stdout)
        result['image'] || result['response']
      else
        puts "Error: #{stderr}"
        nil
      end
    rescue StandardError => e
      puts "Error generating image: #{e.message}"
      nil
    end
  end

  def upload_to_r2(image_data, filename)
    return nil unless @r2_config['bucket_url']

    puts 'Uploading to R2...'

    cmd = [
      'curl', '--silent',
      '-X', 'PUT',
      '-H', 'Content-Type: image/png',
      '--data-binary', image_data,
      "#{@r2_config['bucket_url']}/#{filename}"
    ]

    begin
      _, _, status = Open3.capture3(*cmd)
      status.success? ? "#{@r2_config['bucket_url']}/#{filename}" : nil
    rescue StandardError => e
      puts "Error uploading: #{e.message}"
      nil
    end
  end

  def process_all(occupation_codes = nil)
    codes = occupation_codes || load_all_occupation_codes

    results = {}

    codes.each do |code|
      puts "Processing #{code}..."

      occupation_data = load_occupation_data(code)
      unless occupation_data
        puts "No data found for #{code}, skipping"
        next
      end

      name = occupation_data['OnetTitle'] || code

      prompt = generate_image_prompt(occupation_data, name)

      image_data = generate_with_flux(prompt)

      if image_data && @r2_config['bucket_url']
        filename = "#{code.gsub('-', '_')}_#{Time.now.to_i}.png"
        url = upload_to_r2(image_data, filename)

        results[code] = {
          prompt: prompt,
          image_url: url
        }
      else
        if @r2_config['bucket_url'].nil?
          puts "Skipping image storage - R2 not configured"
        end
        results[code] = {
          prompt: prompt,
          image_url: nil
        }
      end

      sleep(1)
    end

    results
  end

  def save_results(output_file, occupation_codes = nil)
    results = process_all(occupation_codes)
    File.write(output_file, JSON.pretty_generate(results))
    puts "Saved results to #{output_file}"
  end
end

if __FILE__ == $PROGRAM_NAME
  output = ARGV[0] || File.expand_path('image_results.json', __dir__)
  codes = ARGV[1]&.split(',') || nil
  ollama_uri = ARGV[2] || 'http://localhost:11434'
  flux_model = ARGV[3] || 'flux'

  r2_config = {
    'bucket_url' => ENV['R2_BUCKET_URL']
  }

  generator = GenerateImages.new(r2_config, ollama_uri: ollama_uri, flux_model: flux_model)
  generator.save_results(output, codes)
end
