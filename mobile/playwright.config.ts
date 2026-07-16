import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for Expo Web E2E tests.
 *
 * Tests target the static web export (npx expo export --platform web)
 * served locally.  The webServer block auto-starts the server.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    viewport: { width: 1280, height: 800 },
    actionTimeout: 10_000,
  },

  /* ── Web server: serve static export ──────────────────────────── */
  webServer: {
    command: 'npx serve dist -l 3000 --no-clipboard --single',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
