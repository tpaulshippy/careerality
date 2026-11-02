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
# M5 (see docs/CAREER_IMAGES.md), verifies each one with a vision model, and retries
# with a fresh seed until it passes or the attempt budget is spent.
#
# Files are named <code>_<slot>.png where slot is 1..IMAGE_COUNT. Progress is
# checkpointed to a state file after every image so an interrupted run resumes
# instead of re-generating.
class GenerateImages
  # Built per instance rather than frozen at load time: reading ENV when the file is
  # required means the values are captured once, so anything that sets a variable after
  # the require is silently ignored.
  def self.defaults
    {
      endpoint: ENV['IMAGE_API_URL'] || 'http://127.0.0.1:8777',
      width: Integer(ENV['IMAGE_WIDTH'] || 1024),
      height: Integer(ENV['IMAGE_HEIGHT'] || 576),
      steps: Integer(ENV['IMAGE_STEPS'] || 4),
      verify: ENV['VERIFY_IMAGES'] != 'false',
      max_attempts: Integer(ENV['MAX_ATTEMPTS'] || 3),
      timeout: Integer(ENV['IMAGE_TIMEOUT'] || 300),
      image_count: ENV['IMAGE_COUNT'] ? Integer(ENV['IMAGE_COUNT']) : Pipeline::IMAGE_COUNT,
      # Tailscale routes by hostname, so a request addressed to a bare tailnet IP gets a
      # bare 404 even when the service is healthy. Set IMAGE_API_HOST to the machine's
      # MagicDNS name (and keep IMAGE_API_URL pointed at the IP) whenever the endpoint is
      # not already addressed by name.
      host_header: ENV['IMAGE_API_HOST']
    }
  end

  def initialize(overrides = {})
    config = self.class.defaults.merge(overrides)
    # Normalised into the config itself rather than a separate ivar, so the value
    # reported by config[:endpoint] is the one every request actually uses.
    config[:endpoint] = config[:endpoint].to_s.sub(%r{/+\z}, '')
    @config = config

    validate_config!
  end

  attr_reader :config

  # A verdict is only actionable if `pass` is a real boolean and `issues` is a list.
  # Anything else means the verifier did not actually evaluate the image: `{}`,
  # `{"pass": "yes"}` and `{"pass": true, "issues": "one problem"}` all fail here
  # rather than being read as a rejection or a pass.
  def valid_verdict?(verdict)
    return false unless verdict.is_a?(Hash)
    return false unless [true, false].include?(verdict['pass'])

    issues = verdict.fetch('issues', [])
    issues.is_a?(Array)
  end

  # Whether the model actually produced a verdict.
  #
  # The server sets this itself, outside the JSON schema handed to the vision model, so
  # `verified: true` always means a real answer. It is false when the model's reasoning
  # channel never terminated and it burned its token budget -- which the server reports as
  # `pass: false` with a VERIFIER INCOMPLETE issue.
  #
  # That response must NOT be read as a rejection. A rejection is a finding about the
  # image, and acting on one drops the slot permanently; an incomplete verdict says
  # nothing about the image at all. Conflating the two is how a 30-image trial reported
  # success while 26 images went unchecked.
  #
  # An absent `verified` means an older server that only ever returned real verdicts, or
  # returned HTTP 500 on failure, so it is treated as verified.
  def verdict_produced?(verdict)
    return false unless verdict.is_a?(Hash)

    verdict.fetch('verified', true) != false
  end

  # A zero budget is destructive rather than merely useless. run() deletes any slot
  # whose generation failed, and deletes slots past image_count as stale, so
  # image_count: 0 or max_attempts: 0 would each remove every generated PNG in the
  # output directory while reporting success. Slots above IMAGE_COUNT are never
  # published either: the uploader's parser rejects them, so the work is discarded.
  def validate_config!
    count = @config[:image_count]
    unless count.is_a?(Integer) && count >= 1 && count <= Pipeline::IMAGE_COUNT
      raise ArgumentError,
            "image_count must be an integer in 1..#{Pipeline::IMAGE_COUNT}, got #{count.inspect}. " \
            'Slots above IMAGE_COUNT are never published, and a count of 0 would delete ' \
            'every generated image as stale.'
    end

    attempts = @config[:max_attempts]
    return if attempts.is_a?(Integer) && attempts >= 1

    raise ArgumentError,
          "max_attempts must be a positive integer, got #{attempts.inspect}. " \
          'With no attempts every slot fails immediately and its existing image is deleted.'
  end

  def load_prompts(prompts_file)
    raise "Prompts file not found: #{prompts_file}" unless File.exist?(prompts_file)

    JSON.parse(File.read(prompts_file))
  end

  # --- HTTP -----------------------------------------------------------------

  def health
    get_json('/health')
  end

  # True when the service can actually verify an image right now.
  #
  # /health reports the verifier as e.g. "qwen3-vl:4b (ready)" or "(degraded)". A
  # degraded verifier returns HTTP 500 for every image after ~142s -- including images
  # that verified seconds earlier -- and does not recover on a cooldown or after a
  # generate. That is indistinguishable from a batch that simply has no rejections, so
  # without this gate a multi-day run quietly produces thousands of unverified images.
  #
  # The readiness word is matched as a substring because it is interpolated into a model
  # string we do not control. A model that renamed the state would read as ready rather
  # than as a hard failure.
  def verifier_ready?(info = health)
    return false unless info.is_a?(Hash)
    return false unless info['loaded']

    # A missing or blank verifier field fails closed. Reading it as ready would mean a
    # truncated or older /health payload silently disables the gate.
    verifier = info['verifier'].to_s.strip
    return false if verifier.empty?

    !verifier.include?('degraded')
  end

  # Aborts the batch before any image is generated when the verifier cannot be trusted.
  # Skipped when verification is disabled, since a degraded verifier is then irrelevant.
  def preflight!(info = nil)
    return :skipped unless @config[:verify]

    info ||= health
    return :ok if verifier_ready?(info)

    raise "Verifier is not ready: #{info.inspect}. Refusing to start, because every " \
          'image would be recorded as unverified and the run would look successful. ' \
          'Wait for /health to report the verifier ready, or set VERIFY_IMAGES=false to ' \
          'generate without checking.'
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
    uri = URI.join("#{@config[:endpoint]}/", path.sub(%r{\A/}, ''))
    request = Net::HTTP::Get.new(uri)
    apply_host_header(request)
    response = http_for(uri).start { |http| http.request(request) }
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
    uri = URI.join("#{@config[:endpoint]}/", path.sub(%r{\A/}, ''))
    response = request(uri, body)
    raise "POST #{path} failed: #{response.code} #{response.body.to_s[0, 200]}" unless response.is_a?(Net::HTTPSuccess)

    JSON.parse(response.body)
  end

  def post_bytes(path, body)
    uri = URI.join("#{@config[:endpoint]}/", path.sub(%r{\A/}, ''))
    response = request(uri, body)
    raise "POST #{path} failed: #{response.code} #{response.body.to_s[0, 200]}" unless response.is_a?(Net::HTTPSuccess)

    response.body
  end

  def request(uri, body)
    req = Net::HTTP::Post.new(uri.request_uri, 'Content-Type' => 'application/json')
    req.body = JSON.generate(body)
    apply_host_header(req)
    http_for(uri).start { |http| http.request(req) }
  end

  # Tailscale dispatches on the Host header, so pointing at a tailnet IP without
  # overriding it produces a 404 that looks exactly like an unhealthy service. The
  # header is set explicitly rather than by resolving the name: a host with Funnel
  # enabled has its MagicDNS name resolving to the public Funnel address, which only
  # serves :443.
  def apply_host_header(req)
    host = @config[:host_header]
    req['Host'] = host if host && !host.to_s.strip.empty?

    req
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

    state = JSON.parse(File.read(state_file))
    # A syntactically valid but non-object document (null, [], a string) is as
    # unusable as a parse error: run indexes state with string keys, so returning it
    # would abort the whole run instead of starting clean.
    return {} unless state.is_a?(Hash)

    state
  rescue JSON::ParserError
    {}
  end

  # Written via a temp file and renamed, for the same reason as save_state: a direct
  # write interrupted by a crash or a full disk leaves a truncated PNG on disk, while
  # the prior checkpoint still says the slot is done. The next run would skip it and
  # upload the truncated image, and an Image component cannot recover from partial data.
  def write_image(path, bytes)
    tmp = "#{path}.tmp"
    File.binwrite(tmp, bytes)
    File.rename(tmp, path)
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

  def run(prompts_file, output_dir, state_file:, codes: nil, limit: nil, health: nil)
    prompts = load_prompts(prompts_file)
    FileUtils.mkdir_p(output_dir)

    # Before anything expensive: a batch takes days, and a degraded verifier turns that
    # into days of unverified images. `health` lets a caller that already fetched it
    # avoid a second request.
    puts "Preflight: #{preflight!(health)}"

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

      prompts_for_code = (entry['prompts'] || Array(entry['prompt'])).reject do |p|
        p.to_s.strip.empty?
      end
      occupation = entry['occupation_name'] || code

      if prompts_for_code.empty?
        warn "Skipping #{code}: no usable prompts in entry"
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

      slots = prompts_for_code.first(@config[:image_count]).size

      # The uploader publishes every matching <code>_<slot>.png it finds, so if a
      # previous run generated more slots than this career now has prompts for, the
      # surplus files would stay live and the slideshow would keep showing an image
      # built from a prompt that no longer exists. Drop them before generating.
      stale_slots = (1..Pipeline::IMAGE_COUNT).to_a - (1..slots).to_a
      removed_stale = stale_slots.reject do |stale|
        stale_path = File.join(output_dir, "#{code}_#{stale}.png")
        next true unless File.exist?(stale_path)

        File.delete(stale_path)
        state.delete("#{code}:#{stale}")
        warn "Removed stale #{File.basename(stale_path)}: slot #{stale} has no prompt"
        false
      end
      # Persist immediately: the surviving slots are usually skipped, and the state
      # file is only written after a generation, so the deletion would otherwise be lost.
      save_state(state, state_file) unless removed_stale.empty?

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
          write_image(path, result[:bytes])
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
          # Deliberately not written to disk. Every attempt failed vision
          # verification, so the bytes are known-bad: garbled text, extra fingers, a
          # mangled face. The uploader publishes every <code>_<slot>.png it finds, so
          # writing them would ship exactly the defects the verifier exists to catch,
          # and the slot would then look complete. Leaving the file absent means the
          # client falls back to the legacy image for that slot instead.
          File.delete(path) if File.exist?(path)
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
    last_error = nil

    while attempts < @config[:max_attempts]
      attempts += 1
      seed = self.class.seed_for(code, slot, attempts)

      begin
        bytes = generate(prompt, seed)
      rescue StandardError => e
        # A timeout or a 5xx is usually transient, so it consumes an attempt and the
        # loop retries with a new seed rather than failing the slot outright.
        # MAX_ATTEMPTS is meant to bound the work, not to apply only to rejections.
        last_error = "#{e.class} - #{e.message}"
        warn "  attempt #{attempts} errored: #{last_error}"
        next
      end

      # Recorded as unverified, never as passed: the checkpoint and the summary must
      # not claim an image was checked when verification was switched off.
      return { status: :unverified, bytes: bytes, seed: seed, attempts: attempts, issues: [] } unless @config[:verify]

      verdict = verify(prompt, bytes)
      # A malformed response must not abort the run, and must not be mistaken for a
      # rejection either: retrying a slot because the verifier returned `{}` burns the
      # attempt budget and then records the image as rejected when nothing actually
      # evaluated it. Only a well-formed verdict is acted on.
      unless valid_verdict?(verdict)
        warn "  verifier returned #{verdict.inspect[0, 80]}, treating as unverified"
        return { status: :unverified, bytes: bytes, seed: seed, attempts: attempts, issues: [] }
      end

      issues = verdict['issues'].map(&:to_s)

      # A well-formed response that carries no verdict is an incomplete check, not a
      # finding. Record it as unverified and stop, rather than burning the attempt budget
      # retrying an image nothing has judged.
      unless verdict_produced?(verdict)
        warn "  verifier incomplete: #{issues.first || 'no reason given'}"
        return { status: :unverified, bytes: bytes, seed: seed, attempts: attempts, issues: [] }
      end

      passed = verdict['pass']

      if passed
        return { status: :passed, bytes: bytes, seed: seed, attempts: attempts, issues: [] }
      end

      last = { status: :rejected, bytes: bytes, seed: seed, attempts: attempts, issues: issues }
      warn "  attempt #{attempts} rejected: #{issues.join('; ')}" if issues.any?
    end

    # Nothing usable came back. Prefer the generation error if every attempt failed
    # that way, since a rejection reason would not explain it.
    return { status: :failed, error: last_error } if last.nil? && last_error

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
    puts 'Reaching a tailnet IP also needs IMAGE_API_HOST; a bare 404 usually means that.'
    exit 1
  end

  generator.run(prompts_file, output_dir, state_file: state_file, codes: codes, limit: limit,
                 health: info)
end
