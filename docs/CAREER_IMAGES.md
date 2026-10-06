# Career Image Generation

Generates 3 images per career (for the in-app slideshow) and uploads them to Cloudflare R2.

Everything runs locally on an Apple Silicon Mac at **$0** — no API keys, no per-image cost.

---

## How it works

```
generate_narratives.rb ──────► narrative_prompts.json
generate_narratives_with_llm ► generated_narratives/*.json   (1082 careers)
                               ↑ NOT in git — produced by the step below
        │
        ▼
generate_image_prompts.rb ──► image_prompts.json   3 prompts per career
        │
        ▼
generate_images.rb ──────────► M5 image API (Tailscale)   /generate  → PNG
                              M5 vision API (Tailscale)   /verify    → pass/fail
        │                     └─ on reject: reseed and retry
        ▼
generated_images/<code>_<slot>.png
        │
        ▼
upload_images.rb ────────────► R2  <code>-<slot>.webp  (+ .png, + <code>.webp alias)
```

### Why prompts come from narratives

The previous prompts were built from O\*NET task strings. 251 of them rendered as
literally `Scene: .` / `Environment: .` and still produced an uploaded image, and all
1,082 prompts shared a single identical style suffix — which is why the old set looks
like interchangeable stock photography.

Prompts are now built from the day-in-the-life narratives, which describe real
sensory detail ("a quiet, glass-walled corner office with the hum of the city
outside"). With a full narrative set generated (all 1,082 careers) there is no
empty-prompt case left to fall back from; a missing narrative instead reaches the
O\*NET fallback described under step 2. Each career gets 3 different framings — wide
establishing, over-the-shoulder, close detail — so the slideshow reads as a sequence.

### URL convention (no database required)

The app resolves image URLs by convention, so no migration or API change is needed:

| Object | Consumer |
|---|---|
| `<code>-1.webp`, `-2`, `-3` | slideshow in `CareerDetailView` |
| `<code>.webp` | single-image consumers: `SwipeCard`, `MapScreen`, `CompareScreen`, `SearchScreen`, `ActionPlansScreen` |

`<code>` is the compact 6-digit SOC code: `11-1011.00` → `111011`.

`getImageUrls()` returns the three slots followed by the legacy bare filename. The app
tries each in turn and falls through on load failure, so careers that have not been
regenerated yet still render. The legacy object is shown **only** when no slot loads —
it duplicates slot 1 for a regenerated career, so it is never a step in the rotation.
`getImageUrl()` is unchanged for the single-image consumers.

Slot 1 is republished as `<code>.png` too, for any consumer that still wants the PNG.

---

## One-time setup on your Mac

Run the setup prompt from the PR description on the M5. It installs `mflux`, downloads
FLUX.2 [klein] 4B and a small vision model, writes `~/mflux-api/server.py`, registers a
launchd agent, and exposes it to your tailnet with `tailscale serve`.

It exposes three endpoints:

| Endpoint | Purpose |
|---|---|
| `GET /health` | liveness + which models are loaded |
| `POST /generate` | `{prompt, width, height, seed}` → `image/png` |
| `POST /verify` | `{prompt, image_base64}` → `{pass, issues[], notes}` |

Record the tailnet URL it prints. That is the only value you need to export.

### Licensing

Only **FLUX.2 [klein] 4B** may be used. It is Apache 2.0, so images can ship in a
commercial app. The **9B** variants are under the FLUX Non-Commercial License and must
not be downloaded or used.

---

## Running it

### Step 0: generate the narratives (once, or when a narrative changes)

`generated_narratives/` is **not in git** — it is a generated input, listed in
`.gitignore` alongside the other build artefacts. On a fresh checkout the directory is
absent and step 2 below fails with `No occupations to build prompts for`, because the
career list comes only from that directory.

The narratives are written by an LLM, not by this pipeline. They need a running Ollama
server, which is where the cost of this step goes:

```bash
cd data/content_generation

# 1a. Build narrative prompts from the database (career_profiles + onet_tasks).
ruby generate_narratives.rb                 # writes narrative_prompts.json

# 1b. Turn those prompts into narrative JSON via Ollama. ~1,082 calls, so this
#     takes a while; it skips codes that already have a file.
ollama pull llama3.2
ruby generate_narratives_with_llm.rb        # writes generated_narratives/*.json
```

Only needed once, or when you rewrite a narrative — `generate_image_prompts.rb` reads
whatever is already there. If you skip it entirely, set `USE_DB=true` on step 2 so careers
without a narrative reach the O\*NET fallback instead of being omitted.

### Steps 1-3

```bash
cd data/content_generation

# 1. Point at your Mac (from the setup step).
#
#    Address the tailnet IP and set IMAGE_API_HOST to the MagicDNS name. Tailscale
#    routes by Host header, so an IP-addressed request without the header gets a bare
#    404 even when the service is healthy — it reads as "the server is down" and costs a
#    lot of time. Do NOT resolve the MagicDNS name instead: if the Mac has Funnel
#    enabled on :443, MagicDNS returns the public Funnel address, which only serves 443.
export IMAGE_API_URL=http://100.x.y.z:8777
export IMAGE_API_HOST=your-mac.<tailnet>.ts.net

# 2. Build prompts  (writes image_prompts.json). Reads generated_narratives/ and
#    needs no database.
ruby generate_image_prompts.rb

# 3. Generate + verify
ruby generate_images.rb
```

A database is only required for a career with **no** narrative, where the O\*NET task
text is borrowed as a fallback. All 1,082 current careers have narratives.

That fallback has a gap worth knowing: by default the run covers only the careers it can
read a narrative for, so a career missing one is silently omitted rather than reaching
the O\*NET branch. `USE_DB=true` unions `career_profiles` into the code list and enables
the fallback; if the database is unreachable the run degrades to generic copy rather than
failing.

`generate_images.rb` takes optional positional args:

```
ruby generate_images.rb [prompts_file] [output_dir] [state_file] [codes] [limit]
```

Useful during setup:

```bash
# Smoke test: 3 careers, 9 images. `print`, not `p`: `p` would emit the quoted
# string and the quotes would become part of the codes.
ruby generate_images.rb image_prompts.json /tmp/smoke /tmp/smoke-state.json "$( \
  ruby -rjson -e 'print JSON.parse(File.read("image_prompts.json")).keys.first(3).join(",")')" 3

# Skip verification entirely
VERIFY_IMAGES=false ruby generate_images.rb

# More retries before giving up on an image
MAX_ATTEMPTS=5 ruby generate_images.rb
```

A rejected image is **not written to disk** — the verifier flagged it, so the bytes are
known-bad, and the uploader publishes every file it finds. That slot keeps no PNG, so the
client falls back to the legacy image for it instead of showing the defect.

A rejection is recorded as terminal, so raising `MAX_ATTEMPTS` and re-running will **not**
retry it. To re-roll a rejected slot, delete its entry from the state file first:

```bash
ruby -rjson -e '
path = "image_generation_state.json"
s = JSON.parse(File.read(path))
before = s.size
s.reject! { |_, v| v["status"] == "rejected" }
File.write(path, JSON.pretty_generate(s))
puts "cleared #{before - s.size} rejected slot(s)"'
```

`VERIFY_IMAGES=false` records images as `unverified`, never `passed`. A later run with
verification enabled regenerates those slots instead of trusting an unchecked entry.

`IMAGE_COUNT` may only be `1..3`. Higher values are refused because the uploader's
parser accepts no slot above `3`, so the extra work would never be published; `0` is
refused because the generator deletes any slot beyond the configured count as stale, so
it would remove every generated PNG. Defaults to `3`.

`MAX_ATTEMPTS` must be at least `1`, for the same reason: with no attempts every slot
fails immediately, and a failed slot has its existing PNG deleted.

A verifier response is only acted on if `pass` is a boolean and `issues` is a list.
Anything else — `{}`, `{"pass": "yes"}`, `{"pass": true, "issues": "..."}` — is recorded
as `unverified` rather than retried, because a response the verifier did not actually
produce must not be read as a rejection.

### Generator environment variables

| Variable | Default | Notes |
|---|---|---|
| `IMAGE_API_URL` | `http://127.0.0.1:8777` | the mflux service on the M5. Address the **tailnet IP**, not the MagicDNS name — see below |
| `IMAGE_API_HOST` | unset | **required whenever `IMAGE_API_URL` is a tailnet IP.** Tailscale dispatches on the `Host` header, so without this every request gets a bare 404 that looks exactly like an unhealthy service |
| `IMAGE_WIDTH` / `IMAGE_HEIGHT` | `1024` / `576` | 16:9, matching the ~1.95:1 slideshow viewport instead of the old 600×600 square. The client still crops with `resizeMode="cover"`, and the WebP is produced at the full 1024 width (override with `R2_WEBP_WIDTH`) |
| `IMAGE_STEPS` | `4` | distilled `klein 4B`; `50` for the Base model — see the quality knob below |
| `IMAGE_TIMEOUT` | `300` | seconds to wait for one `/generate` or `/verify` response. **Raise it for `IMAGE_STEPS=50`**, which can exceed 300s on a cold start; because seeds are deterministic, a timeout fails identically on every retry. The connect timeout is a separate hardcoded 30s |
| `MAX_ATTEMPTS` | `3` | attempts per slot; must be ≥ 1. Covers rejections *and* generation errors |
| `VERIFY_IMAGES` | `true` | `false` skips verification and records `unverified` |
| `IMAGE_COUNT` | `3` | slots per career; must be `1..3` |

### Resumability

Progress is written to `image_generation_state.json` after every image. Re-running skips
`passed` and `rejected` slots and retries `failed` ones. `unverified` slots are the
exception: they are regenerated when verification is enabled, because an entry recorded
with verification switched off was never actually checked. A slot is also regenerated when
its prompt text has changed, so editing a narrative and re-running replaces the images
built from the old wording.

Seeds are derived deterministically from `occupation_code`, `slot` and `attempt`, so a
resumed run reproduces the same images it would have produced the first time. The flip side
is that a failure caused by the environment rather than the prompt — a timeout, most
commonly — reproduces identically on every attempt, so raising `IMAGE_TIMEOUT` is needed
for those; changing `IMAGE_STEPS` or the endpoint will not help on their own.

Interrupt with Ctrl-C at any time; just run the same command again to continue.

### ⚠️ Verifier reliability — check before a full run

`GET /health` reports the verifier as `qwen3-vl:4b (ready)` or `(degraded)`. **While
degraded, every `/verify` returns HTTP 500 after ~142s** — including images that verified
seconds earlier — and it does not recover on a five-minute cooldown or after a
`/generate`. It has been observed to come back on its own after longer.

`generate_images.rb` therefore runs a **pre-flight check** and refuses to start when the
verifier is not ready, because a degraded verifier records every image as `unverified` and
the run still reports success:

```
$ ruby generate_images.rb
Image API: {"status"=>"ok", ..., "verifier"=>"qwen3-vl:4b (degraded)", "loaded"=>true}
Preflight: Verifier is not ready: ... Refusing to start, ...
```

Pass `VERIFY_IMAGES=false` to bypass it and generate without checking. To check by hand:

```bash
curl -fsS -H "Host: your-mac.<tailnet>.ts.net" http://100.x.y.z:8777/health \
  | python3 -c 'import json,sys; d=json.load(sys.stdin); sys.exit(0 if d["loaded"] and "degraded" not in d["verifier"] else 1)' \
  || { echo "verifier degraded - refusing to start batch"; exit 1; }
```

The pre-flight only covers the *start* of a batch. Degradation mid-run is still recorded
as `unverified` per image, so **watch the summary** — if it is mostly `unverified`, stop and
re-check `/health` rather than letting a multi-day run continue unchecked.

A full batch is 3,246 images. At the measured ~21s per `/generate` and ~9–30s per healthy
`/verify` that is roughly 2–3 days of continuous generation on one machine.

### Verifier behaviour

`/verify` returns `pass` plus a list of issues. On rejection the generator **reseeds and
retries** (default 3 attempts). If every attempt is rejected, the reasons are recorded in
the state file and **no PNG is written** — the last attempt's bytes are known-bad, so
keeping them would publish the exact defects the verifier exists to catch. The slot stays
empty and the client falls back to the legacy image for it.

If the verifier is unreachable the image is accepted and marked `unverified` — a flaky
verifier never blocks the run.

**The verifier only catches defects the prompt does not itself sanction.** It checks the
image against the intended prompt, so a prompt that asks for a crowd gets a crowd approved.
The first version of slot 1 asked to "show the whole room and the people around them" and
produced a populated boardroom that verified clean. Every shot now constrains the frame to
exactly one person, and `image_prompts_test.rb` asserts it.

**Expect the verifier to be strict, and to be weak at fine hand anatomy.** It reliably
catches garbled text, melted background faces, wrong subjects and illustration-instead-of-
photo. It will not reliably count fingers. Grep the state file to review rejections:

```bash
ruby -rjson -e '
JSON.parse(File.read("image_generation_state.json")).each_value { |v|
  puts "#{v["occupation_code"]} ##{v["slot"]}: #{v["issues"].join(", ")}" if v["issues"]&.any?
}' | sort | uniq -c | sort -rn | head -30
```

A single issue type dominating the list means the prompt needs work, not the model.

---

## Quality knob: steps

`klein 4B` as used above is the **4-step distilled** model. That is why hands smear and
text turns to gibberish. The undistilled `klein 4B Base` is the same Apache 2.0 licence,
runs 50 steps, and is markedly cleaner — at roughly 10x the time.

Compare on a sample before committing to all ~3,200 images:

```bash
IMAGE_STEPS=50 IMAGE_TIMEOUT=1800 ruby generate_images.rb \
  image_prompts.json /tmp/base50 /tmp/base50-state.json 11-1011,29-1141,33-3011
```

`IMAGE_TIMEOUT` matters here. The generator's read timeout defaults to **300 seconds**,
which the 50-step model will exceed on a cold start; because seeds are deterministic per
attempt, a slot that times out fails identically on every retry and on every resume. Raise
it alongside `IMAGE_STEPS` for the full run. The connection timeout is a separate, hardcoded
30s and only covers establishing the TCP connection, not the wait for a response.

The peak-memory figure from the setup step determines whether both models fit alongside
the verifier in memory at once.

---

## Upload

```bash
export R2_BUCKET_URL="https://<account>.r2.cloudflarestorage.com/<bucket>"
export R2_ACCESS_KEY_ID=...
export R2_SECRET_ACCESS_KEY=...
ruby upload_images.rb
```

`R2_PUBLIC_URL` is normally **left unset** — it defaults to the app's own bucket, which is
the only host the client requests. Setting it to your own account's
`https://pub-<account>.r2.dev` makes the uploader refuse to run, because objects published
there are invisible to the app and every image would silently fall back to the legacy one.
Only set it together with a matching `EXPO_PUBLIC_R2_IMAGE_BASE_URL` on the client, or set
`ALLOW_PUBLIC_URL_MISMATCH=true` if you are deliberately publishing somewhere the app does
not read.

Requires `cwebp` (`brew install webp` / `apt install webp`).

Uploads are resumable, keyed on the **SHA-256 of the local file** recorded in
`uploaded_images.json`. An image whose digest matches what was last uploaded is skipped;
if the local file changed the object is overwritten, which is what makes regenerating a
single career publish its new photos. R2 existence is probed separately, so an object
deleted out from under the manifest is re-uploaded rather than left as a 404.

⚠️ Losing `uploaded_images.json` loses that record: the next run re-uploads everything.
Keep the file.

Slot 1 is additionally published as `<code>.webp` and `<code>.png` so the single-image
consumers pick up the new image without a client change. Their completion is tracked
separately, so a failed alias is retried on the next run rather than skipped forever.

Objects are written under a stable name with `Cache-Control: public, max-age=3600`
(override with `R2_CACHE_CONTROL`). They are deliberately **not** `immutable`: these keys
are overwritten in place, and a year-long immutable cache would leave installed clients
showing the pre-regeneration image long after R2 accepted the replacement.

**Per-slot objects are pruned when a slot goes away.** The client requests all three slot
URLs unconditionally, so a career reduced from three prompts to two would otherwise keep
showing its old third image forever — the generator removes the local PNG, but R2 has no
directory semantics and keeps serving the object. Each run deletes the objects for any slot
the manifest records that has no PNG in the directory, and drops the manifest entry once
every object is confirmed gone. Deletions are scoped to careers present in the directory:
pointing the script at a subset (a smoke test, or one regenerated career) never deletes
another career's live images.

The `<code>.png` and `<code>.webp` legacy aliases are **never** pruned. A missing slot-1
PNG usually means that slot was rejected or the run is still in progress, not that the
career is gone, and those aliases are the only image five screens load. Deleting them in
that situation would leave every one of those consumers with no image rather than the
previous one.

The summary reports `stale_slots_removed`. If a delete fails the manifest entry is kept, so
the next run retries it rather than leaving orphaned objects with nothing tracking them.

`UPDATE_DB=true` will also write to the `career_images` table. This is **off by default
and not required**: the app resolves URLs by convention. Two caveats if you enable it:

- The table is currently orphaned — no endpoint serves it, and no screen passes the
  `images` prop.
- It keeps writing the **compact** code (`111011`) into `occupation_code`, deliberately.
  Existing rows use that form and the unique index is on `(occupation_code, position)`,
  so writing the SOC form (`11-1011.00`) instead would never match them and each
  regenerated career would accumulate a duplicate row. The cost is that those rows still
  would not join to `career_roi`, which uses SOC format. Reviving the table properly
  means migrating the old rows to SOC form in one pass first.

---

## Files

| File | Role |
|---|---|
| `generate_narratives.rb` | writes `narrative_prompts.json` (the narrative *prompts*) |
| `generate_narratives_with_llm.rb` | calls Ollama to write `generated_narratives/*.json` — **not in git** |
| `image_prompts.rb` | prompt construction: narratives primary, O\*NET fallback, 3 shot styles |
| `generate_image_prompts.rb` | writes `image_prompts.json` |
| `generate_images.rb` | calls `/generate` + `/verify`, retries, checkpoints |
| `upload_images.rb` | WebP conversion and R2 upload |
| `image_generation_state.json` | per-image status, seed, rejection reasons |
| `pipeline.rb` | shared config: `IMAGE_COUNT`, the compact/SOC code mapping, the slot range |
| `pipeline_test.rb` | unit tests for the mapping and slot contract (run in CI) |
| `image_prompts_test.rb` | unit tests for prompt construction, incl. the O\*NET fallback (run in CI) |
| `generate_images_test.rb` | unit tests for the generator's configuration validation (run in CI) |