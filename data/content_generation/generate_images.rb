# frozen_string_literal: true

require 'json'
require 'open3'
require 'active_record'
require 'fileutils'
require 'active_support/inflector'

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
        image_b64 = result['image'] || result['response']
        require 'base64'
        Base64.decode64(image_b64)
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

    access_key = ENV['R2_ACCESS_KEY_ID']
    secret_key = ENV['R2_SECRET_ACCESS_KEY']

    unless access_key && secret_key
      puts "R2 credentials not configured"
      return nil
    end

    bucket_url = @r2_config['bucket_url']
    url = "#{bucket_url}/#{filename}"

    require 'openssl'
    require 'base64'

    date = Time.now.utc.strftime('%Y%m%dT%H%M%SZ')
    date_stamp = Time.now.utc.strftime('%Y%m%d')
    region = 'auto'
    service = 's3'

    payload_hash = Digest::SHA256.hexdigest(image_data)

    canonical_uri = "/#{filename}"
    canonical_querystring = ''
    host = URI.parse(url).host
    canonical_headers = "content-type:image/png\nhost:#{host}\nx-amz-content-sha256:#{payload_hash}\nx-amz-date:#{date}\n"
    signed_headers = 'content-type;host;x-amz-content-sha256;x-amz-date'
    canonical_request = "PUT\n#{canonical_uri}\n#{canonical_querystring}\n#{canonical_headers}\n#{signed_headers}\n#{payload_hash}"
    algorithm = 'AWS4-HMAC-SHA256'
    credential_scope = "#{date_stamp}/#{region}/#{service}/aws4_request"
    string_to_sign = "#{algorithm}\n#{date}\n#{credential_scope}\n#{Digest::SHA256.hexdigest(canonical_request)}"

    k_date = OpenSSL::HMAC.digest('sha256', "AWS4#{secret_key}", date_stamp)
    k_region = OpenSSL::HMAC.digest('sha256', k_date, region)
    k_service = OpenSSL::HMAC.digest('sha256', k_region, service)
    k_signing = OpenSSL::HMAC.digest('sha256', k_service, 'aws4_request')
    signature = OpenSSL::HMAC.hexdigest('sha256', k_signing, string_to_sign)

    authorization_header = "#{algorithm} Credential=#{access_key}/#{credential_scope}, SignedHeaders=#{signed_headers}, Signature=#{signature}"

    temp_file = "/tmp/#{filename}"
    begin
      File.write(temp_file, image_data)
    rescue StandardError => e
      puts "Error writing temp file: #{e.message}"
      return nil
    end

    cmd = [
      'curl', '--silent',
      '-X', 'PUT',
      '-H', 'Content-Type: image/png',
      '-H', "x-amz-date: #{date}",
      '-H', "x-amz-content-sha256: #{payload_hash}",
      '-H', "Authorization: #{authorization_header}",
      '--data-binary', "@#{temp_file}",
      url
    ]

    begin
      stdout, _, status = Open3.capture3(*cmd)
      File.delete(temp_file) if File.exist?(temp_file)
      if status.success?
        url
      else
        puts "Upload failed: #{stdout}"
        nil
      end
    rescue StandardError => e
      puts "Error uploading: #{e.message}"
      File.delete(temp_file) if File.exist?(temp_file)
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

      name = (occupation_data['OnetTitle'] || code).singularize

      prompt = generate_image_prompt(occupation_data, name)

      image_data = generate_with_flux(prompt)

      if image_data
        filename = "#{code.gsub('-', '_')}_#{Time.now.to_i}.png"
        local_path = "/tmp/career_images/#{filename}"
        FileUtils.mkdir_p(File.dirname(local_path))
        File.write(local_path, image_data)

        results[code] = {
          prompt: prompt,
          local_path: local_path,
          image_url: nil
        }
      else
        results[code] = {
          prompt: prompt,
          local_path: nil,
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
