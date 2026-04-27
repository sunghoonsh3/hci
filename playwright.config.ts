import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  timeout: 30000,
  use: {
    baseURL: "https://hci-opal-sigma.vercel.app",
    headless: true,
    screenshot: "only-on-failure",
    video: { mode: "on", size: { width: 1440, height: 900 } },
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
