# frozen_string_literal: true

require 'json'
require 'net/http'
require 'uri'

class FetchCareerOneStop
  BASE_URL = 'https://api.careeronestop.org/v1'

  def initialize(api_key)
    @api_key = api_key
  end

  def fetch_occupation_details(occupation_code)
    uri = URI("#{BASE_URL}/occupation/#{occupation_code}")
    uri.query = URI.encode_www_form({ key: @api_key })

    response = Net::HTTP.get_response(uri)

    if response.is_a?(Net::HTTPSuccess)
      JSON.parse(response.body)
    else
      puts "Error fetching #{occupation_code}: #{response.code}"
      nil
    end
  rescue StandardError => e
    puts "Error: #{e.message}"
    nil
  end

  def fetch_video(occupation_code)
    uri = URI("#{BASE_URL}/video/#{occupation_code}")
    uri.query = URI.encode_www_form({ key: @api_key })

    response = Net::HTTP.get_response(uri)

    if response.is_a?(Net::HTTPSuccess)
      data = JSON.parse(response.body)
      data.dig('videos', 0, 'videoUrl')
    end
  rescue StandardError => e
    puts "Error fetching video: #{e.message}"
    nil
  end

  def fetch_all_for_occupations(occupation_codes, output_file)
    results = {}

    occupation_codes.each do |code|
      puts "Fetching #{code}..."

      details = fetch_occupation_details(code)
      video = fetch_video(code)

      results[code] = {
        details: details,
        video_url: video
      }

      sleep(0.5)
    end

    File.write(output_file, JSON.pretty_generate(results))
    puts "Saved to #{output_file}"
  end
end

if __FILE__ == $PROGRAM_NAME
  api_key = ENV['CAREERONESTOP_API_KEY'] || ARGV[0]

  if api_key.nil? || api_key.empty?
    puts 'Usage: ruby fetch_careeronestop.rb <api_key> [output_file]'
    exit 1
  end

  fetcher = FetchCareerOneStop.new(api_key)

  occupation_codes = %w[
    15-1252
    15-1253
    15-1254
    15-1255
    29-1051
    29-1071
    29-1122
    31-1121
    33-3021
    43-4051
  ]

  output = ARGV[1] || 'careeronestop_data.json'
  fetcher.fetch_all_for_occupations(occupation_codes, output)
end
