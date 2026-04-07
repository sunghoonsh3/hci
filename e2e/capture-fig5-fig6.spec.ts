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

/**
 * Add a course to Plan A by navigating to its detail page and clicking Select.
 * Uses keyword search to find a specific course.
 */
async function addCourseToPlan(
  page: Page,
  keyword: string,
  subject?: string
) {
  const url = subject
    ? `/search?subject=${subject}&keyword=${encodeURIComponent(keyword)}`
    : `/search?keyword=${encodeURIComponent(keyword)}`;
  await page.goto(url);
  await page.waitForSelector("table tbody tr", { timeout: 15000 });

  // Click first result row
  await page.locator("tbody tr").first().click();
  await page.waitForURL(/\/course\/\d+/, { timeout: 10000 });
  await page.waitForSelector("text=Sections", { timeout: 10000 });

  // Click Select on first available section
  const selectBtn = page
    .locator("table")
    .last()
    .locator('button:has-text("Select")')
    .first();
  if (await selectBtn.isVisible()) {
    await selectBtn.click();
    await wait(page, 1500);
  }
}

// ─────────────────────────────────────────────
// Figure 5: Plan View — with calendar events
// Add ACCT 20200 (MTWTh 5:30-7:20pm, seats available)
// Add ACCT 20300 (TWTh 10:30-12:45, seats available)
// ─────────────────────────────────────────────
test("Fig-05 Plan View with Calendar Events", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  // Add ACCT 20200 — has meeting times MTWTh 5:30-7:20pm
  await addCourseToPlan(page, "20200", "ACCT");

  // Add ACCT 20300 — has meeting times TWTh 10:30-12:45
  await addCourseToPlan(page, "20300", "ACCT");

  // Go to Plan page
  await page.goto("/plan");
  await wait(page, 4000); // wait for course data + calendar to render

  await shot(page, "fig-05-plan-view");
});

// ─────────────────────────────────────────────
// Figure 6: Export Results — with partial (blocked course)
// Add ACCT 20200 (eligible, has seats)
// Add ACCT 20100 (full, blocked) via + Plan A from search
// Then export → should show partial: one Transferred, one Not Transferred
// ─────────────────────────────────────────────
test("Fig-06 Export Results with Recovery Buttons", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  // Add ACCT 20200 (eligible)
  await addCourseToPlan(page, "20200", "ACCT");

  // Add a FULL course (ACCT 20100) to Plan A via localStorage injection
  // Since all sections are full, there's no Select button — we inject it directly
  await page.goto("/search");
  await page.waitForSelector("table tbody tr", { timeout: 15000 });

  // Find the course ID for ACCT 20100 by navigating to it
  await page.goto("/search?subject=ACCT&keyword=20100");
  await page.waitForSelector("table tbody tr", { timeout: 15000 });
  await page.locator("tbody tr").first().click();
  await page.waitForURL(/\/course\/\d+/, { timeout: 10000 });

  // Extract course ID from URL
  const courseUrl = page.url();
  const courseId = parseInt(courseUrl.match(/\/course\/(\d+)/)?.[1] ?? "0");

  if (courseId > 0) {
    // Inject plan entry into localStorage (with a fake section ID from this course)
    await page.evaluate((cid) => {
      const key = "registration-clarity-plans";
      const plans = JSON.parse(localStorage.getItem(key) || "[]");
      // Add with a section ID — we'll use course detail to find a real one
      plans.push({ courseId: cid, sectionId: cid * 100 + 1, planSlot: "A" });
      localStorage.setItem(key, JSON.stringify(plans));
    }, courseId);
    await wait(page, 500);

    // Actually, let's get a real section ID from the page
    const sectionId = await page.evaluate(() => {
      // Find the first section's ID from the sections table
      const rows = document.querySelectorAll("table:last-of-type tbody tr");
      if (rows.length > 0) {
        // The section ID is in the data — find it from the Select/Full buttons
        return null; // Can't easily get it this way
      }
      return null;
    });

    // Simpler: use the API to get a section ID
    const response = await page.evaluate(async (cid) => {
      const res = await fetch(`/api/course/${cid}`);
      const data = await res.json();
      return data.sections?.[0]?.id ?? null;
    }, courseId);

    if (response) {
      await page.evaluate(
        ({ cid, sid }) => {
          const key = "registration-clarity-plans";
          let plans = JSON.parse(localStorage.getItem(key) || "[]");
          // Remove any bad entry we added
          plans = plans.filter(
            (p: { courseId: number }) => p.courseId !== cid || plans.indexOf(p) < plans.length - 1
          );
          // Remove the fake one
          plans = plans.filter(
            (p: { sectionId: number }) => p.sectionId !== cid * 100 + 1
          );
          plans.push({ courseId: cid, sectionId: sid, planSlot: "A" });
          localStorage.setItem(key, JSON.stringify(plans));
        },
        { cid: courseId, sid: response }
      );
    }
  }

  // Go to export
  await page.goto("/export");
  await wait(page, 2000);

  // Run pre-check
  const runBtn = page.locator('button:has-text("Run Pre-check")');
  if (await runBtn.isVisible()) {
    await runBtn.click();
    await wait(page, 3000);

    // Export eligible only (should show partial results)
    const exportBtn = page.locator(
      'button:has-text("Export Eligible"), button:has-text("Export All")'
    );
    if ((await exportBtn.count()) > 0) {
      await exportBtn.first().click();
      await wait(page, 2000);
    }
  }

  await shot(page, "fig-06-export-results");
});
