# frozen_string_literal: true

require 'json'
require 'open3'

class GenerateImages
  def initialize(api_data_dir, r2_config = {})
    @api_data_dir = api_data_dir
    @r2_config = r2_config
  end

  def load_all_data
    data = {}
    Dir.glob(File.join(@api_data_dir, '*.json')).each do |file|
      code = File.basename(file, '.json').gsub('_', '.')
      data[code] = JSON.parse(File.read(file))
    end
    data
  end

  def generate_image_prompt(occupation_data, occupation_name)
    details = occupation_data['details'] || {}
    tasks = details['Tasks'] || []
    work_env = details.dig('WorkEnvironment', 0) || {}

    task_list = tasks.take(3).map { |t| t['TaskDescription'] }.compact.join(', ')
    work_context = work_env['WorkEnvironment'] || ''

    prompt = <<~PROMPT
      Professional photograph of a #{occupation_name} at work.
      Scene: #{task_list}
      Setting: #{work_context}
      Style: Natural lighting, candid professional, workplace environment
    PROMPT

    prompt.strip
  end

  def generate_with_flux(prompt)
    puts 'Generating image with FLUX.1-schnell...'

    cmd = [
      'curl', '--silent',
      '-X', 'POST',
      'http://localhost:11434/api/generate',
      '-d', JSON.dump({
                        model: 'flux',
                        prompt: prompt,
                        stream: false,
                        options: { num_ctx: 2048 }
                      })
    ]

    begin
      stdout, stderr, status = Open3.capture3(*cmd)

      if status.success?
        result = JSON.parse(stdout)
        result['response']
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
      '-d', image_data,
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

  def process_all
    data = load_all_data

    results = {}

    data.each do |code, occupation_data|
      puts "Processing #{code}..."

      name = occupation_data.dig('details', 'OnetTitle') || code

      prompt = generate_image_prompt(occupation_data, name)

      image_data = generate_with_flux(prompt)

      if image_data
        filename = "#{code.gsub('-', '_')}_#{Time.now.to_i}.png"
        url = upload_to_r2(image_data, filename)

        results[code] = {
          prompt: prompt,
          image_url: url
        }
      else
        results[code] = {
          prompt: prompt,
          image_url: nil
        }
      end

      sleep(1)
    end

    results
  end

  def save_results(output_file)
    results = process_all
    File.write(output_file, JSON.pretty_generate(results))
    puts "Saved results to #{output_file}"
  end
end

if __FILE__ == $PROGRAM_NAME
  data_dir = ARGV[0] || File.expand_path('careers', __dir__)
  output = ARGV[1] || File.expand_path('image_results.json', __dir__)

  r2_config = {
    'bucket_url' => ENV['R2_BUCKET_URL']
  }

  generator = GenerateImages.new(data_dir, r2_config)
  generator.save_results(output)
end
