import { test, expect, type Page } from "@playwright/test";

// =============================================================================
// Registration Clarity — End-to-End Tests
//
// Tests the 5 core task flows from Sprint 2:
//   1. Discover — Search for courses, view eligibility, see requirement badges
//   2. Plan     — Add courses to Plan A/B/C, view weekly schedule, manage plan
//   3. Verify   — Pre-check modal, prerequisite display, blocked course handling
//   4. Register — Export plan to NOVO, pre-check diagnostics, export results
//   5. Recover  — Recovery drawer, swap sections, find alternatives
// =============================================================================

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function goToSearch(page: Page) {
  await page.goto("/search");
  await page.waitForSelector("table tbody tr", { timeout: 15000 });
}

async function searchFor(page: Page, keyword: string) {
  await page.fill('input[placeholder="Search courses..."]', keyword);
  await page.click("button:has-text('Search')");
  await page.waitForSelector("table tbody tr", { timeout: 15000 });
}

async function goToCourseDetail(page: Page) {
  await goToSearch(page);
  await page.locator("table tbody tr").first().click();
  await page.waitForSelector("h1", { timeout: 10000 });
}

function getResultCount(text: string | null): number {
  return parseInt(text?.match(/(\d+)\s*course/)?.[1] ?? "0");
}

// =============================================================================
// FLOW 1: DISCOVER
// =============================================================================

test.describe("Flow 1: Discover — Search and explore courses", () => {
  test("1.1 Homepage redirects to /search", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/search/);
  });

  test("1.2 Search page loads with correct table columns", async ({
    page,
  }) => {
    await goToSearch(page);

    const headers = await page.locator("thead th").allTextContents();
    expect(headers).toContain("Course");
    expect(headers).toContain("Title");
    expect(headers).toContain("Status");
    expect(headers).toContain("Seats");
    expect(headers).toContain("Reqs");
    expect(headers).toContain("Actions");

    await expect(page.locator("text=/\\d+ course/")).toBeVisible();
  });

  test("1.3 Weekly Schedule panel is visible on search page", async ({
    page,
  }) => {
    await goToSearch(page);
    await expect(page.locator("text=Weekly Schedule")).toBeVisible();
  });

  test("1.4 Subject filter narrows results", async ({ page }) => {
    await goToSearch(page);

    const allText = await page.locator("text=/\\d+ course/").textContent();
    const allCount = getResultCount(allText);

    // Select CSE from subject dropdown
    await page.locator("select").first().selectOption("CSE");
    await page.click("button:has-text('Search')");
    await page.waitForSelector("table tbody tr", { timeout: 15000 });

    const filteredText = await page
      .locator("text=/\\d+ course/")
      .textContent();
    const filteredCount = getResultCount(filteredText);

    expect(filteredCount).toBeLessThan(allCount);
    expect(filteredCount).toBeGreaterThan(0);
  });

  test("1.5 Keyword search works (case-insensitive)", async ({ page }) => {
    await goToSearch(page);
    await searchFor(page, "data structures");

    const text = await page.locator("text=/\\d+ course/").textContent();
    expect(getResultCount(text)).toBeGreaterThan(0);
  });

  test("1.6 Eligibility badges are displayed", async ({ page }) => {
    await goToSearch(page);

    const badges = page.locator(
      '.rounded-full:has-text("Eligible"), .rounded-full:has-text("Full"), .rounded-full:has-text("Restricted"), .rounded-full:has-text("Needs Prereq"), .rounded-full:has-text("Taken")'
    );
    expect(await badges.count()).toBeGreaterThan(0);
  });

  test("1.7 Core requirements filter works", async ({ page }) => {
    await goToSearch(page);
    await page.locator("select").first().selectOption("CSE");
    await page.click("button:has-text('Search')");
    await page.waitForSelector("table tbody tr", { timeout: 15000 });

    const beforeText = await page.locator("text=/\\d+ course/").textContent();
    const before = getResultCount(beforeText);

    await page.locator("label", { hasText: "Core requirements" }).click();

    const afterText = await page.locator("text=/\\d+ course/").textContent();
    const after = getResultCount(afterText);

    expect(after).toBeLessThanOrEqual(before);
  });

  test("1.8 + Plan A button visible in search results", async ({ page }) => {
    await goToSearch(page);
    expect(
      await page.locator('button:has-text("+ Plan A")').count()
    ).toBeGreaterThan(0);
  });

  test("1.9 Clicking row navigates to course detail", async ({ page }) => {
    await goToCourseDetail(page);
    await expect(page).toHaveURL(/\/course\/\d+/);
    await expect(page.locator("h1")).toBeVisible();
  });
});

// =============================================================================
// FLOW 2: PLAN
// =============================================================================

test.describe("Flow 2: Plan — Build and manage course plans", () => {
  test("2.1 + Plan A adds course and shows toast", async ({ page }) => {
    await goToSearch(page);
    await page.locator('button:has-text("+ Plan A")').first().click();
    await expect(page.locator("text=/added to Plan A/")).toBeVisible({
      timeout: 5000,
    });
  });

  test("2.2 Select button in course detail adds to plan", async ({
    page,
  }) => {
    await goToCourseDetail(page);

    const selectBtn = page
      .locator("table")
      .last()
      .locator('button:has-text("Select")')
      .first();
    if (await selectBtn.isVisible()) {
      await selectBtn.click();
      await expect(page.locator("text=/added to Plan/")).toBeVisible({
        timeout: 5000,
      });
    }
  });

  test("2.3 Plan page — correct table columns", async ({ page }) => {
    // Add course first
    await goToSearch(page);
    await page.locator('button:has-text("+ Plan A")').first().click();
    await page.waitForTimeout(1000);

    await page.goto("/plan");
    await page.waitForTimeout(2000);

    const headers = await page.locator("main thead th").allTextContents();
    expect(headers).toContain("Course");
    expect(headers).toContain("Title");
    expect(headers).toContain("Credits");
    expect(headers).toContain("Status");
    expect(headers).toContain("Reqs");
    expect(headers).toContain("Actions");
  });

  test("2.4 Plan page — A/B/C tabs visible", async ({ page }) => {
    await page.goto("/plan");

    // Use main area buttons (not sidebar)
    const mainArea = page.locator("main");
    await expect(
      mainArea.locator("button", { hasText: /Plan A/ })
    ).toBeVisible();
    await expect(
      mainArea.locator("button", { hasText: /Plan B/ })
    ).toBeVisible();
    await expect(
      mainArea.locator("button", { hasText: /Plan C/ })
    ).toBeVisible();
  });

  test("2.5 Plan page — Weekly Schedule visible", async ({ page }) => {
    await page.goto("/plan");
    await expect(page.locator("text=Weekly Schedule")).toBeVisible();
  });

  test("2.6 Plan page — Show All Plans + color legend", async ({ page }) => {
    await page.goto("/plan");
    const checkbox = page.locator("label", {
      hasText: "Show all plans",
    });
    await expect(checkbox).toBeVisible();
    await checkbox.click();

    // Legend should appear (plan color dots)
    await expect(page.locator("text=Plan A").last()).toBeVisible();
  });

  test("2.7 Plan page — Remove and Options actions", async ({ page }) => {
    await goToSearch(page);
    await page.locator('button:has-text("+ Plan A")').first().click();
    await page.waitForTimeout(1000);
    await page.goto("/plan");
    await page.waitForTimeout(2000);

    const removeBtn = page.locator("main").locator('button:has-text("Remove")');
    const optionsBtn = page
      .locator("main")
      .locator('button:has-text("Options")');

    if ((await removeBtn.count()) > 0) {
      await expect(removeBtn.first()).toBeVisible();
      await expect(optionsBtn.first()).toBeVisible();
    }
  });

  test("2.8 Plan page — Export to NOVO link visible", async ({ page }) => {
    await page.goto("/plan");
    await expect(page.locator("text=Export to NOVO")).toBeVisible();
  });
});

// =============================================================================
// FLOW 3: VERIFY
// =============================================================================

test.describe("Flow 3: Verify — Pre-check and eligibility validation", () => {
  test("3.1 Pre-check modal shows 6-item checklist", async ({ page }) => {
    await goToCourseDetail(page);

    await page.locator('button:has-text("Pre-check")').click();
    await page.waitForTimeout(1000);

    // Modal title
    await expect(
      page.locator("text=Pre-Registration Check")
    ).toBeVisible();

    // Check items
    for (const label of [
      "Prerequisites",
      "Class Standing",
      "Seat Availability",
      "Time Conflicts",
      "Repeat Check",
      "Permission",
    ]) {
      await expect(page.locator(`text=${label}`).first()).toBeVisible();
    }
  });

  test("3.2 Pre-check shows Eligible or Blocked banner", async ({ page }) => {
    await goToCourseDetail(page);
    await page.locator('button:has-text("Pre-check")').click();
    await page.waitForTimeout(1000);

    // The modal should have either "Eligible" or "Blocked" text
    const text = await page.locator(".fixed .bg-white").textContent();
    expect(text?.includes("Eligible") || text?.includes("Blocked")).toBe(true);
  });

  test("3.3 Close button dismisses pre-check modal", async ({ page }) => {
    await goToCourseDetail(page);
    await page.locator('button:has-text("Pre-check")').click();
    await page.waitForTimeout(500);
    await expect(
      page.locator("text=Pre-Registration Check")
    ).toBeVisible();

    await page.locator('button:has-text("Close")').click();
    await expect(
      page.locator("text=Pre-Registration Check")
    ).not.toBeVisible();
  });

  test("3.4 Quick Info panel visible on course detail", async ({ page }) => {
    await goToCourseDetail(page);
    await expect(page.locator("text=Quick Info")).toBeVisible();
  });

  test("3.5 Availability bar visible", async ({ page }) => {
    await goToCourseDetail(page);
    await expect(page.locator("text=Availability")).toBeVisible();
    await expect(page.locator("text=/\\d+\\/\\d+ seats/")).toBeVisible();
  });

  test("3.6 Register button visible on course detail", async ({ page }) => {
    await goToCourseDetail(page);

    // Should have either "Register" or "Register (Blocked)" button
    const count = await page
      .locator('button', { hasText: /^Register/ })
      .count();
    expect(count).toBeGreaterThan(0);
  });

  test("3.7 Blocked course shows banner with inline actions", async ({
    page,
  }) => {
    await goToSearch(page);

    // Click a Full course
    const fullRow = page
      .locator("tr", { has: page.locator('.rounded-full:has-text("Full")') })
      .first();
    if (await fullRow.isVisible()) {
      await fullRow.click();
      await page.waitForSelector("h1", { timeout: 10000 });

      await expect(page.locator("text=Registration Blocked")).toBeVisible();
      await expect(
        page.locator('button:has-text("Why?")').first()
      ).toBeVisible();
    }
  });

  test("3.8 Blocked course shows Official Next Steps", async ({ page }) => {
    await goToSearch(page);

    const fullRow = page
      .locator("tr", { has: page.locator('.rounded-full:has-text("Full")') })
      .first();
    if (await fullRow.isVisible()) {
      await fullRow.click();
      await page.waitForSelector("h1", { timeout: 10000 });

      await expect(page.locator("text=Official Next Steps")).toBeVisible();
    }
  });
});

// =============================================================================
// FLOW 4: REGISTER (Export to NOVO)
// =============================================================================

test.describe("Flow 4: Register — Export plan to NOVO", () => {
  test.beforeEach(async ({ page }) => {
    await goToSearch(page);
    const btn = page.locator('button:has-text("+ Plan A")').first();
    if (await btn.isVisible()) {
      await btn.click();
      await page.waitForTimeout(1000);
    }
  });

  test("4.1 Export page loads with plan tabs", async ({ page }) => {
    await page.goto("/export");
    await expect(page.locator("text=Export to NOVO")).toBeVisible();

    // Use main area to avoid sidebar duplicates
    const main = page.locator("main");
    await expect(main.locator("button", { hasText: /Plan A/ })).toBeVisible();
    await expect(main.locator("button", { hasText: /Plan B/ })).toBeVisible();
    await expect(main.locator("button", { hasText: /Plan C/ })).toBeVisible();
  });

  test("4.2 Run Pre-check shows diagnostics", async ({ page }) => {
    await page.goto("/export");

    const runBtn = page.locator('button:has-text("Run Pre-check")');
    if (await runBtn.isVisible()) {
      await runBtn.click();
      await page.waitForTimeout(3000);

      // Should show course rows with status
      const rows = page.locator("table tbody tr");
      expect(await rows.count()).toBeGreaterThan(0);
    }
  });

  test("4.3 Export triggers results view", async ({ page }) => {
    await page.goto("/export");

    const runBtn = page.locator('button:has-text("Run Pre-check")');
    if (await runBtn.isVisible()) {
      await runBtn.click();
      await page.waitForTimeout(3000);

      const exportBtn = page.locator(
        'button:has-text("Export All"), button:has-text("Export Eligible")'
      );
      if ((await exportBtn.count()) > 0) {
        await exportBtn.first().click();
        await page.waitForTimeout(1000);

        await expect(page.locator("text=Results")).toBeVisible();
      }
    }
  });

  test("4.4 Export results show Back to Plan link", async ({ page }) => {
    await page.goto("/export");
    const runBtn = page.locator('button:has-text("Run Pre-check")');
    if (await runBtn.isVisible()) {
      await runBtn.click();
      await page.waitForTimeout(3000);

      const exportBtn = page.locator(
        'button:has-text("Export All"), button:has-text("Export Eligible")'
      );
      if ((await exportBtn.count()) > 0) {
        await exportBtn.first().click();
        await page.waitForTimeout(1000);
        await expect(page.locator("text=Back to Plan")).toBeVisible();
      }
    }
  });
});

// =============================================================================
// FLOW 5: RECOVER
// =============================================================================

test.describe("Flow 5: Recover — Handle blocked courses", () => {
  test("5.1 Recovery Options drawer opens with 4 options", async ({
    page,
  }) => {
    await goToSearch(page);

    const fullRow = page
      .locator("tr", { has: page.locator('.rounded-full:has-text("Full")') })
      .first();
    if (await fullRow.isVisible()) {
      await fullRow.click();
      await page.waitForSelector("h1", { timeout: 10000 });

      const btn = page.locator('button:has-text("Recovery Options")');
      if (await btn.isVisible()) {
        await btn.click();
        await page.waitForTimeout(500);

        await expect(page.locator("text=Swap Section").first()).toBeVisible();
        await expect(
          page.locator("text=Find Alternatives").first()
        ).toBeVisible();
        await expect(
          page.locator("text=Move to Plan B").first()
        ).toBeVisible();
        await expect(
          page.locator("text=Request Permission").first()
        ).toBeVisible();
      }
    }
  });

  test("5.2 Swap Section shows sections table", async ({ page }) => {
    await goToSearch(page);

    const fullRow = page
      .locator("tr", { has: page.locator('.rounded-full:has-text("Full")') })
      .first();
    if (await fullRow.isVisible()) {
      await fullRow.click();
      await page.waitForSelector("h1", { timeout: 10000 });

      const btn = page.locator('button:has-text("Recovery Options")');
      if (await btn.isVisible()) {
        await btn.click();
        await page.waitForTimeout(500);

        // Click "Swap Section" card
        await page
          .locator("button", { hasText: "Swap Section" })
          .first()
          .click();
        await page.waitForTimeout(500);

        expect(await page.locator("table tbody tr").count()).toBeGreaterThan(0);
      }
    }
  });

  test("5.3 Request Permission shows email draft", async ({ page }) => {
    await goToSearch(page);

    const fullRow = page
      .locator("tr", { has: page.locator('.rounded-full:has-text("Full")') })
      .first();
    if (await fullRow.isVisible()) {
      await fullRow.click();
      await page.waitForSelector("h1", { timeout: 10000 });

      const btn = page.locator('button:has-text("Recovery Options")');
      if (await btn.isVisible()) {
        await btn.click();
        await page.waitForTimeout(500);

        await page
          .locator("button", { hasText: "Request Permission" })
          .first()
          .click();
        await page.waitForTimeout(500);

        await expect(
          page.locator("text=Permission Request Draft")
        ).toBeVisible();
        await expect(
          page.locator('input[value*="Permission to enroll"]')
        ).toBeVisible();
      }
    }
  });

  test("5.4 Blocked banner — Move to Plan B shows toast", async ({
    page,
  }) => {
    await goToSearch(page);

    const fullRow = page
      .locator("tr", { has: page.locator('.rounded-full:has-text("Full")') })
      .first();
    if (await fullRow.isVisible()) {
      await fullRow.click();
      await page.waitForSelector("h1", { timeout: 10000 });

      const moveBtn = page.locator('button:has-text("Move to Plan B")');
      if (await moveBtn.isVisible()) {
        await moveBtn.click();
        await expect(page.locator("text=/moved to Plan B/")).toBeVisible({
          timeout: 5000,
        });
      }
    }
  });

  test("5.5 Blocked banner — Find Alternatives navigates to search", async ({
    page,
  }) => {
    await goToSearch(page);

    const fullRow = page
      .locator("tr", { has: page.locator('.rounded-full:has-text("Full")') })
      .first();
    if (await fullRow.isVisible()) {
      await fullRow.click();
      await page.waitForSelector("h1", { timeout: 10000 });

      const link = page.locator('a:has-text("Find Alternatives")');
      if (await link.isVisible()) {
        await link.click();
        await expect(page).toHaveURL(/\/search\?subject=/);
      }
    }
  });
});

// =============================================================================
// SIDEBAR & NAVBAR
// =============================================================================

test.describe("Sidebar & Navbar — Shared components", () => {
  test("S.1 Navbar shows PATH, Search/Plan/Export tabs, user name", async ({
    page,
  }) => {
    await page.goto("/search");
    await expect(page.locator("nav >> text=PATH")).toBeVisible();
    await expect(page.locator('nav a:has-text("Search")')).toBeVisible();
    await expect(page.locator('nav a:has-text("Plan")')).toBeVisible();
    await expect(page.locator('nav a:has-text("Export")')).toBeVisible();
    await expect(page.locator("nav >> text=Alex Murphy")).toBeVisible();
  });

  test("S.2 Sidebar shows Term, My Plans, GPS", async ({ page }) => {
    await page.goto("/search");
    await page.waitForTimeout(2000);

    const sidebar = page.locator("aside");
    await expect(sidebar.locator("text=Summer 2026")).toBeVisible();
    await expect(sidebar.locator("text=My Plans")).toBeVisible();
    await expect(sidebar.locator("text=My GPS")).toBeVisible();
  });

  test("S.3 Sidebar Plan tabs A/B/C", async ({ page }) => {
    await page.goto("/search");
    await page.waitForTimeout(2000);

    const sidebar = page.locator("aside");
    await expect(sidebar.locator("button", { hasText: /Plan A/ })).toBeVisible();
    await expect(sidebar.locator("button", { hasText: /Plan B/ })).toBeVisible();
    await expect(sidebar.locator("button", { hasText: /Plan C/ })).toBeVisible();
  });
});
