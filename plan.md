# Phase 2 Plan: Career Presentation

## Goal
Enhance career cards with richer visual and descriptive content:
1. Day-in-the-life narratives
2. Career images (multiple per career)
3. Career videos (embedded)

---

## Features

### 1. Day-in-the-Life Narratives

**Data Flow:**
1. Fetch career context from CareerOneStop API (tasks, skills, work environment)
2. Generate narrative using RubyLLM (local Ollama with Llama/Mistral)
3. Store static content per occupation in database
4. Display summary on swipe card

**Database Changes:**
- Create `career_contents` table with `day_in_life` text

**UI:**
- Show 1-2 sentence summary on swipe card
- Full narrative in detail view

### 2. Career Images (Multiple)

**Data Flow:**
1. Build prompt from CareerOneStop data + occupation metadata
2. Generate images using local image model (FLUX.1-schnell)
3. Upload to Cloudflare R2
4. Store URLs in database (multiple per occupation)

**Data Model:**
- `career_images` table: occupation_code, image_url, prompt_used, order

**UI:**
- Display primary image on swipe card
- Gallery in detail view

### 3. Career Videos

- Fetch video URLs from CareerOneStop API
- Embed in detail view (WebView or video player)
- Fallback to link if embedding fails

---

## Technical Implementation

### Data Scripts (Ruby in data/)

| Script | Purpose |
|--------|---------|
| `fetch_careeronestop.rb` | Fetch occupation details from CareerOneStop API |
| `generate_narratives.rb` | Generate day-in-life using RubyLLM (Ollama) |
| `generate_images.rb` | Generate and upload images to R2 |
| `populate_career_contents.rb` | Run all generation and save to database |

### Database Schema

```ruby
# career_contents table
t.string :occupation_code
t.text :day_in_life_summary      # 1-2 sentences for swipe card
t.text :day_in_life_full         # full narrative for detail view
t.string :video_url             # CareerOneStop video URL
t.timestamps

# career_images table
t.string :occupation_code
t.string :image_url             # R2 URL
t.text :prompt_used
t.integer :order                # for multiple images
t.timestamps
```

### Frontend (React Native)

| Task | Notes |
|------|-------|
| Update `CareerROI` type | Add day_in_life_summary, day_in_life_full, video_url |
| Update types | Add CareerImage array |
| Update SwipeCard | Display day_in_life_summary + primary image |
| Update CareerDetailView | Full narrative, image gallery, embedded video |

---

## Data Pipeline

1. Run `fetch_careeronestop.rb` - get occupation details
2. Run `generate_narratives.rb` - generate day-in-life via RubyLLM
3. Run `generate_images.rb` - generate images, upload to R2
4. Import results to database via Rails

---

## Decisions

- **LLM**: Local (Ollama with Llama/Mistral via RubyLLM)
- **Image Generation**: Local (FLUX.1-schnell)
- **Generation Timing**: Upfront for all careers
- **CareerOneStop API**: User has credentials
- **Storage**: Cloudflare R2 for images
- **No API endpoints**: Ruby scripts only for generation

---

## Out of Scope
- Real-time generation during swipe (pre-generate only)
- User-generated content
- Video generation (just fetch from CareerOneStop)