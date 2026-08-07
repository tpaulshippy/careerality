# App Store Screenshots

This directory contains the App Store screenshot assets and the Playwright
harness used to generate them from the web build.

## Required Sizes

Screenshots must be portrait PNG or JPEG files with no alpha channel.

| Display | Devices | Resolution |
|---------|---------|------------|
| iPhone 6.9" | iPhone 16 Pro Max | 1320 x 2868 px |
| iPhone 6.5" | iPhone 14 Plus, 13 Pro Max, 12 Pro Max, 11 Pro Max, XS Max | 1242 x 2688 px (or 1284 x 2778 px) |
| iPad 13" | iPad Pro (M4) | 2064 x 2752 px |
| iPad 12.9" | iPad Pro (2nd gen) | 2048 x 2732 px |

Provide 1–10 screenshots per display size. The first 2–3 appear in search
results. Show the core experience first and keep device frames and captions
consistent across sizes.

## Captured Screens

Each device directory under `output/` contains:

| File | Screen |
|------|--------|
| `01-discover.png` | Discover (swipe card) |
| `02-filters.png` | Filter sheet |
| `03-career-detail.png` | Career detail view |
| `04-empty-liked.png` | Empty Liked Careers state |
| `05-liked-careers.png` | Liked Careers screen |

The current capture targets are:

| Directory | Viewport | Output pixels |
|-----------|----------|---------------|
| `output/iphone-6.7/` | 430 x 932 @3x | 1290 x 2796 |
| `output/iphone-6.5/` | 414 x 896 @3x | 1242 x 2688 |
| `output/ipad-13/` | 1032 x 1376 @2x | 2064 x 2752 |
| `output/ipad-12.9/` | 1024 x 1366 @2x | 2048 x 2732 |

## Generate Screenshots

From the repository root:

```sh
# One-time setup
cd app-store/ios/screenshots
npm install
npx playwright install chromium

# Terminal A
npm run proxy

# Terminal B
cd ../../../client
EXPO_PUBLIC_API_URL=http://localhost:8410 npx expo export --platform web --output-dir /tmp/webdist --clear
cd /tmp/webdist && python3 -m http.server 4173

# Terminal C
cd app-store/ios/screenshots
npm run capture
```

The capture uses a random test user, creates temporary swipes for the Liked
screens, and deletes them when finished. `BASE_URL`, `API_URL`, `OUT_DIR`, and
`SCHEME` can be overridden with environment variables.
