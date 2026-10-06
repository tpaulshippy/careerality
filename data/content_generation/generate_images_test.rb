# frozen_string_literal: true

require 'minitest/autorun'
require 'minitest/mock'
require 'tmpdir'
require 'json'
require 'net/http'
require_relative 'generate_images'
require_relative 'upload_images'

# The generator's configuration is entirely environment-driven, and two of those
# knobs are destructive when set wrong. image_count in particular interacts with the
# stale-slot cleanup: any slot beyond image_count is deleted, so a count of 0 would
# remove every generated PNG in the output directory.
#
# Requires stdlib only, so it runs in the data-scripts CI job.
class TestGenerateImagesConfig < Minitest::Test
  def with_env(vars)
    previous = vars.keys.to_h { |k| [k, ENV.fetch(k, nil)] }
    vars.each { |k, v| v.nil? ? ENV.delete(k) : ENV[k] = v }
    yield
  ensure
    previous.each { |k, v| v.nil? ? ENV.delete(k) : ENV[k] = v }
  end

  def test_default_image_count_matches_the_pipeline
    with_env('IMAGE_COUNT' => nil) do
      assert_equal Pipeline::IMAGE_COUNT, GenerateImages.new.config[:image_count]
    end
  end

  # Guards the bug this file exists for: ENV read at load time meant a variable set
  # after the require was silently ignored.
  def test_env_is_read_at_construction_not_load_time
    with_env('IMAGE_COUNT' => '2') do
      assert_equal 2, GenerateImages.new.config[:image_count]
    end
    with_env('IMAGE_COUNT' => '1') do
      assert_equal 1, GenerateImages.new.config[:image_count]
    end
  end

  def test_image_count_of_zero_is_refused
    # Not merely useless: run() deletes every slot beyond image_count, so 0 would
    # wipe the output directory.
    e = assert_raises(ArgumentError) { GenerateImages.new(image_count: 0) }
    assert_match(/delete/, e.message)
  end

  def test_image_count_above_the_slot_contract_is_refused
    # Slot 4 is never published: the uploader's parser only accepts 1..IMAGE_COUNT,
    # so the work would be discarded.
    assert_raises(ArgumentError) { GenerateImages.new(image_count: 4) }
    assert_raises(ArgumentError) { GenerateImages.new(image_count: 99) }
    assert_raises(ArgumentError) { GenerateImages.new(image_count: -1) }
  end

  def test_image_count_must_be_an_integer
    [nil, '3', 1.5, :three].each do |bad|
      assert_raises(ArgumentError, "image_count=#{bad.inspect} should be refused") do
        GenerateImages.new(image_count: bad)
      end
    end
  end

  def test_valid_image_counts_are_accepted
    (1..Pipeline::IMAGE_COUNT).each do |n|
      assert_equal n, GenerateImages.new(image_count: n).config[:image_count]
    end
  end

  def test_invalid_env_image_count_is_refused_rather_than_defaulted
    with_env('IMAGE_COUNT' => '0') do
      assert_raises(ArgumentError) { GenerateImages.new }
    end
    with_env('IMAGE_COUNT' => 'notanumber') do
      assert_raises(ArgumentError) { GenerateImages.new }
    end
  end

  # Same class of bug as image_count: 0 would make every slot fail immediately, and a
  # failed slot has its existing PNG deleted, wiping the output directory.
  def test_zero_max_attempts_is_refused
    e = assert_raises(ArgumentError) { GenerateImages.new(max_attempts: 0) }
    assert_match(/deleted/, e.message)
    assert_raises(ArgumentError) { GenerateImages.new(max_attempts: -5) }
    assert_raises(ArgumentError) { GenerateImages.new(max_attempts: nil) }
    with_env('MAX_ATTEMPTS' => '0') { assert_raises(ArgumentError) { GenerateImages.new } }
  end

  def test_valid_max_attempts_are_accepted
    [1, 3, 5].each { |n| assert_equal n, GenerateImages.new(max_attempts: n).config[:max_attempts] }
  end

  # An unevaluable verdict must not be read as a rejection: that burns the attempt
  # budget and then records the image as rejected when nothing judged it.
  def test_only_well_formed_verdicts_are_acted_on
    g = GenerateImages.new

    assert g.valid_verdict?('pass' => true, 'issues' => [])
    assert g.valid_verdict?('pass' => false, 'issues' => ['extra fingers'])
    assert g.valid_verdict?('pass' => true)
    assert g.valid_verdict?('pass' => false)

    # Missing, non-boolean, or non-list issues: all mean "did not evaluate".
    refute g.valid_verdict?({})
    refute g.valid_verdict?('issues' => ['x'])
    refute g.valid_verdict?('pass' => nil, 'issues' => [])
    refute g.valid_verdict?('pass' => 'yes', 'issues' => [])
    refute g.valid_verdict?('pass' => 1, 'issues' => [])
    refute g.valid_verdict?('pass' => true, 'issues' => 'one problem')
    refute g.valid_verdict?('pass' => true, 'issues' => { 'a' => 1 })
    refute g.valid_verdict?([1, 2, 3])
    refute g.valid_verdict?('nope')
    refute g.valid_verdict?(nil)
  end

  def test_seeds_are_deterministic_per_code_slot_and_attempt
    a = GenerateImages.seed_for('111011', 1, 1)
    assert_equal a, GenerateImages.seed_for('111011', 1, 1)
    refute_equal a, GenerateImages.seed_for('111011', 1, 2)
    refute_equal a, GenerateImages.seed_for('111011', 2, 1)
    refute_equal a, GenerateImages.seed_for('291141', 1, 1)
  end

  # Normalised into config itself, so config[:endpoint] is the URL actually requested
  # rather than a raw value that only looks like it.
  def test_endpoint_trailing_slash_is_normalised
    with_env('IMAGE_API_URL' => 'http://m5.local:8777/') do
      assert_equal 'http://m5.local:8777', GenerateImages.new.config[:endpoint]
    end
    with_env('IMAGE_API_URL' => 'http://m5.local:8777///') do
      assert_equal 'http://m5.local:8777', GenerateImages.new.config[:endpoint]
    end
  end

  def test_verify_defaults_on_and_can_be_disabled
    with_env('VERIFY_IMAGES' => nil) { assert GenerateImages.new.config[:verify] }
    with_env('VERIFY_IMAGES' => 'true') { assert GenerateImages.new.config[:verify] }
    with_env('VERIFY_IMAGES' => 'false') { refute GenerateImages.new.config[:verify] }
  end

  # A syntactically valid but non-object state document is as unusable as a parse
  # error: run indexes it with string keys, so returning it would abort the run.
  def test_load_state_rejects_non_object_documents
    Dir.mktmpdir do |dir|
      path = File.join(dir, 'state.json')

      ['', 'null', '[]', '"text"', '42', 'not json', '{'].each do |body|
        File.write(path, body)
        assert_equal({}, GenerateImages.new.send(:load_state, path), "load_state(#{body.inspect})")
      end

      File.write(path, '{"111011:1":{"status":"passed"}}')
      assert_equal({ '111011:1' => { 'status' => 'passed' } },
                   GenerateImages.new.send(:load_state, path))
    end
  end

  def test_load_state_of_a_missing_file_is_empty
    assert_equal({}, GenerateImages.new.send(:load_state, '/nonexistent/state.json'))
  end

  # A direct write interrupted mid-flight leaves a truncated PNG while the prior
  # checkpoint still reads as done, so the next run would skip and upload it.
  def test_write_image_leaves_no_temp_file_and_replaces_atomically
    Dir.mktmpdir do |dir|
      path = File.join(dir, '111011_1.png')
      gen = GenerateImages.new

      gen.send(:write_image, path, 'first')
      assert_equal 'first', File.read(path)
      refute File.exist?("#{path}.tmp"), 'temp file must not survive'

      gen.send(:write_image, path, 'second')
      assert_equal 'second', File.read(path), 'must replace, not append'
      refute File.exist?("#{path}.tmp")

      assert_equal ['111011_1.png'], Dir.children(dir), "stray files: #{Dir.children(dir)}"
    end
  end

  # A rename is atomic on the same filesystem; the failure mode that matters is a
  # partial write never reaching `path`. Exercises the real write_image by making the
  # underlying write raise, so a regression to a direct write is caught.
  def test_write_image_never_leaves_a_partial_file_at_the_target
    Dir.mktmpdir do |dir|
      path = File.join(dir, 'img.png')
      File.binwrite(path, 'complete-original')

      boom = Class.new(StandardError)
      gen = GenerateImages.new

      # Fail only the write of the new content, leaving the setup write alone.
      original = File.method(:binwrite)
      File.stub(:binwrite, ->(target, bytes) {
        raise boom, 'disk full' if target.to_s.end_with?('.tmp')

        original.call(target, bytes)
      }) do
        assert_raises(boom) { gen.send(:write_image, path, 'x' * 100) }
      end

      assert_equal 'complete-original', File.read(path),
                   'the previous complete file must survive a failed write'
      refute File.exist?("#{path}.tmp"), 'a failed write must not leave its temp file'
    end
  end

  # The happy path, so the atomicity assertion above cannot pass by write_image simply
  # never writing anything.
  def test_write_image_replaces_the_file_completely
    Dir.mktmpdir do |dir|
      path = File.join(dir, 'img.png')
      File.binwrite(path, 'original')

      gen = GenerateImages.new
      gen.send(:write_image, path, 'second')

      assert_equal 'second', File.read(path), 'must replace, not append'
      refute File.exist?("#{path}.tmp"), 'temp file must not survive'
      assert_equal ['img.png'], Dir.children(dir), "stray files: #{Dir.children(dir)}"
    end
  end

  # The PNG sources are 1024 wide and the slideshow renders at width:'100%' on a
  # ~390pt screen, so a 600px WebP discards the resolution the 16:9 change delivers.
  # Tailscale routes on Host, so a request to a tailnet IP without this override gets a
  # 404 that looks like an unhealthy service. The endpoint stays the IP because a host
  # with Funnel enabled resolves its MagicDNS name to the public address.
  def test_host_header_override_is_applied_to_every_request
    with_env('IMAGE_API_HOST' => 'mac.example.ts.net') do
      gen = GenerateImages.new
      assert_equal 'mac.example.ts.net', gen.config[:host_header]

      %w[get post].each do |kind|
        req = kind == 'get' ? Net::HTTP::Get.new('/health') : Net::HTTP::Post.new('/generate')
        gen.send(:apply_host_header, req)
        assert_equal 'mac.example.ts.net', req['Host'], "#{kind} must carry the Host override"
      end
    end
  end

  def test_host_header_is_omitted_when_unset_or_blank
    with_env('IMAGE_API_HOST' => nil) do
      gen = GenerateImages.new
      req = Net::HTTP::Get.new('/health')
      gen.send(:apply_host_header, req)
      assert_nil req['Host'], 'must leave the default Host alone when not configured'
    end

    with_env('IMAGE_API_HOST' => '   ') do
      gen = GenerateImages.new
      req = Net::HTTP::Get.new('/health')
      gen.send(:apply_host_header, req)
      assert_nil req['Host'], 'a blank value must not become an empty Host header'
    end
  end

  def test_webp_is_produced_at_the_source_width
    # Extract the default expression and evaluate it, rather than asserting on source
    # text: the contract is "1024 unless R2_WEBP_WIDTH overrides", and duplicating
    # that logic here would let both sides drift in step.
    source = File.read(File.expand_path('upload_images.rb', __dir__))
    expression = source[/def generate_webp\(source_path,\s*max_width:\s*(.+?),\s*quality:/m, 1]
    refute_nil expression, 'could not find the generate_webp max_width default'

    previous = ENV['R2_WEBP_WIDTH']
    begin
      ENV.delete('R2_WEBP_WIDTH')
      assert_equal 1024, eval(expression) # rubocop:disable Security/Eval

      ENV['R2_WEBP_WIDTH'] = '1536'
      assert_equal '1536', eval(expression) # rubocop:disable Security/Eval
    ensure
      previous.nil? ? ENV.delete('R2_WEBP_WIDTH') : ENV['R2_WEBP_WIDTH'] = previous
    end
  end

  # A manifest written by the previous uploader can map a key straight to a URL string.
  # Every read must be guarded, or the run raises on the first such entry.
  def test_manifest_entries_that_are_not_objects_are_tolerated
    Dir.mktmpdir do |dir|
      File.write(File.join(dir, '111011_1.png'), 'not really a png')

      ['https://old.example/111011-1.webp', 42, nil, ['a'], { 'sha' => 'x' }].each do |entry|
        manifest_path = File.join(dir, 'manifest.json')
        File.write(manifest_path, JSON.generate({ '111011:1' => entry }))

        up = UploadImages.new(bucket_url: 'https://a.r2.cloudflarestorage.com/b',
                              access_key: 'k', secret_key: 's',
                              public_url: UploadImages::DEFAULT_PUBLIC_URL)
        up.define_singleton_method(:r2_exists?) { |_f| true }
        up.define_singleton_method(:upload_file) { |_l, f, **_o| "https://x/#{f}" }
        up.define_singleton_method(:delete_from_r2) { |_f| true }

        # Digesting the stub bytes is fine; the point is that nothing raises.
        assert_silent { up.send(:load_manifest, manifest_path) }
        up.define_singleton_method(:generate_webp) do |src, **_o|
          d = File.join(Dir.tmpdir, File.basename(src, '.*') + '.webp')
          File.binwrite(d, 'RIFF')
          d
        end

        uploaded = []
        up.define_singleton_method(:upload_file) do |_l, f, **_o|
          uploaded << f
          "https://x/#{f}"
        end

        begin
          up.process_images_dir(dir, manifest_path)
          refute_empty uploaded, "entry #{entry.inspect} should be re-uploaded, not skipped"
        rescue StandardError => e
          flunk "entry #{entry.inspect} raised #{e.class}: #{e.message}"
        end
      end
    end
  end

  # A manifest holding valid non-object JSON is as unusable as a parse error: the prune
  # calls key? on it and entries are indexed by string key.
  def test_load_manifest_rejects_non_object_documents
    Dir.mktmpdir do |dir|
      path = File.join(dir, 'uploaded_images.json')

      ['', 'null', '[]', '"text"', '42', 'not json', '['].each do |body|
        File.write(path, body)
        assert_equal({}, UploadImages.new(bucket_url: 'https://a.r2.cloudflarestorage.com/b',
                                          access_key: 'k', secret_key: 's')
                              .send(:load_manifest, path), "load_manifest(#{body.inspect})")
      end

      File.write(path, '{"111011:1":{"sha":"abc"}}')
      assert_equal({ '111011:1' => { 'sha' => 'abc' } },
                   UploadImages.new(bucket_url: 'https://a.r2.cloudflarestorage.com/b',
                                    access_key: 'k', secret_key: 's')
                              .send(:load_manifest, path))
    end
  end

  def test_generated_filenames_are_all_parseable
    # The contract the uploader depends on: every file it sees must map to a slot.
    (1..Pipeline::IMAGE_COUNT).each do |slot|
      name = "111011_#{slot}.png"
      assert_equal({ code: '111011', slot: slot }, UploadImages.parse_filename(name))
    end
  end

end
