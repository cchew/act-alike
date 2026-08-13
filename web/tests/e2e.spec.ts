// tests/e2e.spec.ts
//
// Precondition: the FastAPI backend must be started manually before running this
// suite — Playwright's `webServer` config (playwright.config.ts) only manages the
// frontend dev server, not the backend. Start it in a separate terminal first:
//   source .venv/bin/activate && export $(grep ANTHROPIC_API_KEY .env) && term-comparison serve
// ANTHROPIC_API_KEY must be exported so the difference-summary test below gets a
// real, non-null summary back from the LLM layer.
import { test, expect } from "@playwright/test";

// Every test in this file that clicks a flagship/browsed term triggers a real
// (paid) Anthropic API call in the background once 2+ definitions come back —
// true before and after the quick/full split (the old code made the same call
// synchronously). Tests that only need the LLM path to have *run* (not to
// verify its specific output) are skipped below once manually confirmed
// working, to avoid re-billing on every suite run. Re-enable individually to
// re-verify against a live LLM response.
//
// The three describes below are not testing the first-visit tour — each seeds
// it as "seen" via its own beforeEach so its overlay doesn't intercept clicks
// meant for the page underneath. This is deliberately per-describe rather than
// file-wide: addInitScript scripts re-run on every navigation including
// reload(), so a file-wide "seed as seen" would fight the "First-visit tour"
// describe's own reload-based assertions further down.

test.describe("Term comparison — flagship terms", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("act-alike-tour-seen", "1"));
  });

  test("page title is Act Alike", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("Act Alike");
  });

  // Manually verified 2026-07-17 against a live backend with ANTHROPIC_API_KEY set.
  test.skip("clicking 'personal information' shows definitions from multiple Acts", async ({ page }) => {
    test.setTimeout(60000);
    await page.goto("/");
    await page.locator(".flagship-btn", { hasText: "personal information" }).click();
    await page.waitForSelector(".definition-card", { timeout: 30000 });
    await expect(page.locator(".definition-card").first()).toBeVisible();
    expect(await page.locator(".definition-card").count()).toBeGreaterThan(0);
  });

  // Manually verified 2026-07-17 against a live backend with ANTHROPIC_API_KEY set.
  test.skip("clicking 'australian resident' shows definitions from multiple Acts", async ({ page }) => {
    test.setTimeout(60000);
    await page.goto("/");
    await page.locator(".flagship-btn", { hasText: "australian resident" }).click();
    await page.waitForSelector(".definition-card", { timeout: 30000 });
    await expect(page.locator(".definition-card").first()).toBeVisible();
    expect(await page.locator(".definition-card").count()).toBeGreaterThan(0);
  });

  test("searching an unknown term shows a not-found message", async ({ page }) => {
    await page.goto("/");
    await page.locator(".search-input").fill("zzz-not-a-real-term");
    await page.locator(".search-btn").click();
    await expect(page.locator(".load-error")).toContainText("No Commonwealth Act defines");
  });

  // Manually verified 2026-07-17 against a live backend with ANTHROPIC_API_KEY set.
  test.skip("a previously-truncated list-form definition now shows full content", async ({ page }) => {
    test.setTimeout(60000);
    await page.goto("/");
    await page.locator(".search-input").fill("entity");
    await page.locator(".search-btn").click();
    await page.waitForSelector(".definition-card", { timeout: 30000 });
    const cards = page.locator(".definition-card");
    expect(await cards.count()).toBeGreaterThan(0);
    const firstCardText = await cards.first().innerText();
    // Before the fix, this card's definition text was a bare fragment
    // ending in "the following:" with nothing after it. Confirm real list
    // content is now present and visible, not clipped.
    expect(firstCardText.trim().endsWith("the following:")).toBe(false);
    expect(firstCardText.length).toBeGreaterThan(60);
  });

  // Manually verified 2026-07-17: /definitions?term=personal+information returned
  // a real, non-empty Claude-generated summary against the live backend.
  test.skip("clicking 'personal information' renders a non-empty difference summary", async ({ page }) => {
    test.setTimeout(60000);
    await page.goto("/");
    await page.locator(".flagship-btn", { hasText: "personal information" }).click();
    await page.waitForSelector(".difference-summary", { timeout: 45000 });
    await expect(page.locator(".difference-summary")).toBeVisible();
    await expect(page.locator(".difference-summary")).not.toHaveText("");
  });

  test("direct navigation to /term/:slug for an unknown term shows the not-found message", async ({ page }) => {
    await page.goto("/term/zzz-not-a-real-term");
    await expect(page.locator(".load-error")).toContainText("No Commonwealth Act defines");
  });

  // Requires a real 2+-Act term against a live backend to verify the pushState
  // round trip end to end (URL updates, then back/forward navigates between
  // results) — not yet manually verified against a live backend; enable once
  // that verification has been done, per this file's existing convention for
  // LLM-cost-incurring or live-corpus-dependent assertions.
  test.skip("searching a flagship term updates the URL, and back navigation restores the previous state", async ({ page }) => {
    await page.goto("/");
    await page.locator(".flagship-btn", { hasText: "personal information" }).click();
    await page.waitForSelector(".definition-card", { timeout: 30000 });
    await expect(page).toHaveURL(/\/term\/personal/);

    await page.goBack();
    await expect(page).toHaveURL("/");
  });
});

test.describe("Term comparison — browse list", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("act-alike-tour-seen", "1"));
  });

  // Manually verified 2026-07-17 against a live backend with ANTHROPIC_API_KEY set.
  test.skip("filtering and clicking a non-flagship term renders its definitions", async ({ page }) => {
    test.setTimeout(60000);
    await page.goto("/");
    // The browse panel is collapsed by default — chips exist in the DOM but
    // are display:none until the toggle is clicked.
    await page.click(".term-browser-toggle");
    await page.waitForSelector(".term-chip", { timeout: 10000 });

    const chipCountBefore = await page.locator(".term-chip").count();
    expect(chipCountBefore).toBeGreaterThan(0);

    // Filter down using the display text of the first available chip, then click it.
    const firstChipText = (await page.locator(".term-chip").first().innerText()).trim();
    // Chip text includes the trailing act-count badge (e.g. "small business 3") — filter
    // on a prefix that will still match after the count renders inline.
    const filterQuery = firstChipText.split(/\s+\d+$/)[0]!;

    await page.locator(".term-filter-input").fill(filterQuery);

    const chipsAfter = page.locator(".term-chip");
    const chipCountAfter = await chipsAfter.count();
    expect(chipCountAfter).toBeGreaterThan(0);
    expect(chipCountAfter).toBeLessThanOrEqual(chipCountBefore);
    // Every remaining chip must still contain the filter query — proves the
    // filter actually narrowed the list, without assuming any specific
    // corpus content produces exactly one match (real corpus term
    // frequency varies as ingestion continues; see spec's point-in-time
    // snapshot caveat).
    const texts = await chipsAfter.allInnerTexts();
    for (const t of texts) {
      expect(t.toLowerCase()).toContain(filterQuery.toLowerCase());
    }

    await chipsAfter.first().click();
    await page.waitForSelector(".definition-card", { timeout: 30000 });
    await expect(page.locator(".definition-card").first()).toBeVisible();
  });
});

test.describe("Divergent terms", () => {
  // Unlike the rest of this file, this describe does NOT require the live
  // backend — every API call the page makes is mocked via page.route, so it
  // runs standalone (no `term-comparison serve` needed) and incurs no LLM
  // cost. The mocked /definitions/quick response deliberately has only one
  // Act so search()'s "fewer than 2 definitions" short-circuit means the
  // paid /definitions (full-summary) endpoint is never called at all.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("act-alike-tour-seen", "1"));
    await page.route("**/stats", (route) =>
      route.fulfill({ json: { acts: 1, defined_terms: 1, multi_act_terms: 0 } }));
    await page.route("**/terms", (route) => route.fulfill({ json: [] }));
    await page.route("**/terms/divergent", (route) =>
      route.fulfill({ json: [{ term: "personal information", difference_count: 2, act_count: 2 }] }));
    await page.route("**/definitions/quick*", (route) =>
      route.fulfill({
        json: {
          term: "personal information",
          definitions: [{
            display_term: "personal information",
            definition_text: "personal information means information about an identified individual.",
            act_title: "Privacy Act 1988",
            act_frbr_uri: "/akn/au/act/1988/119",
            section_eid: "sec-6",
          }],
          difference_summary: null,
          differences: [],
          summary_unverified: false,
        },
      }));
  });

  test("clicking a divergent term reuses the search flow and renders its definitions", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".divergent-terms")).toContainText("Most divergent terms");

    await page.locator(".divergent-term-btn", { hasText: "personal information" }).click();

    await expect(page.locator(".definition-card")).toContainText("Privacy Act 1988");
    await expect(page).toHaveURL(/\/term\/personal/);
  });
});

test.describe("Browse panel height", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("act-alike-tour-seen", "1"));
  });

  // Regression: the panel's max-height was computed from a static vh formula
  // that didn't know the header's or footer's real rendered height, so with
  // no search performed (nothing pushing the page taller than the viewport)
  // expanding the full ~1,550-term list ran the panel past the viewport
  // bottom and forced a page-level scrollbar. See App.vue's updateAsideMaxHeight.
  test("expanding the full term list with no search results causes no page overflow", async ({ page }) => {
    test.setTimeout(30000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await page.click(".term-browser-toggle");
    await page.waitForSelector(".term-chip", { timeout: 10000 });

    const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
    const viewportHeight = await page.evaluate(() => window.innerHeight);
    expect(scrollHeight).toBeLessThanOrEqual(viewportHeight);
  });
});

test.describe("About modal and disclaimer", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("act-alike-tour-seen", "1"));
  });

  test("disclaimer is visible on page load with no interaction", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".disclaimer")).toContainText("Not an official government service");
  });

  test("? button opens the About modal and the close button closes it", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('[data-testid="about-modal"]')).toHaveCount(0);

    await page.locator(".help-btn").click();
    await expect(page.locator('[data-testid="about-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="about-modal"]')).toContainText("How it's built");

    await page.locator('[data-testid="about-close"]').click();
    await expect(page.locator('[data-testid="about-modal"]')).toHaveCount(0);
  });
});

test.describe("First-visit tour", () => {
  // Deliberately no beforeEach here — a fresh Playwright test context already
  // has empty localStorage, which is exactly the "never seen it" state this
  // describe needs. Adding an explicit removeItem() init script would re-run
  // on every navigation (including reload()) and wipe out the app's own
  // markTourSeen() write, breaking the "stays dismissed" assertion below.

  test("auto-starts for a first-time visitor and can be dismissed", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".driver-popover")).toBeVisible();
    await expect(page.locator(".driver-popover-title")).toContainText("Search for a legal term");

    await page.keyboard.press("Escape");
    await expect(page.locator(".driver-popover")).toHaveCount(0);

    // driver.js schedules its destroy callback via requestAnimationFrame, not
    // synchronously with the keypress — poll rather than read once.
    await expect.poll(() => page.evaluate(() => localStorage.getItem("act-alike-tour-seen"))).toBe("1");
  });

  test("does not reappear on a later visit, but 'Take the tour' relaunches it", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Escape");
    await expect(page.locator(".driver-popover")).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => localStorage.getItem("act-alike-tour-seen"))).toBe("1");

    await page.reload();
    await expect(page.locator(".driver-popover")).toHaveCount(0);

    await page.locator(".tour-btn").click();
    await expect(page.locator(".driver-popover")).toBeVisible();
  });
});
