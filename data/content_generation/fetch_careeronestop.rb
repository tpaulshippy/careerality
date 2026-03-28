# frozen_string_literal: true

require 'json'
require 'net/http'
require 'uri'

class FetchCareerOneStop
  BASE_URL = 'https://api.careeronestop.org/v1'

  def initialize(user_id, api_token)
    @user_id = user_id
    @api_token = api_token
  end

  def fetch_occupation_details(occupation_code, location = '0')
    uri = URI("#{BASE_URL}/occupation/#{@user_id}/#{URI.encode_www_form_component(occupation_code)}/#{location}")
    uri.query = URI.encode_www_form({
      tasks: true,
      skills: true,
      videos: true,
      workvalues: true,
      interest: true
    })

    request = Net::HTTP::Get.new(uri)
    request['Authorization'] = "Bearer #{@api_token}"
    request['Accept'] = 'application/json'

    response = Net::HTTP.start(uri.host, uri.port, use_ssl: true) do |http|
      http.request(request)
    end

    if response.is_a?(Net::HTTPSuccess)
      data = JSON.parse(response.body)
      if data['OccupationDetail'] && data['OccupationDetail'].any?
        occupation = data['OccupationDetail'].first
        {
          'OnetTitle' => occupation['OnetTitle'],
          'OnetCode' => occupation['OnetCode'],
          'OnetDescription' => occupation['OnetDescription'],
          'Tasks' => occupation['Tasks'] || [],
          'Skills' => occupation['SkillsDataList'] || [],
          'WorkEnvironment' => [{ 'WorkEnvironment' => occupation['OnetDescription'] || '' }],
          'Video' => occupation['Video'] || [],
          'InterestDataList' => occupation['InterestDataList'] || []
        }
      else
        puts "No occupation found for #{occupation_code}"
        nil
      end
    else
      puts "Error fetching #{occupation_code}: #{response.code} - #{response.body}"
      nil
    end
  rescue StandardError => e
    puts "Error: #{e.message}"
    nil
  end

  def fetch_all_for_occupations(occupation_codes, output_file)
    results = {}

    occupation_codes.each do |code|
      puts "Fetching #{code}..."

      details = fetch_occupation_details(code)
      video_url = nil

      if details && details['Video'] && details['Video'].any?
        video_code = details['Video'].first['VideoCode']
        video_url = "https://www.careeronestop.org/Videos/careeronestop-videos.aspx?videocode=#{video_code}&op=y"
      end

      results[code] = {
        details: details,
        video_url: video_url
      }

      sleep(0.5)
    end

    File.write(output_file, JSON.pretty_generate(results))
    puts "Saved to #{output_file}"
  end
end

if __FILE__ == $PROGRAM_NAME
  user_id = ENV['CAREERONESTOP_USER_ID'] || ARGV[0]
  api_token = ENV['CAREERONESTOP_API_KEY'] || ARGV[1]

  if user_id.nil? || user_id.empty? || api_token.nil? || api_token.empty?
    puts 'Usage: ruby fetch_careeronestop.rb <user_id> <api_token> [output_file]'
    puts '       Or set CAREERONESTOP_USER_ID and CAREERONESTOP_API_KEY environment variables'
    exit 1
  end

  fetcher = FetchCareerOneStop.new(user_id, api_token)

  occupation_codes = %w[
    15-1252.00
    15-1253.00
    15-1254.00
    15-1255.00
    29-1051.00
    29-1071.00
    29-1122.00
    31-1121.00
    33-3021.00
    43-4051.00
  ]

  output = ARGV[2] || File.expand_path('../careeronestop_data.json', __dir__)
  fetcher.fetch_all_for_occupations(occupation_codes, output)
end
