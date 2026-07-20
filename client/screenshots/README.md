# App Store Screenshot Generation

Tooling to capture App Store screenshots of the app using the web build
(`expo export --platform web`) driven by Playwright at exact App Store
viewport sizes. This is the same harness used for the release-readiness
audit (see `RELEASE_READINESS.md`, Appendix A).

## What gets captured

Per device size, into `output/<device>/`:

| File | Screen |
|------|--------|
| `01-discover.png` | Discover (swipe card) |
| `02-filters.png` | Filter sheet |
| `03-career-detail.png` | Career detail view |
| `04-empty-liked.png` | Empty state (Liked Careers before any swipes) |
| `05-liked-careers.png` | Liked Careers screen |

## Sizes

| Directory | Devices | Viewport | Output pixels |
|-----------|---------|----------|---------------|
| `output/iphone-6.7/` | iPhone 14–16 Pro Max | 430×932 @3x | 1290×2796 |
| `output/iphone-6.5/` | iPhone 11 Pro Max / XS Max | 414×896 @3x | 1242×2688 |

Both sizes are accepted by App Store Connect. If you need the 6.9" size
(1320×2868, viewport 440×956 @3x) instead of 6.7", adjust `DEVICES` in
`capture.mjs`. See `app-store/ios/screenshots/README.md` for the full
App Store Connect requirements.

## Quick start

From `client/screenshots/`:

```sh
# 1. One-time setup
npm install
npx playwright install chromium

# 2. Terminal A — CORS proxy to the production API
npm run proxy

# 3. Terminal B — web build pointed at the proxy, served statically
cd ..
EXPO_PUBLIC_API_URL=http://localhost:8410 npx expo export --platform web --output-dir /tmp/webdist --clear
cd /tmp/webdist && python3 -m http.server 4173

# 4. Terminal C — capture
cd client/screenshots
npm run capture
```

Output lands in `output/iphone-6.7/` and `output/iphone-6.5/` (PNGs are
git-ignored; copy the keepers into `app-store/ios/screenshots/` for
submission).

### Options (env vars)

| Var | Default | Purpose |
|-----|---------|---------|
| `BASE_URL` | `http://localhost:4173` | URL of the served web build |
| `API_URL` | `http://localhost:8410` | API base for test-swipe cleanup |
| `OUT_DIR` | `./output` | Output directory |
| `SCHEME` | `light` | `light` or `dark` |

## Test data hygiene

The script uses a random `user_id` per run, right-swipes two careers so the
Liked screen has content, then deletes those swipes via the API afterwards.
If cleanup fails it prints the `user_id` so you can delete manually:

```sh
curl "$API_URL/api/swipes?user_id=<UUID>"          # list ids
curl -X DELETE "$API_URL/api/swipes/<id>?user_id=<UUID>"
```

## Manual alternative (no tooling)

If automation isn't available, screenshots can be taken on a simulator:

1. `cd client && npx expo start --ios` (or open in Xcode on an
   iPhone 16 Pro Max / 11 Pro Max simulator).
2. Navigate to each screen above, then **Device → Screenshot** (⌘S).
3. Simulators produce native-resolution PNGs; verify they match the
   required pixel dims before upload.

## Notes

- The web build renders the same React Native screens via
  `react-native-web`; verify final picks on a real device before
  submission.
- Rebuild with `--clear` whenever `EXPO_PUBLIC_API_URL` changes (Metro
  caches env inlining).
