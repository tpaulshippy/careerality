#!/bin/bash
# Chunked image pipeline: generate -> upload -> discard local PNGs.
#
# Why chunked rather than one big run: a full batch is 3,246 images at ~900KB each,
# so keeping every PNG locally needs ~3GB. Generating a chunk, uploading it, then
# discarding the PNGs keeps disk flat and makes the manifest the durable record.
#
# Chunking also re-runs the verifier pre-flight between chunks (each chunk is a fresh
# generate_images.rb invocation), so a verifier that degrades mid-batch stops the run at
# a chunk boundary instead of silently producing unverified images for hours.
#
# Resume: image_generation_state.json and uploaded_images.json both persist across
# chunks, so an interrupted pipeline continues where it stopped rather than redoing work.
#
# Usage:
#   IMAGE_API_URL=http://100.x.y.z:8777 \
#   IMAGE_API_HOST=your-mac.<tailnet>.ts.net \
#   ./run_pipeline.sh [chunk_size_in_careers]
set -uo pipefail

cd "$(dirname "$0")"

: "${IMAGE_API_URL:?set IMAGE_API_URL to the tailnet IP of your Mac}"
: "${IMAGE_API_HOST:?set IMAGE_API_HOST to the MagicDNS name; a bare IP 404s without it}"

CHUNK="${1:-100}"
WORK="${WORK:-/tmp/career-image-pipeline}"
PROMPTS="$WORK/image_prompts.json"
IMAGES="$WORK/images"
STATE="$WORK/image_generation_state.json"
MANIFEST="$WORK/uploaded_images.json"
LOG="$WORK/pipeline.log"

# Refuse to start a chunk that could fill the disk. Each career is up to 3 PNGs of ~900KB.
MIN_FREE_MB="${MIN_FREE_MB:-1500}"

mkdir -p "$WORK"

log() { echo "[$(date -u +%FT%TZ)] $*" | tee -a "$LOG"; }

step() {
  local name="$1"; shift
  log "START $name"
  if "$@" >>"$LOG" 2>&1; then
    log "OK    $name"
  else
    log "FAIL  $name (exit $?) -- stopping; local PNGs kept for inspection"
    return 1
  fi
}

command -v cwebp >/dev/null || { echo "cwebp not found: apt-get install -y webp" >&2; exit 1; }

log "pipeline start: chunk=$CHUNK careers, work=$WORK"

step "prompts" ruby generate_image_prompts.rb "$PROMPTS" || exit 1

total=$(ruby -rjson -e "puts JSON.parse(File.read('$PROMPTS')).size")
log "$total careers in $PROMPTS"

# Codes in batches of $CHUNK, one per line.
ruby -rjson -e "puts JSON.parse(File.read('$PROMPTS')).keys.sort" \
  | split -l "$CHUNK" - "$WORK/codes-"

chunk_no=0
for codes_file in "$WORK"/codes-*; do
  chunk_no=$(( chunk_no + 1 ))
  codes=$(paste -sd, "$codes_file")
  n=$(wc -l < "$codes_file")

  free_mb=$(df -Pm "$(dirname "$IMAGES")" | awk 'NR==2 {print $4}')
  if [ "$free_mb" -lt "$MIN_FREE_MB" ]; then
    log "SKIP  chunk $chunk_no: only ${free_mb}MB free, need >= ${MIN_FREE_MB}MB"
    exit 1
  fi

  log "chunk $chunk_no/$(( (total + CHUNK - 1) / CHUNK )): $n careers, ${free_mb}MB free"

  mkdir -p "$IMAGES"
  step "generate chunk $chunk_no" \
    ruby generate_images.rb "$PROMPTS" "$IMAGES" "$STATE" "$codes" || exit 1

  made=$(find "$IMAGES" -name '*.png' | wc -l)
  if [ "$made" -eq 0 ]; then
    log "      nothing generated for this chunk"
    continue
  fi

  step "upload chunk $chunk_no" \
    ruby upload_images.rb "$IMAGES" "$MANIFEST" || exit 1

  # Only now that R2 has them. Keeps disk flat across the run.
  find "$IMAGES" -name '*.png' -delete
  log "      uploaded and discarded $made local PNG(s)"
done

log "pipeline complete"
log "  images:      $IMAGES"
log "  manifest:    $MANIFEST"
log "  checkpoint:  $STATE"
if [ -f "$MANIFEST" ]; then
  log "  slots live:  $(ruby -rjson -e "puts (JSON.parse(File.read('$MANIFEST')).size rescue 0)")"
fi
