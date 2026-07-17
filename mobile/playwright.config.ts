import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for Expo Web E2E tests.
 *
 * Includes two project suites:
 *  - chromium:     existing modal UI functional tests (modals.spec.ts)
 *  - chromium-a11y: axe-core WCAG 2.3 AAA accessibility audit (a11y.spec.ts)
 *
 * Both target the static web export (npx expo export --platform web)
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
    /* ── Chromium: existing modal UI tests ─────────────────────── */
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /modals\.spec\.ts/,
    },
    /* ── Chromium A11y: axe-core WCAG 2.3 AAA audit ────────────── */
    {
      name: 'chromium-a11y',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /a11y\.spec\.ts/,
    },
  ],
});
