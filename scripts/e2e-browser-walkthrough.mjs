// Phase 6 live click-through against the running compose stack.
// Drives a headless Chromium through the parent + tutor flows and captures
// screenshots at desktop + responsive widths. Not a committed test — a
// verification artifact. Run: node scripts/e2e-browser-walkthrough.mjs
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.WEB_URL ?? "http://localhost:3010";
const CASE_ID = process.env.CASE_ID ?? "";
const TUTOR_ID = process.env.TUTOR_ID ?? "";
const OUT = "/tmp/pw-shots";
mkdirSync(OUT, { recursive: true });

const CREDS = {
  parent: { email: "parent@example.com", password: "password123" },
  tutor: { email: "tutor1@example.com", password: "password123" },
};

const results = [];
const shot = async (page, name) => {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  results.push(`shot  ${name}  url=${new URL(page.url()).pathname}`);
};

async function login(page, who) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', CREDS[who].email);
  await page.fill('input[name="password"]', CREDS[who].password);
  await page.click('form[aria-label="Sign in"] button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 15000 });
  await page.waitForLoadState("networkidle");
  results.push(`login ${who} -> ${new URL(page.url()).pathname}`);
}

const browser = await chromium.launch();

// ── Parent flow ─────────────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await login(page, "parent");
  await shot(page, "01-parent-dashboard");

  await page.goto(`${BASE}/cases`, { waitUntil: "networkidle" });
  await shot(page, "02-parent-cases-list");

  await page.goto(`${BASE}/cases/new`, { waitUntil: "networkidle" });
  await page.fill('input[name="title"]', "Browser-pass case");
  await page.fill('input[name="subject"]', "Physics");
  await page.fill('input[name="level"]', "A-Level");
  await page.fill('input[name="location"]', "Manchester");
  await page.fill('input[name="budgetPerHour"]', "45");
  await shot(page, "03-parent-case-new-filled");
  await page.click('form[aria-label="Case form"] button[type="submit"]');
  // Success redirects to /cases/{id}; wait for it rather than racing networkidle.
  await page.waitForURL(/\/cases\/[0-9a-f-]{36}$/, { timeout: 15000 });
  await page.waitForLoadState("networkidle");
  await shot(page, "04-parent-after-create-detail");

  // Case detail of a known case (direct nav = deterministic).
  if (CASE_ID) {
    await page.goto(`${BASE}/cases/${CASE_ID}`, { waitUntil: "networkidle" });
    await shot(page, "05-parent-case-detail");
  }

  await page.goto(`${BASE}/tutors`, { waitUntil: "networkidle" });
  await shot(page, "06-parent-tutor-directory");
  if (TUTOR_ID) {
    await page.goto(`${BASE}/tutors/${TUTOR_ID}`, { waitUntil: "networkidle" });
    await shot(page, "07-parent-tutor-detail");
  }

  // Responsive widths on the cases list.
  for (const [w, h, tag] of [
    [375, 812, "mobile-375"],
    [768, 1024, "tablet-768"],
  ]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto(`${BASE}/cases`, { waitUntil: "networkidle" });
    await shot(page, `08-parent-cases-${tag}`);
  }
  await ctx.close();
}

// ── Tutor flow (fresh context = clean cookies) ───────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await login(page, "tutor");
  await shot(page, "09-tutor-dashboard");

  await page.goto(`${BASE}/profile`, { waitUntil: "networkidle" });
  await shot(page, "10-tutor-profile-editor");

  await page.goto(`${BASE}/cases`, { waitUntil: "networkidle" });
  await shot(page, "11-tutor-cases-invited");

  // A tutor hitting the parent-only directory should see a friendly state, not a crash.
  await page.goto(`${BASE}/tutors`, { waitUntil: "networkidle" });
  await shot(page, "12-tutor-directory-forbidden");
  await ctx.close();
}

await browser.close();
console.log(results.join("\n"));
console.log(`\nScreenshots in ${OUT}`);
