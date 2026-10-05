# Career Image Generation

Generates 3 images per career (for the in-app slideshow) and uploads them to Cloudflare R2.

Everything runs locally on an Apple Silicon Mac at **$0** — no API keys, no per-image cost.

---

## How it works

```
generated_narratives/*.json   (existing, 1082 careers)
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

Prompts are now built from the existing day-in-the-life narratives, which describe real
sensoried detail ("a quiet, glass-walled corner office with the hum of the city
outside"). Coverage is 1082/1082, so there is no empty-prompt case left to fall back
from. Each career gets 3 different framings — wide establishing, over-the-shoulder,
close detail — so the slideshow reads as a sequence.

### URL convention (no database required)

The app resolves image URLs by convention, so no migration or API change is needed:

| Object | Consumer |
|---|---|
| `<code>-1.webp`, `-2`, `-3` | slideshow in `CareerDetailView` |
| `<code>.webp` | single-image consumers (`SwipeCard`, `MapScreen`, `CompareScreen`) |

`<code>` is the compact 6-digit SOC code: `11-1011.00` → `111011`.

`getImageUrls()` returns the three slots followed by the legacy bare filename. The app
tries each in turn and falls through on load failure, so careers that have not been
regenerated yet still render. The legacy object is shown **only** when no slot loads —
it duplicates slot 1 for a regenerated career, so it is never a step in the rotation.
`getImageUrl()` is unchanged for the single-image consumers.

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

```bash
cd data/content_generation

# 1. Point at your Mac (from the setup step). HTTPS is handled; certs are
#    verified normally, which Tailscale satisfies.
export IMAGE_API_URL=https://your-mac.<tailnet>.ts.net

# 2. Build prompts  (writes image_prompts.json). Reads generated_narratives/ and
#    needs no database.
ruby generate_image_prompts.rb

# 3. Generate + verify
ruby generate_images.rb
```

A database is only required for a career with **no** narrative, where the O\*NET task
text is borrowed as a fallback. All 1,082 current careers have narratives.

`generate_images.rb` takes optional positional args:

```
ruby generate_images.rb [prompts_file] [output_dir] [state_file] [codes] [limit]
```

Useful during setup:

```bash
# Smoke test: 3 careers, 9 images
ruby generate_images.rb image_prompts.json /tmp/smoke /tmp/smoke-state.json "$( \
  ruby -rjson -e 'p JSON.parse(File.read("image_prompts.json")).keys.first(3).join(",")')" 3

# Skip verification entirely
VERIFY_IMAGES=false ruby generate_images.rb

# More retries before giving up on a rejected image
MAX_ATTEMPTS=5 ruby generate_images.rb
```

### Resumability

Progress is written to `image_generation_state.json` after every image. Re-running skips
anything already generated with a terminal status and retries only what failed. Seeds are
derived deterministically from `occupation_code`, `slot` and `attempt`, so a resumed run
reproduces the same images it would have produced the first time.

Interrupt with Ctrl-C at any time; just run the same command again to continue.

### Verifier behaviour

`/verify` returns `pass` plus a list of issues. On rejection the generator **reseeds and
retries** (default 3 attempts), keeping the last image either way and recording the reason
in the state file.

If the verifier is unreachable the image is accepted and marked `unverified` — a flaky
verifier never blocks the run.

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
IMAGE_STEPS=50 ruby generate_images.rb \
  image_prompts.json /tmp/base50 /tmp/base50-state.json 11-1011,29-1141,33-3011
```

The peak-memory figure from the setup step determines whether both models fit alongside
the verifier in memory at once.

---

## Upload

```bash
export R2_BUCKET_URL="https://<account>.r2.cloudflarestorage.com/<bucket>"
export R2_ACCESS_KEY_ID=...
export R2_SECRET_ACCESS_KEY=...
export R2_PUBLIC_URL="https://pub-<account>.r2.dev"   # defaults to the app's bucket

ruby upload_images.rb
```

Requires `cwebp` (`brew install webp` / `apt install webp`).

Uploads are resumable — existence is checked against R2 rather than a local manifest, so
interrupted runs continue instead of re-uploading. Slot 1 is additionally published as
`<code>.webp` and `<code>.png` so single-image consumers pick up the new image without a
client change.

`UPDATE_DB=true` will also write to the `career_images` table. This is **off by default
and not required**: the app resolves URLs by convention. Note the table is currently
orphaned — no endpoint serves it — and the old script wrote compact codes (`111011`) into
`occupation_code`, which would never join to `career_roi` (`11-1011.00`). The new script
normalises to the SOC format if you enable it.

---

## Files

| File | Role |
|---|---|
| `image_prompts.rb` | prompt construction: narratives primary, O\*NET fallback, 3 shot styles |
| `generate_image_prompts.rb` | writes `image_prompts.json` |
| `generate_images.rb` | calls `/generate` + `/verify`, retries, checkpoints |
| `upload_images.rb` | WebP conversion and R2 upload |
| `image_generation_state.json` | per-image status, seed, rejection reasons |
| `soc_code.rb` | the compact/SOC code mapping shared by every script above |
| `soc_code_test.rb` | unit tests for that mapping (`ruby soc_code_test.rb`) |