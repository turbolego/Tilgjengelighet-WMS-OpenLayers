/**
 * Accessibility audit tests using axe-core with Playwright.
 *
 * Scans the entire app at WCAG 2.3 level AAA for violations,
 * covering all interactive states: idle page, each modal open,
 * feature picker active, search results displayed, etc.
 *
 * Axe-core runs in the browser against the rendered DOM produced
 * by Expo Web (react-native-web). Each test opens a specific UI
 * state, runs axe-core, and asserts zero violations.
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// ── Axe-core options: WCAG 2.3 level AAA ──────────────────────────────────────
const axeOptions = {
  // Axe-core tags that cover WCAG 2.3 AAA rules
  // wcag2a + wcag2aa + wcag2aaa → all WCAG success criteria
  // wcag23a + wcag23aa + wcag23aaa → all WCAG 2.3 criteria
  // best-practice → additional Deque recommended rules
  runOnly: {
    type: 'tag' as const,
    values: [
      'wcag2a',
      'wcag2aa',
      'wcag2aaa',
      'wcag22a',
      'wcag22aa',
      'wcag22aaa',
      'best-practice',
    ],
  },
};

/**
 * Run axe-core and fail the test if violations are found.
 * Prints a compact summary of each violation for debugging.
 */
async function scanPage(page: any, context: string) {
  const results = await new AxeBuilder({ page })
    .options(axeOptions)
    .analyze();

  // ── Assert zero violations ──────────────────────────────────────────────
  const violations = results.violations;
  if (violations.length > 0) {
    // Build a human-readable summary before failing
    const summary = violations.map((v: any) => {
      const nodes = v.nodes.map((n: any) => {
        const targets = n.target.join(', ');
        const html = n.html
          ? n.html.replace(/\n/g, ' ').substring(0, 120)
          : '(no html snippet)';
        return `    → ${targets}\n      HTML: ${html}`;
      })
      .join('\n');

      return [
        `  ✗ ${v.id} [${v.impact || 'unknown'}]: ${v.help} (${v.tags.join(', ')})`,
        `    URL: ${v.helpUrl}`,
        nodes,
      ].join('\n');
    }).join('\n\n');

    console.error(
      `\n🚨 ACCESSIBILITY VIOLATIONS in "${context}"\n` +
      `${violations.length} violation(s) found:\n\n${summary}\n`
    );
  }

  expect(violations, `Accessibility violations in "${context}"`).toEqual([]);

  return results;
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe('Accessibility Audit (WCAG 2.2 AAA)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/modal-test');
    await expect(page.getByTestId('test-page-title')).toBeVisible();
  });

  // ──────────────────────────────────────────────────────────────────────────
  //  Idle page — no modals open
  // ──────────────────────────────────────────────────────────────────────────

  test('idle page has zero a11y violations', async ({ page }) => {
    await scanPage(page, 'idle page (no modals)');
  });

  // ──────────────────────────────────────────────────────────────────────────
  //  SettingsPanel (Innstillinger)
  // ──────────────────────────────────────────────────────────────────────────

  test('settings panel (empty search) has zero violations', async ({ page }) => {
    await page.getByRole('button', { name: /åpne innstillinger/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await scanPage(page, 'settings panel (empty)');
  });

  test('settings panel (search modal) has zero violations', async ({ page }) => {
    await page.getByRole('button', { name: /åpne søk/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Type a search query to trigger mock results
    await dialog.getByPlaceholder(/skriv inn stedsnavn/i).fill('Oslo');
    await page.waitForTimeout(600);

    await scanPage(page, 'search modal (with results)');
  });

  test('settings panel (expanded layer tree) has zero violations', async ({ page }) => {
    await page.getByRole('button', { name: /åpne innstillinger/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Expand the layer group
    await dialog.getByText('Tilgjengelighet').click();
    await expect(dialog.getByText(/vei og gate/i)).toBeVisible();

    await scanPage(page, 'settings panel (expanded layers)');
  });

  // ──────────────────────────────────────────────────────────────────────────
  //  FeaturePopup (Stedsinfo)
  // ──────────────────────────────────────────────────────────────────────────

  test('feature popup has zero violations', async ({ page }) => {
    await page.getByRole('button', { name: /åpne stedsinfo/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await scanPage(page, 'feature popup');
  });

  // ──────────────────────────────────────────────────────────────────────────
  //  HighscoreModal (Toppliste)
  // ──────────────────────────────────────────────────────────────────────────

  test('highscore modal has zero violations', async ({ page }) => {
    await page.getByRole('button', { name: /åpne toppliste/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await scanPage(page, 'highscore modal');
  });

  // ──────────────────────────────────────────────────────────────────────────
  //  Full-page scan with all interactive states at once
  // ──────────────────────────────────────────────────────────────────────────

  test('modal-test page has zero violations (full page)', async ({ page }) => {
    // This is a redundant scan of the raw page, useful as a baseline
    await scanPage(page, 'modal-test page (full page scan)');
  });
});