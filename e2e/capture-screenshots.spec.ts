import { test, type Page } from "@playwright/test";
import path from "path";

const DIR = path.resolve("docs/sprint3/screenshots");

async function wait(page: Page, ms = 2000) {
  await page.waitForTimeout(ms);
}

async function shot(page: Page, name: string) {
  await page.screenshot({
    path: path.join(DIR, `${name}.png`),
    fullPage: false,
  });
}

// ─────────────────────────────────────────────
// Figure X.11: Onboarding
// ─────────────────────────────────────────────
test("Fig-11 Onboarding", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/onboarding");
  await wait(page);
  await shot(page, "fig-11-onboarding");
});

// ─────────────────────────────────────────────
// Figure X.1: Search Results (Homepage)
// ─────────────────────────────────────────────
test("Fig-01 Search Results", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/search");
  await page.waitForSelector("table tbody tr", { timeout: 15000 });
  await wait(page);
  await shot(page, "fig-01-search-results");
});

// ─────────────────────────────────────────────
// Figure X.1b: Search Results filtered by CSE
// ─────────────────────────────────────────────
test("Fig-01b Search Filtered CSE", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/search?subject=CSE");
  await page.waitForSelector("table tbody tr", { timeout: 15000 });
  await wait(page);
  await shot(page, "fig-01b-search-cse");
});

// ─────────────────────────────────────────────
// Figure X.2: Course Detail — Eligible
// ─────────────────────────────────────────────
test("Fig-02 Course Detail Eligible", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/search?subject=CSE");
  await page.waitForSelector("table tbody tr", { timeout: 15000 });

  // Find an Eligible course and click it
  const eligibleRow = page
    .locator("tr", {
      has: page.locator('.rounded-full:has-text("Eligible")'),
    })
    .first();
  if (await eligibleRow.isVisible()) {
    await eligibleRow.click();
  } else {
    await page.locator("tbody tr").first().click();
  }
  await page.waitForURL(/\/course\/\d+/, { timeout: 10000 });
  await page.waitForSelector("text=Sections", { timeout: 10000 });
  await wait(page);
  await shot(page, "fig-02-course-detail-eligible");

  // Scroll down to see Guidance / Course Path if present
  await page.evaluate(() => window.scrollTo(0, 600));
  await wait(page, 1000);
  await shot(page, "fig-02b-course-detail-eligible-scrolled");
});

// ─────────────────────────────────────────────
// Figure X.3: Course Detail — Blocked (Full)
// ─────────────────────────────────────────────
test("Fig-03 Course Detail Blocked", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/search");
  await page.waitForSelector("table tbody tr", { timeout: 15000 });

  const fullRow = page
    .locator("tr", {
      has: page.locator('.rounded-full:has-text("Full")'),
    })
    .first();
  await fullRow.click();
  await page.waitForURL(/\/course\/\d+/, { timeout: 10000 });
  await page.waitForSelector("text=Registration Blocked", { timeout: 10000 });
  await wait(page);
  await shot(page, "fig-03-course-detail-blocked");

  // Scroll down to see sections + Official Next Steps
  await page.evaluate(() => window.scrollTo(0, 400));
  await wait(page, 1000);
  await shot(page, "fig-03b-course-detail-blocked-scrolled");
});

// ─────────────────────────────────────────────
// Figure X.4: Pre-Registration Check Modal
// ─────────────────────────────────────────────
test("Fig-04 Pre-Check Modal", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/search?subject=CSE");
  await page.waitForSelector("table tbody tr", { timeout: 15000 });
  await page.locator("tbody tr").first().click();
  await page.waitForURL(/\/course\/\d+/, { timeout: 10000 });
  await page.waitForSelector('button:has-text("Pre-check")', {
    timeout: 10000,
  });

  await page.click('button:has-text("Pre-check")');
  await page.waitForSelector("text=Pre-Registration Check", { timeout: 5000 });
  await wait(page, 1500);
  await shot(page, "fig-04-precheck-modal");
});

// ─────────────────────────────────────────────
// Figure X.5: Plan View (with courses)
// ─────────────────────────────────────────────
test("Fig-05 Plan View", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  // Add a course to Plan A first
  await page.goto("/search?subject=CSE");
  await page.waitForSelector("table tbody tr", { timeout: 15000 });
  const addBtn = page.locator('button:has-text("+ Plan A")').first();
  if (await addBtn.isVisible()) {
    await addBtn.click();
    await page.waitForTimeout(1500);
  }

  // Add a second course
  await page.goto("/search?subject=ACMS");
  await page.waitForSelector("table tbody tr", { timeout: 15000 });
  const addBtn2 = page.locator('button:has-text("+ Plan A")').first();
  if (await addBtn2.isVisible()) {
    await addBtn2.click();
    await page.waitForTimeout(1500);
  }

  // Navigate to Plan page
  await page.goto("/plan");
  await wait(page, 3000);
  await shot(page, "fig-05-plan-view");
});

// ─────────────────────────────────────────────
// Figure X.6: Plan View — Show All Plans + Legend
// ─────────────────────────────────────────────
test("Fig-06 Plan Show All Plans", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  // Add course to Plan A
  await page.goto("/search?subject=CSE");
  await page.waitForSelector("table tbody tr", { timeout: 15000 });
  const btn = page.locator('button:has-text("+ Plan A")').first();
  if (await btn.isVisible()) {
    await btn.click();
    await page.waitForTimeout(1000);
  }

  await page.goto("/plan");
  await wait(page, 3000);

  // Check "Show all plans"
  const checkbox = page.locator("label", { hasText: /show all plans/i });
  if (await checkbox.isVisible()) {
    await checkbox.click();
    await wait(page, 1000);
  }
  await shot(page, "fig-06-plan-show-all");
});

// ─────────────────────────────────────────────
// Figure X.7: Export Pre-Check
// ─────────────────────────────────────────────
test("Fig-07 Export Pre-Check", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  // Add course
  await page.goto("/search?subject=CSE");
  await page.waitForSelector("table tbody tr", { timeout: 15000 });
  const btn = page.locator('button:has-text("+ Plan A")').first();
  if (await btn.isVisible()) {
    await btn.click();
    await page.waitForTimeout(1000);
  }

  await page.goto("/export");
  await wait(page, 1500);

  const runBtn = page.locator('button:has-text("Run Pre-check")');
  if (await runBtn.isVisible()) {
    await runBtn.click();
    await wait(page, 3000);
    await shot(page, "fig-07-export-precheck");
  }
});

// ─────────────────────────────────────────────
// Figure X.8: Export Results
// ─────────────────────────────────────────────
test("Fig-08 Export Results", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  // Add course
  await page.goto("/search?subject=CSE");
  await page.waitForSelector("table tbody tr", { timeout: 15000 });
  const btn = page.locator('button:has-text("+ Plan A")').first();
  if (await btn.isVisible()) {
    await btn.click();
    await page.waitForTimeout(1000);
  }

  await page.goto("/export");
  await wait(page, 1500);

  const runBtn = page.locator('button:has-text("Run Pre-check")');
  if (await runBtn.isVisible()) {
    await runBtn.click();
    await wait(page, 3000);

    const exportBtn = page.locator(
      'button:has-text("Export All"), button:has-text("Export Eligible")'
    );
    if ((await exportBtn.count()) > 0) {
      await exportBtn.first().click();
      await wait(page, 2000);
      await shot(page, "fig-08-export-results");
    }
  }
});

// ─────────────────────────────────────────────
// Figure X.9: Recovery Drawer — Options + Swap Section
// ─────────────────────────────────────────────
test("Fig-09 Recovery Drawer", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/search");
  await page.waitForSelector("table tbody tr", { timeout: 15000 });

  const fullRow = page
    .locator("tr", {
      has: page.locator('.rounded-full:has-text("Full")'),
    })
    .first();
  await fullRow.click();
  await page.waitForURL(/\/course\/\d+/, { timeout: 10000 });
  await page.waitForSelector("text=Recovery Options", { timeout: 10000 });

  await page.click('button:has-text("Recovery Options")');
  await wait(page, 1000);
  await shot(page, "fig-09a-recovery-options");

  // Click Swap Section
  await page.locator("button", { hasText: "Swap Section" }).first().click();
  await wait(page, 1000);
  await shot(page, "fig-09b-swap-section");
});

// ─────────────────────────────────────────────
// Figure X.10: Recovery Drawer — Request Permission
// ─────────────────────────────────────────────
test("Fig-10 Request Permission", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/search");
  await page.waitForSelector("table tbody tr", { timeout: 15000 });

  const fullRow = page
    .locator("tr", {
      has: page.locator('.rounded-full:has-text("Full")'),
    })
    .first();
  await fullRow.click();
  await page.waitForURL(/\/course\/\d+/, { timeout: 10000 });
  await page.waitForSelector("text=Recovery Options", { timeout: 10000 });

  await page.click('button:has-text("Recovery Options")');
  await wait(page, 500);

  await page
    .locator("button", { hasText: "Request Permission" })
    .first()
    .click();
  await wait(page, 1000);
  await shot(page, "fig-10-request-permission");
});
