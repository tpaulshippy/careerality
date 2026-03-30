#!/usr/bin/env ruby

require 'json'
require 'open3'
require 'uri'
require 'openssl'
require 'digest'
require 'fileutils'

class UploadImages
  def initialize(bucket_url:, access_key:, secret_key:)
    uri = URI.parse(bucket_url)
    @bucket_name = uri.path.gsub(/^\//, '').split('/').first
    @endpoint_url = "#{uri.scheme}://#{uri.host}"
    @access_key = access_key
    @secret_key = secret_key
  end

  def upload_to_r2(image_data, filename)
    url = "#{@endpoint_url}/#{@bucket_name}/#{filename}"

    date = Time.now.utc.strftime('%Y%m%dT%H%M%SZ')
    date_stamp = Time.now.utc.strftime('%Y%m%d')
    region = 'auto'
    service = 's3'

    payload_hash = Digest::SHA256.hexdigest(image_data)

    canonical_uri = "/#{@bucket_name}/#{filename}"
    canonical_querystring = ''
    host = URI.parse(url).host
    canonical_headers = "content-type:image/png\nhost:#{host}\nx-amz-content-sha256:#{payload_hash}\nx-amz-date:#{date}"
    signed_headers = 'content-type;host;x-amz-content-sha256;x-amz-date'
    canonical_request = "PUT\n#{canonical_uri}\n\n#{canonical_headers}\n\n#{signed_headers}\n#{payload_hash}"
    algorithm = 'AWS4-HMAC-SHA256'
    credential_scope = "#{date_stamp}/#{region}/#{service}/aws4_request"
    string_to_sign = "#{algorithm}\n#{date}\n#{credential_scope}\n#{Digest::SHA256.hexdigest(canonical_request)}"

    k_date = OpenSSL::HMAC.digest('sha256', "AWS4#{@secret_key}", date_stamp)
    k_region = OpenSSL::HMAC.digest('sha256', k_date, region)
    k_service = OpenSSL::HMAC.digest('sha256', k_region, service)
    k_signing = OpenSSL::HMAC.digest('sha256', k_service, 'aws4_request')
    signature = OpenSSL::HMAC.hexdigest('sha256', k_signing, string_to_sign)

    authorization_header = "#{algorithm} Credential=#{@access_key}/#{credential_scope}, SignedHeaders=#{signed_headers}, Signature=#{signature}"

    temp_file = "/tmp/upload_#{filename}"
    File.write(temp_file, image_data)

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
      stdout, stderr, status = Open3.capture3(*cmd)
      File.delete(temp_file) if File.exist?(temp_file)
      if status.success? && !stdout.include?('<Error>')
        url
      else
        puts "Upload failed: #{stdout}"
        puts "Stderr: #{stderr}" if stderr
        nil
      end
    rescue StandardError => e
      puts "Error uploading: #{e.message}"
      File.delete(temp_file) if File.exist?(temp_file)
      nil
    end
  end

  def upload_file(local_path, filename)
    return nil unless File.exist?(local_path)

    image_data = File.read(local_path)
    upload_to_r2(image_data, filename)
  end

  def process_images_dir(images_dir, existing_uploaded = {})
    uploaded = {}

    Dir.glob(File.join(images_dir, '*.png')).sort.each do |image_path|
      filename = File.basename(image_path)
      code = filename.gsub('.png', '').gsub('_', '-')

      if existing_uploaded.key?(code) && existing_uploaded[code][:image_url]
        puts "Skipping #{filename}: already uploaded"
        uploaded[code] = existing_uploaded[code]
        next
      end

      puts "Uploading #{filename}..."

      url = upload_file(image_path, filename)

      if url
        uploaded[code] = {
          image_url: url
        }
        puts "  -> #{url}"
      else
        uploaded[code] = {
          image_url: nil
        }
        puts "  -> FAILED"
      end
    end

    uploaded
  end

  def save_results(uploaded, output_file)
    File.write(output_file, JSON.pretty_generate(uploaded))
    puts "Saved uploaded URLs to #{output_file}"
  end

  def save_to_database(uploaded)
    require 'active_record'

    db_config = {
      adapter: 'postgresql',
      database: ENV['DB_NAME'] || ENV['PGDATABASE'] || 'careerality',
      user: ENV['DB_USER'] || ENV['PGUSER'] || 'postgres',
      password: ENV['DB_PASSWORD'] || ENV['PGPASSWORD'] || 'postgres',
      host: ENV['DB_HOST'] || ENV['PGHOST'] || 'localhost'
    }

    ActiveRecord::Base.establish_connection(db_config)

    uploaded.each do |code, data|
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
  images_dir = ARGV[0] || File.expand_path('generated_images', __dir__)
  output_file = ARGV[1] || File.expand_path('uploaded_images.json', __dir__)

  bucket_url = ENV['R2_BUCKET_URL']
  access_key = ENV['R2_ACCESS_KEY_ID']
  secret_key = ENV['R2_SECRET_ACCESS_KEY']

  unless bucket_url && access_key && secret_key
    puts "Error: R2_BUCKET_URL, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY must be set"
    exit 1
  end

  uploader = UploadImages.new(bucket_url: bucket_url, access_key: access_key, secret_key: secret_key)

  existing_uploaded = {}
  if File.exist?(output_file)
    JSON.parse(File.read(output_file)).each do |code, data|
      existing_uploaded[code] = data.is_a?(Hash) ? { image_url: data['image_url'] } : data
    end
  end

  uploaded = uploader.process_images_dir(images_dir, existing_uploaded)
  uploader.save_results(uploaded, output_file)

  if ENV['UPDATE_DB'] == 'true'
    uploader.save_to_database(uploaded)
  end
end
