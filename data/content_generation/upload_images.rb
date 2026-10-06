#!/usr/bin/env ruby

# frozen_string_literal: true

require 'json'
require 'open3'
require 'uri'
require 'openssl'
require 'digest'
require 'fileutils'
require 'tmpdir'
require 'time'
require_relative 'pipeline'

# Uploads generated career images to Cloudflare R2.
#
# Filenames produced by generate_images.rb are <compact_code>_<slot>.png, e.g.
# 111011_2.png. They are published as:
#
#   <code>-<slot>.webp   the slideshow variants (client resolves these by convention)
#   <code>-<slot>.png    full quality original
#   <code>.webp          alias of slot 1, so the single-image consumers
#                        (SwipeCard, MapScreen, CompareScreen) keep working and
#                        show the regenerated image rather than the old one
#
# Uploads are resumable: existence is checked against R2 itself rather than a
# local manifest, so an interrupted run continues instead of re-uploading.
class UploadImages
  # Must stay in step with R2_IMAGE_BASE_URL in
  # client/src/utils/careerImage.ts. Objects published under a different host are
  # invisible to the app, which silently falls back to the legacy image.
  DEFAULT_PUBLIC_URL = 'https://pub-ad3ca2271334487ba26f4bca3ceafebd.r2.dev'

  # Objects are rewritten in place under a stable name, so they must NOT be
  # immutable: a one-year immutable cache means installed clients keep serving the
  # pre-regeneration image long after R2 accepted the replacement. Kept short enough
  # that a client picks up a regenerated photo without a reinstall.
  DEFAULT_CACHE_CONTROL = 'public, max-age=3600'

  # Guard the upload path against a stalled endpoint; the generator sets explicit
  # timeouts for the same reason.
  CONNECT_TIMEOUT = Integer(ENV['R2_CONNECT_TIMEOUT'] || 30)
  MAX_TIME = Integer(ENV['R2_MAX_TIME'] || 300)

  # Objects per slot, in the order they are deleted. The bare legacy aliases exist
  # only for slot 1.
  SLOT_OBJECTS = ['%<code>s-%<slot>d.png', '%<code>s-%<slot>d.webp'].freeze
  SLOT_ALIASES = ['%<code>s.png', '%<code>s.webp'].freeze

  def initialize(bucket_url:, access_key:, secret_key:, public_url: ENV['R2_PUBLIC_URL'] || DEFAULT_PUBLIC_URL)
    uri = URI.parse(bucket_url)
    @bucket_name = uri.path.gsub(%r{^/}, '').split('/').first
    @endpoint_url = "#{uri.scheme}://#{uri.host}"
    @access_key = access_key
    @secret_key = secret_key
    @public_url = public_url.to_s.sub(%r{/+\z}, '')
    @cache_control = ENV['R2_CACHE_CONTROL'] || DEFAULT_CACHE_CONTROL

    return if @public_url == DEFAULT_PUBLIC_URL

    warn "WARNING: R2_PUBLIC_URL is #{@public_url}, but client/src/utils/careerImage.ts " \
         "requests #{DEFAULT_PUBLIC_URL}. Images uploaded now will not be shown by the app."
  end

  # --- R2 signing -----------------------------------------------------------

  def upload_to_r2(image_data, filename, content_type: 'image/png', cache_control: nil)
    cache_control ||= @cache_control
    url = "#{@endpoint_url}/#{@bucket_name}/#{filename}"

    date = Time.now.utc.strftime('%Y%m%dT%H%M%SZ')
    date_stamp = Time.now.utc.strftime('%Y%m%d')
    region = 'auto'
    service = 's3'

    payload_hash = Digest::SHA256.hexdigest(image_data)

    canonical_uri = "/#{@bucket_name}/#{filename}"
    canonical_querystring = ''
    host = URI.parse(url).host
    canonical_headers = "cache-control:#{cache_control}\ncontent-type:#{content_type}\nhost:#{host}\nx-amz-content-sha256:#{payload_hash}\nx-amz-date:#{date}"
    signed_headers = 'cache-control;content-type;host;x-amz-content-sha256;x-amz-date'
    canonical_request = "PUT\n#{canonical_uri}\n#{canonical_querystring}\n#{canonical_headers}\n\n#{signed_headers}\n#{payload_hash}"
    algorithm = 'AWS4-HMAC-SHA256'
    credential_scope = "#{date_stamp}/#{region}/#{service}/aws4_request"
    string_to_sign = "#{algorithm}\n#{date}\n#{credential_scope}\n#{Digest::SHA256.hexdigest(canonical_request)}"

    k_date = OpenSSL::HMAC.digest('sha256', "AWS4#{@secret_key}", date_stamp)
    k_region = OpenSSL::HMAC.digest('sha256', k_date, region)
    k_service = OpenSSL::HMAC.digest('sha256', k_region, service)
    k_signing = OpenSSL::HMAC.digest('sha256', k_service, 'aws4_request')
    signature = OpenSSL::HMAC.hexdigest('sha256', k_signing, string_to_sign)

    authorization_header = "#{algorithm} Credential=#{@access_key}/#{credential_scope}, SignedHeaders=#{signed_headers}, Signature=#{signature}"

    temp_file = File.join(Dir.tmpdir, "upload_#{filename}")
    File.binwrite(temp_file, image_data)

    cmd = [
      'curl', '--silent', '--show-error', '--fail',
      '--connect-timeout', CONNECT_TIMEOUT.to_s,
      '--max-time', MAX_TIME.to_s,
      '-X', 'PUT',
      '-H', "Content-Type: #{content_type}",
      '-H', "Cache-Control: #{cache_control}",
      '-H', "x-amz-date: #{date}",
      '-H', "x-amz-content-sha256: #{payload_hash}",
      '-H', "Authorization: #{authorization_header}",
      '--data-binary', "@#{temp_file}",
      url
    ]

    begin
      _stdout, stderr, status = Open3.capture3(*cmd)
      File.delete(temp_file) if File.exist?(temp_file)
      if status.success?
        "#{@public_url}/#{filename}"
      else
        warn "Upload failed for #{filename}: #{stderr}"
        nil
      end
    rescue StandardError => e
      warn "Error uploading #{filename}: #{e.message}"
      File.delete(temp_file) if File.exist?(temp_file)
      nil
    end
  end

  # Unauthenticated existence check against the public bucket URL. These objects are
  # already served publicly to the app, so this adds no exposure.
  def r2_exists?(filename)
    cmd = ['curl', '--silent', '--show-error', '--head', '--output', '/dev/null',
           '--connect-timeout', CONNECT_TIMEOUT.to_s,
           '--max-time', MAX_TIME.to_s,
           '--write-out', '%{http_code}', "#{@public_url}/#{filename}"]
    code, _stderr, status = Open3.capture3(*cmd)
    return false unless status.success?

    code.strip == '200'
  rescue StandardError
    false
  end

  # --- WebP -----------------------------------------------------------------

  # width: the PNG sources are 1024 wide and the slideshow renders at width:'100%'
  # (~390pt, so ~780-1170 physical px on a 2-3x screen). Downscaling to 600 discarded
  # most of the generation resolution that the 16:9 change was meant to deliver, so the
  # WebP is produced at the source width. R2_WEBP_WIDTH can override it.
  def generate_webp(source_path, max_width: ENV['R2_WEBP_WIDTH'] || 1024, quality: 80)
    webp_path = File.join(Dir.tmpdir, "#{File.basename(source_path, '.*')}.webp")
    cmd = ['cwebp', '-q', quality.to_s, '-resize', max_width.to_s, '0', source_path, '-o', webp_path]
    _stdout, stderr, status = Open3.capture3(*cmd)
    unless status.success?
      warn "cwebp failed for #{source_path}: #{stderr}"
      File.delete(webp_path) if File.exist?(webp_path)
      return nil
    end
    webp_path
  end

  # Deletes an object. Needed when a slot is removed: the client resolves all three
  # slot URLs unconditionally, so a leftover <code>-3.webp keeps serving an image for a
  # prompt that no longer exists. R2 has no directory semantics, so the object has to go
  # explicitly.
  #
  # The signature differs from a PUT only in the method, the payload hash (S3 uses the
  # hash of the empty string) and the omission of cache-control/content-type, which are
  # not sent on a DELETE.
  def delete_from_r2(filename)
    url = "#{@endpoint_url}/#{@bucket_name}/#{filename}"
    date = Time.now.utc.strftime('%Y%m%dT%H%M%SZ')
    date_stamp = Time.now.utc.strftime('%Y%m%d')
    region = 'auto'
    service = 's3'

    payload_hash = Digest::SHA256.hexdigest('')
    host = URI.parse(url).host
    canonical_headers = "host:#{host}\nx-amz-content-sha256:#{payload_hash}\nx-amz-date:#{date}"
    signed_headers = 'host;x-amz-content-sha256;x-amz-date'
    canonical_request = "DELETE\n/#{@bucket_name}/#{filename}\n\n#{canonical_headers}\n\n#{signed_headers}\n#{payload_hash}"
    algorithm = 'AWS4-HMAC-SHA256'
    credential_scope = "#{date_stamp}/#{region}/#{service}/aws4_request"
    string_to_sign = "#{algorithm}\n#{date}\n#{credential_scope}\n#{Digest::SHA256.hexdigest(canonical_request)}"

    k_date = OpenSSL::HMAC.digest('sha256', "AWS4#{@secret_key}", date_stamp)
    k_region = OpenSSL::HMAC.digest('sha256', k_date, region)
    k_service = OpenSSL::HMAC.digest('sha256', k_region, service)
    k_signing = OpenSSL::HMAC.digest('sha256', k_service, 'aws4_request')
    signature = OpenSSL::HMAC.hexdigest('sha256', k_signing, string_to_sign)
    authorization = "#{algorithm} Credential=#{@access_key}/#{credential_scope}, " \
                    "SignedHeaders=#{signed_headers}, Signature=#{signature}"

    cmd = [
      'curl', '--silent', '--show-error',
      '--connect-timeout', CONNECT_TIMEOUT.to_s,
      '--max-time', MAX_TIME.to_s,
      '-X', 'DELETE',
      '-H', "x-amz-date: #{date}",
      '-H', "x-amz-content-sha256: #{payload_hash}",
      '-H', "Authorization: #{authorization}",
      '--write-out', '%{http_code}',
      '--output', '/dev/null',
      url
    ]

    stdout, stderr, status = Open3.capture3(*cmd)
    code = stdout.strip
    # 204 is the S3/R2 success code; 404 means it is already gone, which is the
    # desired end state either way.
    return true if status.success? && %w[200 202 204 404].include?(code)

    warn "Delete failed for #{filename} (HTTP #{code}): #{stderr}"
    false
  end

  # Removes a slot's published objects and its manifest entry. Called when a career has
  # fewer prompts than configured slots, so the old per-slot images do not linger in the
  # slideshow.
  def delete_slot(code, slot, manifest, output_file)
    objects = SLOT_OBJECTS.map { |t| format(t, code: code, slot: slot) }
    objects += SLOT_ALIASES.map { |t| format(t, code: code) } if slot == 1

    deleted = objects.count { |name| delete_from_r2(name) }

    # The manifest entry is only dropped once every object is gone. Removing it while a
    # delete failed would make the slot invisible to the next prune, so the leftover
    # objects would stay live forever with nothing left to retry.
    if deleted == objects.size
      manifest.delete("#{code}:#{slot}")
      save_manifest(manifest, output_file)
    else
      warn "Keeping manifest entry #{code}:#{slot}: only #{deleted}/#{objects.size} objects deleted"
    end

    puts "Removed slot #{slot} for #{code}: deleted #{deleted}/#{objects.size} object(s)"
    deleted == objects.size
  end

  def upload_file(local_path, filename, content_type: 'image/png')
    return nil unless File.exist?(local_path)

    upload_to_r2(File.binread(local_path), filename, content_type: content_type)
  end

  # --- Filename mapping -----------------------------------------------------

  # 111011_2.png -> code "111011", slot 2. Returns nil for anything that is not a
  # generated image, including slots outside the 1..IMAGE_COUNT contract so a stray
  # file cannot create an invalid object or database row.
  def self.parse_filename(filename)
    match = filename.match(/\A(\d{6})_(\d)\.png\z/)
    return nil unless match

    slot = match[2].to_i
    return nil unless Pipeline.slot?(slot)

    { code: match[1], slot: slot }
  end

  def self.soc_code(compact)
    Pipeline.soc(compact)
  end

  # --- Main loop ------------------------------------------------------------

  def process_images_dir(images_dir, output_file)
    manifest = load_manifest(output_file)
    images = Dir.glob(File.join(images_dir, '*.png')).sort
    counts = { png: 0, webp: 0, skipped: 0, failed: 0, repaired: 0, deleted: 0 }

    prune_stale_slots(images_dir, manifest, output_file, counts)

    images.each do |image_path|
      parsed = self.class.parse_filename(File.basename(image_path))
      unless parsed
        counts[:skipped] += 1
        next
      end

      code = parsed[:code]
      slot = parsed[:slot]
      png_key = "#{code}-#{slot}.png"
      webp_key = "#{code}-#{slot}.webp"
      manifest_key = "#{code}:#{slot}"

      puts "Uploading #{code} slot #{slot}..."

      # Deciding on R2 existence alone would make this migration a no-op: the old
      # per-slot objects already exist, so regenerated images would never replace them
      # and the app (which resolves slots first) would keep showing the old photos.
      # Instead the local content's digest is recorded, so identical work is skipped
      # while changed or regenerated images are overwritten.
      digest = Digest::SHA256.hexdigest(File.binread(image_path))
      prior = manifest[manifest_key]
      # Skip only when the canonical object and, for slot 1, both legacy aliases are
      # accounted for. A transient alias failure still records the digest, so without
      # the alias flag every rerun would take the skip path and getImageUrl() would
      # keep serving a stale alias indefinitely.
      aliases_done = slot != 1 || prior.is_a?(Hash) && prior['aliases'] == true

      # A manifest written by an older uploader may hold bare URL strings rather than
      # objects, so every read is guarded on is_a?(Hash). Anything else is treated as
      # unknown and re-uploaded.
      #
      # Skipping requires three things: a matching digest, the slot-1 aliases, and the
      # object still being present. The alias flag matters because a transient alias
      # failure still records the digest, and without it every rerun would take the skip
      # path and getImageUrl() would keep serving a stale alias indefinitely.
      #
      # No manifest write on the skip path: an idempotent re-run touches ~3,000 entries,
      # and rewriting the whole manifest per entry would serialise a multi-hundred-KB
      # file thousands of times for no change.
      if prior.is_a?(Hash) && prior['sha'] == digest && aliases_done
        if r2_exists?(webp_key)
          counts[:skipped] += 1
          next
        end

        # The object was deleted out from under the manifest; re-upload rather than
        # leaving a URL the app would 404 on.
        counts[:repaired] += 1
      end

      png_ok = true
      if upload_file(image_path, png_key)
        counts[:png] += 1
      else
        png_ok = false
        counts[:failed] += 1
      end

      # Slot 1 is republished under the legacy bare filename too, because that is what
      # SwipeCard, MapScreen and CompareScreen request. Gated on png_ok so a failed
      # canonical upload cannot replace a working URL with an unpublished one.
      aliases_ok = slot != 1
      if slot == 1 && png_ok
        aliases_ok = true
        if upload_file(image_path, "#{code}.png")
          counts[:png] += 1
        else
          counts[:failed] += 1
          aliases_ok = false
        end
      end

      # Skip the WebP work entirely when the canonical object did not land, rather than
      # publishing an orphan no manifest entry references.
      unless png_ok
        warn "Skipping WebP for #{code} slot #{slot}: PNG upload failed"
        next
      end

      webp_url = nil
      webp_path = generate_webp(image_path)

      if webp_path.nil?
        counts[:failed] += 1
      else
        if upload_file(webp_path, webp_key, content_type: 'image/webp')
          counts[:webp] += 1
          webp_url = "#{@public_url}/#{webp_key}"
        else
          counts[:failed] += 1
        end

        # Slot 1 legacy alias, for the single-image consumers.
        if slot == 1
          if upload_file(webp_path, "#{code}.webp", content_type: 'image/webp')
            counts[:webp] += 1
          else
            counts[:failed] += 1
            aliases_ok = false
          end
        end

        File.delete(webp_path) if File.exist?(webp_path)
      end

      # Only record the entry once the WebP actually exists, so the manifest and any
      # database update never publish a URL that 404s. The digest is what lets a later
      # run tell "already uploaded this exact image" from "this image was regenerated".
      if png_ok && webp_url
        manifest[manifest_key] = {
          'occupation_code' => self.class.soc_code(code),
          'compact_code' => code,
          'slot' => slot,
          'sha' => digest,
          # Records that both legacy aliases landed, so a rerun retries them rather
          # than skipping on the digest alone.
          'aliases' => aliases_ok,
          'png_url' => "#{@public_url}/#{png_key}",
          'webp_url' => webp_url,
          'uploaded_at' => Time.now.utc.iso8601
        }
        save_manifest(manifest, output_file)
      else
        warn "Not recording #{code} slot #{slot}: upload incomplete (png=#{png_ok} webp=#{!webp_url.nil?})"
      end
    end

    puts "\npng=#{counts[:png]} webp=#{counts[:webp]} already_present=#{counts[:skipped]} " \
         "re_uploaded_missing=#{counts[:repaired]} " \
         "stale_slots_removed=#{counts[:deleted]} failed=#{counts[:failed]}"
    manifest
  end

  # Deletes slots whose image is no longer being produced. The client resolves all
  # IMAGE_COUNT slot URLs unconditionally, so a career dropped from three prompts to two
  # would otherwise keep showing its old third image indefinitely — the generator removes
  # the local file, but R2 has no directory semantics and keeps serving the object.
  #
  # Scoped to codes that are present in this directory but short a slot. That matters:
  # this script is routinely pointed at a subset of careers (a smoke test, or a
  # single regenerated career), and a manifest-wide sweep would delete every other
  # career's live images. A code absent from the directory entirely is never touched,
  # because its absence proves nothing about whether it should still exist.
  def prune_stale_slots(images_dir, manifest, output_file, counts)
    present = {}
    Dir.glob(File.join(images_dir, '*.png')).each do |path|
      parsed = self.class.parse_filename(File.basename(path))
      next unless parsed

      (present[parsed[:code]] ||= []) << parsed[:slot]
    end

    stale = present.flat_map do |code, slots|
      (1..Pipeline::IMAGE_COUNT).to_a.reject { |s| slots.include?(s) }.map { |s| "#{code}:#{s}" }
    end.select { |key| manifest[key].is_a?(Hash) }
    return if stale.empty?

    stale.sort.each do |key|
      code, slot = key.split(':')
      delete_slot(code, slot.to_i, manifest, output_file) ? counts[:deleted] += 1 : counts[:failed] += 1
    end
  end

  def load_manifest(output_file)
    return {} unless File.exist?(output_file)

    JSON.parse(File.read(output_file))
  rescue JSON::ParserError
    {}
  end

  def save_manifest(manifest, output_file)
    # Temp file plus rename, for the same reason as generate_images.rb#save_state: an
    # interrupted in-place write would truncate the JSON and load_manifest would read
    # it as empty, discarding every recorded URL.
    tmp = "#{output_file}.tmp"
    File.write(tmp, JSON.pretty_generate(manifest))
    File.rename(tmp, output_file)
  end

  # Optional. Off by default: the app resolves image URLs by convention, so the
  # career_images table is not on the critical path.
  def save_to_database(manifest)
    require 'active_record'

    ActiveRecord::Base.establish_connection(
      adapter: 'postgresql',
      database: ENV['DB_NAME'] || ENV['PGDATABASE'] || 'careerality',
      user: ENV['DB_USER'] || ENV['PGUSER'] || 'postgres',
      password: ENV['DB_PASSWORD'] || ENV['PGPASSWORD'] || 'postgres',
      host: ENV['DB_HOST'] || ENV['PGHOST'] || 'localhost'
    )

    # A manifest written by the previous uploader holds only image_url strings and
    # has no slot or SOC code, so skip anything that is not a complete per-slot entry
    # rather than inserting NULLs.
    rows = manifest.select do |_, entry|
      entry.is_a?(Hash) && entry['compact_code'] && entry['slot'].is_a?(Integer) && entry['webp_url']
    end

    skipped = manifest.size - rows.size
    warn "Skipping #{skipped} manifest entries without compact_code/slot/webp_url" if skipped.positive?

    rows.each_value do |entry|
      # The compact code is written deliberately: rows created by the previous
      # uploader used it, and the unique index is on (occupation_code, position), so
      # writing the SOC form would never match them and every regenerated career would
      # accumulate a duplicate row. The table is orphaned and off by default; if it is
      # ever revived the old rows need migrating to SOC form in one pass.
      ActiveRecord::Base.connection.exec_insert(
        <<~SQL,
          INSERT INTO career_images (occupation_code, image_url, position, created_at, updated_at)
          VALUES ($1, $2, $3, NOW(), NOW())
          ON CONFLICT (occupation_code, position) DO UPDATE SET
            image_url = EXCLUDED.image_url,
            updated_at = NOW()
        SQL
        nil,
        [entry['compact_code'], entry['webp_url'], entry['slot'] - 1]
      )
    end
    puts "Wrote #{rows.size} rows to career_images"
  end
end

if __FILE__ == $PROGRAM_NAME
  images_dir = ARGV[0] || File.expand_path('generated_images', __dir__)
  output_file = ARGV[1] || File.expand_path('uploaded_images.json', __dir__)

  bucket_url = ENV['R2_BUCKET_URL']
  access_key = ENV['R2_ACCESS_KEY_ID']
  secret_key = ENV['R2_SECRET_ACCESS_KEY']

  unless bucket_url && access_key && secret_key
    puts 'Error: R2_BUCKET_URL, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY must be set'
    exit 1
  end

  unless system('command -v cwebp > /dev/null 2>&1')
    puts "Error: cwebp not found. Install libwebp (e.g. 'brew install webp' or 'apt install webp')."
    exit 1
  end

  # Objects published under a host the app never requests are invisible to it: the
  # client falls back to the legacy image for every career. Refuse rather than upload
  # thousands of unreachable objects.
  configured = (ENV['R2_PUBLIC_URL'] || UploadImages::DEFAULT_PUBLIC_URL).sub(%r{/+\z}, '')
  if configured != UploadImages::DEFAULT_PUBLIC_URL && ENV['ALLOW_PUBLIC_URL_MISMATCH'] != 'true'
    puts "Error: R2_PUBLIC_URL is #{configured}, but the app requests #{UploadImages::DEFAULT_PUBLIC_URL}."
    puts 'Unset R2_PUBLIC_URL, or point the client at the same host with ' \
         'EXPO_PUBLIC_R2_IMAGE_BASE_URL, or set ALLOW_PUBLIC_URL_MISMATCH=true if you ' \
         'really are publishing somewhere the app does not read.'
    exit 1
  end

  uploader = UploadImages.new(bucket_url: bucket_url, access_key: access_key, secret_key: secret_key)
  manifest = uploader.process_images_dir(images_dir, output_file)

  uploader.save_to_database(manifest) if ENV['UPDATE_DB'] == 'true'
end
