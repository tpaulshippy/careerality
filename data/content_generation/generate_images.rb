# frozen_string_literal: true

require 'json'
require 'net/http'
require 'openssl'
require 'uri'
require 'base64'
require 'fileutils'
require 'digest'
require 'time'
require_relative 'pipeline'

# Generates career images through the Draw Things/mflux HTTP service running on the
# M5 (see IMAGE_GENERATION.md), verifies each one with a vision model, and retries
# with a fresh seed until it passes or the attempt budget is spent.
#
# Files are named <code>_<slot>.png where slot is 1..IMAGE_COUNT. Progress is
# checkpointed to a state file after every image so an interrupted run resumes
# instead of re-generating.
class GenerateImages
  DEFAULTS = {
    endpoint: ENV['IMAGE_API_URL'] || 'http://127.0.0.1:8777',
    width: Integer(ENV['IMAGE_WIDTH'] || 1024),
    height: Integer(ENV['IMAGE_HEIGHT'] || 576),
    steps: Integer(ENV['IMAGE_STEPS'] || 4),
    verify: ENV['VERIFY_IMAGES'] != 'false',
    max_attempts: Integer(ENV['MAX_ATTEMPTS'] || 3),
    timeout: Integer(ENV['IMAGE_TIMEOUT'] || 300),
    image_count: ENV['IMAGE_COUNT'] ? Integer(ENV['IMAGE_COUNT']) : Pipeline::IMAGE_COUNT
  }.freeze

  def initialize(overrides = {})
    @config = DEFAULTS.merge(overrides)
    @endpoint = @config[:endpoint].sub(%r{/+\z}, '')
  end

  attr_reader :config

  def load_prompts(prompts_file)
    raise "Prompts file not found: #{prompts_file}" unless File.exist?(prompts_file)

    JSON.parse(File.read(prompts_file))
  end

  # --- HTTP -----------------------------------------------------------------

  def health
    get_json('/health')
  end

  def generate(prompt, seed)
    body = {
      prompt: prompt,
      width: @config[:width],
      height: @config[:height],
      seed: seed
    }
    body[:steps] = @config[:steps] if @config[:steps]

    post_bytes('/generate', body)
  end

  # Returns the parsed verdict, or nil when verification is unavailable. A nil here
  # means "could not check", which we treat as a pass so a flaky verifier never
  # silently blocks the whole run.
  def verify(prompt, png_bytes)
    body = { prompt: prompt, image_base64: Base64.strict_encode64(png_bytes) }
    post_json('/verify', body)
  rescue StandardError => e
    warn "  verify request failed: #{e.class} - #{e.message}"
    nil
  end

  def get_json(path)
    uri = URI.join("#{@endpoint}/", path.sub(%r{\A/}, ''))
    response = http_for(uri).start { |http| http.request(Net::HTTP::Get.new(uri)) }
    raise "GET #{path} failed: #{response.code}" unless response.is_a?(Net::HTTPSuccess)

    JSON.parse(response.body)
  end

  # The endpoint is usually a Tailscale HTTPS URL, so TLS has to be switched on
  # explicitly; Net::HTTP does not infer it from the URI.
  def http_for(uri)
    http = Net::HTTP.new(uri.hostname, uri.port)
    http.use_ssl = uri.scheme == 'https'
    http.verify_mode = OpenSSL::SSL::VERIFY_PEER if http.use_ssl?
    http.read_timeout = @config[:timeout]
    http.open_timeout = 30
    http
  end

  def post_json(path, body)
    uri = URI.join("#{@endpoint}/", path.sub(%r{\A/}, ''))
    response = request(uri, body)
    raise "POST #{path} failed: #{response.code} #{response.body.to_s[0, 200]}" unless response.is_a?(Net::HTTPSuccess)

    JSON.parse(response.body)
  end

  def post_bytes(path, body)
    uri = URI.join("#{@endpoint}/", path.sub(%r{\A/}, ''))
    response = request(uri, body)
    raise "POST #{path} failed: #{response.code} #{response.body.to_s[0, 200]}" unless response.is_a?(Net::HTTPSuccess)

    response.body
  end

  def request(uri, body)
    req = Net::HTTP::Post.new(uri.request_uri, 'Content-Type' => 'application/json')
    req.body = JSON.generate(body)
    http_for(uri).start { |http| http.request(req) }
  end

  # --- Checkpointing --------------------------------------------------------

  # Seeds are derived from the occupation code and slot so a resumed run produces
  # the same image it would have produced the first time.
  def self.seed_for(code, slot, attempt)
    Digest::SHA256.hexdigest("#{code}:#{slot}:#{attempt}")[0, 8].to_i(16)
  end

  def self.compact_code(code)
    Pipeline.compact(code)
  end

  def load_state(state_file)
    return {} unless File.exist?(state_file)

    JSON.parse(File.read(state_file))
  rescue JSON::ParserError
    {}
  end

  def save_state(state, state_file)
    # Written via a temp file and renamed so an interruption mid-write cannot leave
    # truncated JSON: load_state treats unparseable JSON as empty and would
    # regenerate every image.
    tmp = "#{state_file}.tmp"
    File.write(tmp, JSON.pretty_generate(state))
    File.rename(tmp, state_file)
  end

  # --- Main loop ------------------------------------------------------------

  def run(prompts_file, output_dir, state_file:, codes: nil, limit: nil)
    prompts = load_prompts(prompts_file)
    FileUtils.mkdir_p(output_dir)

    state = load_state(state_file)

    # Normalise every target before the lookup, so the `codes` argument accepts
    # dashed or SOC-formatted codes even when image_prompts.json is keyed compactly.
    targets = (codes || prompts.keys.sort).map { |c| self.class.compact_code(c) }.uniq
    targets = targets.first(limit) if limit

    # Two different input codes can normalise to one compact code (they would then
    # share a filename and a state key, silently overwriting each other). Real data
    # is uniformly XX-XXXX.00 so this should not fire, but never lose an image quietly.
    collisions = {}
    (codes || prompts.keys).each do |raw|
      compact = self.class.compact_code(raw)
      (collisions[compact] ||= []) << raw
    end
    collisions.select { |_, v| v.uniq.size > 1 }.each do |compact, raw_codes|
      warn "COLLISION: #{raw_codes.uniq.join(', ')} all normalise to #{compact}; " \
           'they would overwrite one filename. Keeping the first only.'
    end

    counts = { generated: 0, skipped: 0, passed: 0, rejected: 0, failed: 0, unverified: 0, incomplete: 0, invalid_code: 0 }

    targets.each do |code|
      entry = prompts[code] || prompts.find { |k, _| self.class.compact_code(k) == code }&.last
      unless entry
        warn "Skipping #{code}: not in prompts file"
        next
      end

      prompts_for_code = entry['prompts'] || Array(entry['prompt'])
      occupation = entry['occupation_name'] || code

      if prompts_for_code.compact.empty?
        warn "Skipping #{code}: no prompts in entry"
        next
      end

      # The key came from a JSON file and is used to build a path below, so require a
      # bare 6-digit code. Anything else (notably "../x") would write outside
      # output_dir, so it is refused before any file is created.
      unless code.match?(/\A\d{6}\z/)
        warn "Skipping #{code.inspect}: not a 6-digit occupation code (path safety)"
        counts[:invalid_code] += 1
        next
      end

      if prompts_for_code.size < @config[:image_count]
        warn "#{code} has #{prompts_for_code.size} prompt(s) but #{@config[:image_count]} " \
             'images are configured; its slideshow will be incomplete.'
        counts[:incomplete] += 1
      end

      prompts_for_code.first(@config[:image_count]).each_with_index do |prompt, slot_index|
        slot = slot_index + 1
        filename = "#{code}_#{slot}.png"
        path = File.join(output_dir, filename)
        key = "#{code}:#{slot}"

        # Resume: a prior entry counts as done unless it failed, or its prompt has
        # changed. Regenerating a narrative and re-running must not silently keep
        # publishing the image built from the old wording.
        prior = state[key]
        terminal = prior && prior['status'] != 'failed'
        terminal &&= prior['status'] != 'unverified' || !@config[:verify]
        terminal &&= prior['prompt'] == prompt

        if File.exist?(path) && terminal
          counts[:skipped] += 1
          next
        end

        print "Generating #{occupation} [#{slot}/#{@config[:image_count]}] #{code}... "
        result = generate_with_verification(code, slot, prompt, occupation)

        case result[:status]
        when :passed, :unverified
          File.binwrite(path, result[:bytes])
          counts[:generated] += 1
          counts[result[:status]] += 1
          state[key] = {
            'occupation_code' => code,
            'occupation_name' => occupation,
            'slot' => slot,
            'seed' => result[:seed],
            'attempts' => result[:attempts],
            'status' => result[:status].to_s,
            'issues' => result[:issues],
            'prompt' => prompt
          }
          puts "#{result[:status]} after #{result[:attempts]} attempt(s) #{result[:seed]}"
        when :rejected
          File.binwrite(path, result[:bytes])
          counts[:generated] += 1
          counts[:rejected] += 1
          state[key] = {
            'occupation_code' => code,
            'occupation_name' => occupation,
            'slot' => slot,
            'seed' => result[:seed],
            'attempts' => result[:attempts],
            'status' => 'rejected',
            'issues' => result[:issues],
            'prompt' => prompt
          }
          puts "REJECTED after #{result[:attempts]} attempt(s): #{result[:issues].join('; ')}"
        else
          counts[:failed] += 1
          # A PNG from an earlier run must not be left behind: the uploader reads
          # every matching file and would publish it for this slot.
          File.delete(path) if File.exist?(path)
          state[key] = { 'occupation_code' => code, 'slot' => slot, 'status' => 'failed', 'error' => result[:error] }
          puts "FAILED: #{result[:error]}"
        end

        save_state(state, state_file)
      end
    end

    puts
    puts "Done. generated=#{counts[:generated]} skipped=#{counts[:skipped]} " \
         "verified=#{counts[:passed]} unverified=#{counts[:unverified]} " \
         "rejected=#{counts[:rejected]} failed=#{counts[:failed]} " \
         "incomplete_careers=#{counts[:incomplete]} " \
         "invalid_codes=#{counts[:invalid_code]}"
    puts "State: #{state_file}"
    state
  end

  # Returns the first attempt that passes verification, or the best-effort image
  # once attempts run out. Never raises for a single image failure.
  def generate_with_verification(code, slot, prompt, occupation)
    attempts = 0
    last = nil

    while attempts < @config[:max_attempts]
      attempts += 1
      seed = self.class.seed_for(code, slot, attempts)

      begin
        bytes = generate(prompt, seed)
      rescue StandardError => e
        return { status: :failed, error: "#{e.class} - #{e.message}" }
      end

      # Recorded as unverified, never as passed: the checkpoint and the summary must
      # not claim an image was checked when verification was switched off.
      return { status: :unverified, bytes: bytes, seed: seed, attempts: attempts, issues: [] } unless @config[:verify]

      verdict = verify(prompt, bytes)
      # A malformed response must not abort the run; treat it as "could not check",
      # exactly like an unreachable verifier.
      unless verdict.is_a?(Hash)
        warn "  verifier returned #{verdict.class}, treating as unverified"
        return { status: :unverified, bytes: bytes, seed: seed, attempts: attempts, issues: [] }
      end

      issues = Array(verdict['issues']).map(&:to_s)
      passed = verdict['pass'] == true

      if passed
        return { status: :passed, bytes: bytes, seed: seed, attempts: attempts, issues: [] }
      end

      last = { status: :rejected, bytes: bytes, seed: seed, attempts: attempts, issues: issues }
      warn "  attempt #{attempts} rejected: #{issues.join('; ')}" if issues.any?
    end

    last || { status: :failed, error: 'no attempts made' }
  end
end

if __FILE__ == $PROGRAM_NAME
  prompts_file = ARGV[0] || File.expand_path('image_prompts.json', __dir__)
  output_dir = ARGV[1] || File.expand_path('generated_images', __dir__)
  state_file = ARGV[2] || File.expand_path('image_generation_state.json', __dir__)
  codes = ARGV[3]&.split(',')
  limit = ARGV[4]&.to_i

  generator = GenerateImages.new

  begin
    info = generator.health
    puts "Image API: #{info.inspect}"
  rescue StandardError => e
    puts "Error: cannot reach image API at #{generator.config[:endpoint]} (#{e.message})"
    puts 'See docs/CAREER_IMAGES.md for setup, or set IMAGE_API_URL to your tailnet URL.'
    exit 1
  end

  generator.run(prompts_file, output_dir, state_file: state_file, codes: codes, limit: limit)
end
