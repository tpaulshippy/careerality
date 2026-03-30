# frozen_string_literal: true

require 'json'
require 'open3'
require 'fileutils'
require 'base64'

class GenerateImagesWithLLM
  def initialize(ollama_uri: 'http://localhost:11434', flux_model: 'flux')
    @ollama_uri = ollama_uri
    @flux_model = flux_model
  end

  def load_prompts(prompts_file)
    unless File.exist?(prompts_file)
      raise "Prompts file not found: #{prompts_file}"
    end

    JSON.parse(File.read(prompts_file))
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

  def save_results(prompts_file, output_dir)
    prompts_data = load_prompts(prompts_file)

    FileUtils.mkdir_p(output_dir)

    count = 0
    skipped = 0
    errors = 0

    prompts_data.each do |code, prompt_info|
      filename = "#{code.gsub('-', '_')}.png"
      file_path = File.join(output_dir, filename)

      if File.exist?(file_path)
        puts "Skipping #{code}: image already exists"
        skipped += 1
        next
      end

      puts "Generating image for #{code}..."

      prompt = prompt_info['prompt']
      occupation_name = prompt_info['occupation_name'] || code

      unless prompt
        puts "Skipping #{code}: missing prompt"
        next
      end

      begin
        image_data = generate_with_flux(prompt)

        if image_data
          File.write(file_path, image_data)
          puts "Saved #{code} to #{file_path}"
          count += 1
        else
          warn "Skipping #{code}: generation failed"
          errors += 1
        end
      rescue StandardError => e
        warn "Error processing #{code}: #{e.class} - #{e.message}"
        errors += 1
      end

      sleep(1)
    end

    puts "Saved images for #{count} occupations to #{output_dir}" +
         (skipped > 0 ? " (#{skipped} skipped)" : "") +
         (errors > 0 ? " (#{errors} errors)" : "")
  end
end

if __FILE__ == $PROGRAM_NAME
  prompts_file = ARGV[0] || File.expand_path('image_prompts.json', __dir__)
  output_dir = ARGV[1] || File.expand_path('generated_images', __dir__)
  ollama_uri = ARGV[2] || ENV['OLLAMA_URI'] || 'http://localhost:11434'
  flux_model = ARGV[3] || ENV['FLUX_MODEL'] || 'flux'

  generator = GenerateImagesWithLLM.new(ollama_uri: ollama_uri, flux_model: flux_model)
  generator.save_results(prompts_file, output_dir)
end
