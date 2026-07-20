// Captures App Store screenshots from a web build of the app.
//
// Prerequisites (see README.md):
//   1. Web build served locally, e.g. http://localhost:4173
//   2. Playwright installed: npm install && npx playwright install chromium
//
// Usage:
//   node capture.mjs
//
// Env overrides:
//   BASE_URL   Web build URL (default http://localhost:4173)
//   API_URL    API base used only to clean up test swipes afterwards
//              (default http://localhost:8410, the local CORS proxy)
//   OUT_DIR    Screenshot output dir (default ./output)
//   SCHEME     'light' (default) or 'dark'

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE_URL = process.env.BASE_URL || 'http://localhost:4173';
const API_URL = process.env.API_URL || 'http://localhost:8410';
const OUT_DIR = process.env.OUT_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), 'output');
const SCHEME = process.env.SCHEME || 'light';

// Viewport CSS-pixel sizes that produce exact App Store pixel dims at @3x.
const DEVICES = [
  { name: 'iphone-6.7', width: 430, height: 932 }, // 1290 x 2796 px
  { name: 'iphone-6.5', width: 414, height: 896 }, // 1242 x 2688 px
];

// Single user for the whole run so both sizes show identical data.
const USER_ID = randomUUID();

async function shot(page, dir, name) {
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(dir, `${name}.png`) });
  console.log('shot:', dir, name);
}

async function waitForCard(page) {
  await page.waitForFunction(
    () =>
      document.body.innerText.includes('Annual Salary') ||
      document.body.innerText.includes('No careers found') ||
      document.body.innerText.includes('Failed to load'),
    { timeout: 30000 }
  );
  await page.waitForTimeout(2500); // let card image settle
}

async function captureDevice(browser, device) {
  const dir = path.join(OUT_DIR, device.name);
  mkdirSync(dir, { recursive: true });

  const ctx = await browser.newContext({
    viewport: { width: device.width, height: device.height },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    colorScheme: SCHEME,
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGE ERR:', String(e).slice(0, 300)));
  await page.addInitScript((uid) => {
    window.localStorage.setItem('careerality_user_id', uid);
  }, USER_ID);

  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 60000 });
  await waitForCard(page);

  // 1. Discover
  await shot(page, dir, '01-discover');

  // 2. Filter sheet
  await page.getByText('Filter', { exact: true }).click();
  await shot(page, dir, '02-filters');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);

  // 3. Career detail (tap the card)
  await page.getByText('Tap for details, swipe to continue').click();
  await shot(page, dir, '03-career-detail');
  await page.getByText('← Back').click();
  await page.waitForTimeout(800);

  // Like two careers so the Liked screen has content.
  // Each right swipe opens the feedback modal — dismiss it via Skip.
  for (let i = 0; i < 2; i++) {
    await page.getByText('✓', { exact: true }).click();
    await page.waitForTimeout(1000);
    const skip = page.getByText('Skip', { exact: true });
    if (await skip.count()) {
      await skip.click();
      await page.waitForTimeout(1000);
    }
  }

  // 4. Empty state (Liked Careers before any swipes)
  await page.getByRole('button', { name: 'Show navigation menu' }).click();
  await page.waitForTimeout(800);
  await page.locator('button[href="/Liked"]').click();
  await page.waitForTimeout(2500);
  await shot(page, dir, '04-empty-liked');

  // Back to Discover to add likes
  await page.getByRole('button', { name: 'Show navigation menu' }).click();
  await page.waitForTimeout(800);
  await page.locator('button[href="/Discover"]').click();
  await page.waitForTimeout(800);

  // 5. Liked Careers
  await page.getByRole('button', { name: 'Show navigation menu' }).click();
  await page.waitForTimeout(800);
  await page.locator('button[href="/Liked"]').click();
  await page.waitForTimeout(2500);
  await shot(page, dir, '05-liked-careers');

  await ctx.close();
}

async function cleanupSwipes() {
  try {
    const res = await fetch(`${API_URL}/api/swipes?user_id=${USER_ID}`);
    const body = await res.json();
    const swipes = Array.isArray(body) ? body : body.swipes;
    for (const s of swipes) {
      await fetch(`${API_URL}/api/swipes/${s.id}?user_id=${USER_ID}`, { method: 'DELETE' });
    }
    console.log(`cleanup: deleted ${swipes.length} test swipe(s) for ${USER_ID}`);
  } catch (e) {
    console.warn(`cleanup failed (delete swipes for user ${USER_ID} manually):`, String(e));
  }
}

async function main() {
  const browser = await chromium.launch();
  for (const device of DEVICES) {
    await captureDevice(browser, device);
  }
  await browser.close();
  await cleanupSwipes();
  console.log(`done. screenshots in ${OUT_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
