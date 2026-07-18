# Release Readiness Review — July 2026

Audit of the Careerality codebase (client, server, data) against the goal of a
minimally-useful App Store / Google Play release, combining documentation review,
static code analysis, and hands-on UI testing of the app via `react-native-web`
driven by Playwright against the production API (screenshots in
[`docs/screenshots/audit-2026-07/`](docs/screenshots/audit-2026-07/)).

---

## 1. Methodology

1. **Docs review** — `README.md`, `DEPLOYMENT.md`, `plan.md`, `CONTRIBUTING.md`.
2. **Code review** — all of `client/src`, `server/app` + config + tests, `data/` ETL
   and content-generation scripts.
3. **Live UI testing** — web build (`expo export --platform web`) pointed at the
   production API, exercised in mobile (390×844) light and dark mode with real
   swipe/filter/navigation interactions. Screenshots analyzed individually.
   Test swipes were created under a throwaway `user_id` and deleted afterwards.

Verified baselines: client `jest` 13/13 pass, `eslint` clean on `src/` (but see B3),
server `rails test` 17/17 pass.

---

## 2. Release Blockers (must fix before submission)

| # | Finding | Evidence |
|---|---------|----------|
| B1 | **Debug footer rendered in production UI.** `DiscoverScreen.tsx` renders `DEBUG: careers=20 idx=0 cards=20 loadingMore=n …` on the main screen. | [01](docs/screenshots/audit-2026-07/01-discover-light.png), [07](docs/screenshots/audit-2026-07/07-after-swipes-light.png) |
| B2 | **Drawer shows internal dev/ops panel.** Build hash, update channel, runtime version, expo-updates state ("UpdateAvail: no", etc.) and a "CHECK FOR UPDATE" button are user-visible. Fine for internal testing, not for store builds. | [02](docs/screenshots/audit-2026-07/02-drawer-light.png) |
| B3 | **`npm run lint` is broken.** `eslint.config.mjs` has no `ignores`, so linting covers `dist/`, `android/`, `ios/` build output → 5,072 errors / 751 warnings. CI-quality gate is effectively absent. (`npx eslint src App.tsx index.ts` is clean.) | `client/eslint.config.mjs` |
| B4 | **No privacy policy or data-deletion mechanism.** App Store (5.1.1) and Google Play both require a privacy policy URL and in-app account/data deletion. The app stores swipe history server-side keyed by `user_id` with no way to view or wipe it. No `DELETE`-all endpoint exists server-side either. | `server/app/controllers/api/swipes_controller.rb`, drawer |
| B5 | **Production server config unsafe.** `config/database.yml` hardcodes `postgres/postgres` for production; CORS allows a single Tailscale dev IP (`http://100.96.176.38:8081`), which also breaks any legitimate web/Expo-Web usage. | `server/config/database.yml`, `server/config/initializers/cors.rb` |

---

## 3. UX & Front-End Design Findings (from screenshot testing)

### Discover / SwipeCard — the core screen
| # | Finding | Evidence |
|---|---------|----------|
| U1 | **ROI% — the app's headline metric — is not on the card.** Card shows Salary / Education Cost / Break-even / Job Zone, but never the ROI the whole app is named for. | [01](docs/screenshots/audit-2026-07/01-discover-light.png) |
| U2 | **"Job Zone 5" is jargon.** Users don't know O*NET job zones; the number communicates nothing. Show education level instead (already in the payload). | [01](docs/screenshots/audit-2026-07/01-discover-light.png) |
| U3 | **Inconsistent currency formatting.** Salary `$67,260` vs Education Cost `$45,675.85` (cents). Round to whole dollars everywhere. | [06](docs/screenshots/audit-2026-07/06-after-like-light.png) |
| U4 | **Careers without images render a huge blank hole** (150 of 1,082 careers have no image — FLUX generation failures). No fallback/placeholder. | [07](docs/screenshots/audit-2026-07/07-after-swipes-light.png) |
| U5 | **Card content overflows the card frame** — the "Tap for details" hint and debug line spill past the card's rounded boundary on longer cards. | [06](docs/screenshots/audit-2026-07/06-after-like-light.png) |
| U6 | **"0 of 20 reviewed" is misleading** — 20 is the page size, not the catalog size (~1,082). Shows no real progress. | [01](docs/screenshots/audit-2026-07/01-discover-light.png) |
| U7 | **The swipe-feedback loop described in the README ("What interested you?") is dead code.** `FeedbackModal` is built but never rendered by any screen; swipes POST no feedback, so the personalization loop cannot learn. | grep: `FeedbackModal` only referenced in tests/`index.ts` |

### Career detail view
| # | Finding | Evidence |
|---|---------|----------|
| U8 | **No ROI% in the detail view either**; SOC code `29-1181.00` shown prominently under the title (internal identifier); "Cost of Living Index 100.0" raw jargon; "Job Zone 5" unexplained. | [04](docs/screenshots/audit-2026-07/04-detail-light.png), [05](docs/screenshots/audit-2026-07/05-detail-scrolled-light.png) |
| U9 | **Image gallery is wired but never fed.** `CareerDetailView` accepts `images[]`, but no caller passes it and the API doesn't return images — the 932 generated images on R2 only ever appear as the single swipe-card thumbnail. | `CareerDetailView.tsx`, `server/app/models/career_roi.rb` |

### Liked screen
| # | Finding | Evidence |
|---|---------|----------|
| U10 | **Unlabeled stat row** — `$67,260  9.1%  2yr` forces users to guess that 9.1% is ROI and 2yr is break-even. | [08](docs/screenshots/audit-2026-07/08-liked-light.png) |
| U11 | **Remove ✕ button collides with long titles** ("Cardiovascular Technologists and✕Technicians"). | [08](docs/screenshots/audit-2026-07/08-liked-light.png) |
| U12 | **Duplicated header** — nav header "Liked Careers" plus an in-screen hero repeating "Liked Careers / Occupations you're interested in" wastes vertical space (also on Data Sources). | [08](docs/screenshots/audit-2026-07/08-liked-light.png), [09](docs/screenshots/audit-2026-07/09-datasources-light.png) |

### Filter sheet
| # | Finding | Evidence |
|---|---------|----------|
| U13 | **"STATE CODE" label is jargon** — should be "Location". The picker also mixes "U.S." into the state list alphabetically instead of pinning it at top as "National (all states)". | [03](docs/screenshots/audit-2026-07/03-filter-light.png) |
| U14 | **No sort control** although the API supports `sort=roi|salary|breakeven|demand`; no education-pathway filter (promised in README). | `FilterSheet.tsx`, `roi_controller.rb` |

### Working well (keep)
- Day-in-the-life narratives are high quality and distinctive; dark mode works end-to-end ([10](docs/screenshots/audit-2026-07/10-discover-dark.png)); state filter works ([12](docs/screenshots/audit-2026-07/12-texas-filter.png)); undo works; liked-career round-trip persists server-side; empty states exist ([13](docs/screenshots/audit-2026-07/13-liked-empty.png)).

---

## 4. Server Findings

| # | Finding | Severity |
|---|---------|----------|
| S1 | No authentication or identity: `user_id` is a client-generated UUID passed as a plain param — anyone can read/delete anyone's swipes. Acceptable privacy-wise for MVP only if documented; needs at minimum a delete-my-data endpoint (B4). | High |
| S2 | `career_images` table/model orphaned: no endpoint, ROI payload omits images (U9). | Medium |
| S3 | `swipes#index` and `swipes#liked` unpaginated. | Low |
| S4 | No rate limiting / abuse protection on public API. | Low |
| S5 | `GET /api/careers` unused by the client (vestigial). | Low |
| S6 | Server README is the Rails stock template; no documented data-refresh runbook. | Low |

## 5. Data Pipeline Findings

| # | Finding | Severity |
|---|---------|----------|
| D1 | **`transform.py` has an `IndentationError` (lines ~146, ~637, ~1041) — the ETL cannot run as committed.** Nothing in the pipeline is reproducible until fixed. | Critical |
| D2 | **Cost-of-living loader is incompatible with the actual EPI workbook** (expects C2ER-style columns; EPI file has dollar budgets). Result: `career_cost_of_living` has only the national row → COL index = 100.0 everywhere → `adjusted_salary` == nominal salary. The regional-adjustment feature is silently dead. Meanwhile the Data Sources screen cites BLS Consumer Expenditure Survey, which the pipeline doesn't use. | High |
| D3 | **150/1,082 careers have no generated image** (FLUX-via-Ollama path fails: `undefined method 'unpack1' for nil`). User-visible as blank card area (U4). | High |
| D4 | **`video_url` never populated** — narrative JSONs contain the literal string `"None"`, stored verbatim (truthy) by `populate_career_contents.rb`. CareerOneStop fetch from plan.md was never implemented. | Medium |
| D5 | **Demand data looks contradictory** — e.g. Audiologists: "Demand Rank #4" nationally with 900 annual openings. Ranking/backfill logic needs validation. | Medium |
| D6 | **Skills are thin** — detail view shows a single generic skill ("Reading Comprehension") for careers where O*NET lists dozens. | Medium |
| D7 | `industry_name` is bogus (same value as `industry_code`, e.g. "cross-industry"). | Low |
| D8 | `schema.py` is stale vs Rails migrations (missing columns/tables); fresh bootstrap would fail. Hardcoded `postgres/postgres@localhost` in all Python scripts. | Low |

---

## 6. Work Breakdown — sub-agent tasks

Each task = one branch + one PR, linted and tested, with before/after screenshots
for UI changes (harness documented in Appendix A). Status tracked here.

| Task | Area | Addresses | Branch / PR |
|------|------|-----------|--------|
| 1. Release hygiene: remove DEBUG footer, gate drawer dev panel behind `__DEV__`, add eslint ignores | client | B1, B2, B3 | [#16](https://github.com/tpaulshippy/careerality/pull/16) |
| 2. SwipeCard: add ROI%, whole-dollar formatting, image fallback, fix overflow | client | U1–U5 | [#19](https://github.com/tpaulshippy/careerality/pull/19) |
| 3. Liked screen: labeled stats, fix ✕/title collision, drop duplicated hero header | client | U10–U12 | [#21](https://github.com/tpaulshippy/careerality/pull/21) |
| 4. Detail view: add ROI%, drop SOC code, plain-English job zone, career image, hide COL index when national | client | U8, U9 | [#22](https://github.com/tpaulshippy/careerality/pull/22) |
| 5. Server hardening: env-driven CORS origins + DB credentials | server | B5 | [#17](https://github.com/tpaulshippy/careerality/pull/17) |
| 6. Data: repair `transform.py` indentation; compile-check all scripts | data | D1 | [#18](https://github.com/tpaulshippy/careerality/pull/18) |
| 7. Wire FeedbackModal into right-swipe flow; submit `feedback` to API | client | U7 | [#23](https://github.com/tpaulshippy/careerality/pull/23) (stacked on #16) |
| 8. Filter sheet: "Location" label, pinned national option, sort control | client | U13, U14 | [#25](https://github.com/tpaulshippy/careerality/pull/25) (stacked on #23) |
| 9. Delete-my-data: `DELETE /api/swipes/destroy_all` + drawer action with confirmation | server+client | B4 (partially; privacy policy page still needed externally) | [#24](https://github.com/tpaulshippy/careerality/pull/24) (stacked on #23) |
| 10. Data: EPI cost-of-living parser + tests; scrub literal `"None"` video URLs | data | D2 (loader side), D4 | [#20](https://github.com/tpaulshippy/careerality/pull/20) |

**Merge order for the stacked chain:** #16 → #23 → {#24, #25} (each PR notes its base).

### Minor item surfaced during the work (not yet PR'd)
- `tsc --noEmit` reports a pre-existing style-typing error in `CareerDetailView.tsx` (`ViewStyle` vs `ImageStyle` on `galleryImage`) — the repo has no typecheck script/gate; a one-line fix (type the style as `ImageStyle`) can ride along with any future client PR.

### Documented but **not** addressed in this pass (need infra/product decisions)
- **D3** — regenerating 150 missing images requires working FLUX infrastructure.
- **Videos** — CareerOneStop integration was never built (Phase 2 item).
- **S1/auth** — real accounts/cross-device sync is a Phase 4 product decision.
- **D5, D6** — demand-rank validation and richer skills require ETL re-runs against the production DB (needs D1 fix deployed first).
- **App-store assets** — privacy policy page, store screenshots, content rating (see DEPLOYMENT.md checklist).

---

## Appendix A — UI test harness (for sub-agents)

The harness lives outside the repo in `/tmp/opencode/`:

1. **CORS proxy** (running on :8410): `proxy.mjs` forwards to
   `https://careerality.app` and adds permissive CORS headers.
   Start: `setsid /tmp/opencode/start-proxy.sh > /tmp/opencode/proxy.log 2>&1 < /dev/null &`
2. **Web build**: from `client/`, run
   `EXPO_PUBLIC_API_URL=http://localhost:8410 npx expo export --platform web --output-dir /tmp/opencode/webdist --clear`
   (`--clear` is required when the API URL changes — Metro caches env inlining).
3. **Static server**: `cd /tmp/opencode/webdist && python3 -m http.server <PORT>`
   (use the port assigned to your task; 4173 is taken by the baseline).
4. **Screenshots**: Playwright + chromium installed in `/tmp/opencode`
   (`node_modules/playwright`); see `/tmp/opencode/shoot.mjs` for a working script
   (mobile viewport 390×844 @2x, drawer opens via
   `getByRole('button', { name: 'Show navigation menu' })`, nav via
   `button[href="/Liked"]` etc.).
5. **Swipe hygiene**: set a unique `careerality_user_id` in localStorage per run;
   afterwards delete test swipes:
   `curl "https://careerality.app/api/swipes?user_id=<UUID>"` then
   `curl -X DELETE "https://careerality.app/api/swipes/<id>?user_id=<UUID>"`.
6. **PR screenshots**: commit before/after PNGs under
   `docs/screenshots/<branch-name>/` and reference them in the PR body via
   `https://raw.githubusercontent.com/tpaulshippy/careerality/<branch>/docs/screenshots/<branch>/<file>.png`.
