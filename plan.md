# Phase 2 Plan: Career Presentation

## Goal
Enhance career cards with richer visual and descriptive content:
1. Day-in-the-life narratives
2. Career images
3. Career videos (links)

---

## Features

### 1. Day-in-the-Life Narratives

**Data Flow:**
1. Fetch career context from CareerOneStop API (tasks, skills, work environment)
2. Generate narrative using local LLM (Llama/Mistral)
3. Store static content per occupation in database
4. Display summary on swipe card

**Database Changes:**
- Add `day_in_life` column to `career_roi` or create `career_content` table

**UI:**
- Show 1-2 sentence summary on swipe card
- Full narrative in detail view

### 2. Career Images

**Data Flow:**
1. Build prompt from CareerOneStop data + occupation metadata
2. Generate image using local image model (FLUX/Stable Diffusion)
3. Upload to Cloudflare R2
4. Store URL in database

**Storage:**
- Cloudflare R2 (easiest: presigned URLs or API upload)
- Store image URL in database

**UI:**
- Display on swipe card below narrative summary

### 3. Career Videos

- Embed links to CareerOneStop videos
- Show in detail view as clickable thumbnail/link

---

## Technical Implementation

### Backend (Rails)

| Task | Notes |
|------|-------|
| Add CareerOneStop API integration | Fetch occupation details for prompt context |
| Create content generation service | Interface for local LLM + image generation |
| Add `career_contents` table | Store day_in_life, image_url, video_url per occupation |
| Create `/api/careers/:id/content` endpoint | Return enriched career with new fields |
| Create `/api/generate/content` admin endpoint | Trigger generation for careers |

### Frontend (React Native)

| Task | Notes |
|------|-------|
| Update `CareerROI` type | Add day_in_life, image_url, video_url |
| Update SwipeCard | Display narrative + image |
| Update CareerDetailView | Display full content + video link |

### Data Pipeline

| Task | Notes |
|------|-------|
| Set up local LLM server | Ollama or similar for Llama/Mistral |
| Set up image generation | FLUX.1-schnell or Stable Diffusion |
| Set up Cloudflare R2 | Storage for generated images |

---

## Decisions

- **LLM**: Local (Ollama with Llama/Mistral)
- **Image Generation**: Local (FLUX.1-schnell or Stable Diffusion)
- **Generation Timing**: Upfront for all careers
- **CareerOneStop API**: User has credentials

---

## Out of Scope
- Video playback (links only for Phase 2)
- User-generated content
- Real-time generation during swipe (pre-generate only)
