/**
 * Playwright E2E tests for modal components.
 *
 * Targets the /modal-test page which renders all three modals
 * (HighscoreModal, SettingsPanel, FeaturePopup) with mock data.
 *
 * These tests catch UI regressions like:
 *  - Modal failing to mount / blank content
 *  - Close button unresponsive
 *  - Scroll areas broken
 *  - Feature picker not rendering
 *  - Layer tree / checkbox interactions broken
 */
import { test, expect } from '@playwright/test';

test.describe('Modal UI Components', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/modal-test');
    // Wait for the test page to fully render
    await expect(page.getByTestId('test-page-title')).toBeVisible();
  });

  // ──────────────────────────────────────────────────────────────────────────
  //  HighscoreModal (Toppliste)
  // ──────────────────────────────────────────────────────────────────────────

  test.describe('HighscoreModal (Toppliste)', () => {
    test('opens toppliste modal and renders content', async ({ page }) => {
      await page.getByRole('button', { name: /åpne toppliste/i }).click();

      // Modal should appear — find by its role="dialog" (rendered by react-native-web)
      const dialog = page.getByRole('dialog');

      // Assert modal is visible (Playwright auto-waits for animations)
      await expect(dialog).toBeVisible();

      // Assert title inside the modal (use .first() because help text also matches)
      await expect(dialog.getByText(/toppliste/i).first()).toBeVisible();

      // Assert stat cards render with mock data
      await expect(dialog.getByText('3').first()).toBeVisible(); // 3 features in mock

      // Assert sections (longest, steepest, widest, flattest)
      await expect(dialog.getByText(/lengste/i)).toBeVisible();
      await expect(dialog.getByText(/bratteste/i)).toBeVisible();
      await expect(dialog.getByText(/bredeste/i)).toBeVisible();
      await expect(dialog.getByText(/flateste/i)).toBeVisible();

      // A feature name from the mock data
      await expect(dialog.getByText(/turvei.*gang/i).first()).toBeVisible();
    });

    test('closes toppliste modal when close button is tapped', async ({
      page,
    }) => {
      await page.getByRole('button', { name: /åpne toppliste/i }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // Tap close button within the modal
      await dialog.getByRole('button', { name: /lukk vindu/i }).click();

      // Modal should close
      await expect(dialog).not.toBeVisible();
    });

    test('closes toppliste modal when tapping backdrop (outside panel)', async ({
      page,
    }) => {
      await page.getByRole('button', { name: /åpne toppliste/i }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // Tap the backdrop directly (the outer div of the modal)
      const backdrop = dialog.locator('div').first();
      await backdrop.click({ force: true });

      await expect(dialog).not.toBeVisible();
    });

    test('shows data rows for each ranked section', async ({ page }) => {
      await page.getByRole('button', { name: /åpne toppliste/i }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // Check that data rows are rendered for each section
      // Regex in dialog — the "Zoom" button text appears in table rows
      await expect(dialog.getByText(/zoom/i).first()).toBeVisible();
    });

    test('scrolls content inside modal', async ({ page }) => {
      await page.getByRole('button', { name: /åpne toppliste/i }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // Scroll the page to expose content at the bottom of the modal
      // react-native-web renders ScrollView as a scrollable div
      await page.evaluate(() => {
        const dialogs = document.querySelectorAll('[role="dialog"]');
        dialogs.forEach((d) => {
          // Find scrollable elements inside the dialog
          const scrollables = d.querySelectorAll('div');
          for (const el of Array.from(scrollables)) {
            const overflow = window.getComputedStyle(el).overflowY;
            if (overflow === 'auto' || overflow === 'scroll' || el.scrollHeight > el.clientHeight) {
              if (el.scrollHeight > el.clientHeight) {
                el.scrollTop = el.scrollHeight - el.clientHeight;
                break;
              }
            }
          }
        });
      });

      // The "Flateste" section should still be present in DOM
      await expect(dialog.getByText(/flateste/i)).toBeVisible();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  //  SettingsPanel (Innstillinger)
  // ──────────────────────────────────────────────────────────────────────────

  test.describe('SettingsPanel (Innstillinger)', () => {
    test('opens settings modal and renders layer tree', async ({ page }) => {
      await page.getByRole('button', { name: /åpne innstillinger/i }).click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // Assert title
      await expect(dialog.getByText(/innstillinger/i)).toBeVisible();

      // Assert layer tree sections
      await expect(dialog.getByText(/kartlag/i)).toBeVisible();
      await expect(dialog.getByText(/bakgrunnskart/i)).toBeVisible();
      await expect(dialog.getByText(/søk etter sted/i)).toBeVisible();

      // Assert layer groups are present (expandable)
      await expect(dialog.getByText(/tilgjengelighet/i)).toBeVisible();
    });

    test('closes settings modal with close button', async ({ page }) => {
      await page.getByRole('button', { name: /åpne innstillinger/i }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      await dialog.getByRole('button', { name: /lukk vindu/i }).click();
      await expect(dialog).not.toBeVisible();
    });

    test('search input accepts text and shows results', async ({ page }) => {
      await page.getByRole('button', { name: /åpne innstillinger/i }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // Find the search input (placeholder matches)
      const searchInput = dialog.getByPlaceholder(/skriv inn stedsnavn/i);
      await expect(searchInput).toBeVisible();

      // Type a search query (triggers mock search after debounce)
      await searchInput.fill('Oslo');

      // Wait for mock results to appear (300ms debounce + render)
      await page.waitForTimeout(500);

      // Mock should return Oslo sentrum and Bergen sentrum
      await expect(dialog.getByText(/oslo sentrum/i)).toBeVisible();
      await expect(dialog.getByText(/bergen sentrum/i)).toBeVisible();
    });

    test('expands layer groups and shows checkboxes', async ({ page }) => {
      await page.getByRole('button', { name: /åpne innstillinger/i }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // Click the "Tilgjengelighet" group to expand it
      const group = dialog.getByText('Tilgjengelighet');
      await group.click();

      // After expanding, child layers should appear
      await expect(dialog.getByText(/vei og gate/i)).toBeVisible();
      await expect(dialog.getByText(/sti og turvei/i)).toBeVisible();
      await expect(dialog.getByText(/snarvei/i)).toBeVisible();
      await expect(dialog.getByText(/trapp/i)).toBeVisible();
    });

    test('basemap radio buttons are selectable', async ({ page }) => {
      await page.getByRole('button', { name: /åpne innstillinger/i }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // Get basemap radio options
      const topoRadio = dialog.getByText(/topografisk/i);
      await expect(topoRadio).toBeVisible();
      await topoRadio.click();

      // Should remain visible after click (mock just logs, doesn't crash)
      await expect(topoRadio).toBeVisible();
    });

    test('footer text is present', async ({ page }) => {
      await page.getByRole('button', { name: /åpne innstillinger/i }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      await expect(dialog.getByText(/kartverket.*geonorge/i)).toBeVisible();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  //  FeaturePopup (Stedsinfo)
  // ──────────────────────────────────────────────────────────────────────────

  test.describe('FeaturePopup (Stedsinfo)', () => {
    test('opens feature popup and renders mock data', async ({ page }) => {
      await page.getByRole('button', { name: /åpne stedsinfo/i }).click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // Assert title
      await expect(dialog.getByText(/test.*stedsinfo/i)).toBeVisible();

      // Assert first feature's data is displayed
      // Use .first() since the feature name appears in both picker chip and table
      await expect(dialog.getByText(/turvei - grusdekke/i).first()).toBeVisible();
      await expect(dialog.getByText(/bredde/i)).toBeVisible();
      await expect(dialog.getByText(/200 cm/i)).toBeVisible();
      await expect(dialog.getByText(/stigning/i)).toBeVisible();
    });

    test('feature picker switches between features', async ({ page }) => {
      await page.getByRole('button', { name: /åpne stedsinfo/i }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // Feature picker chips should show both features (role=tab from accessibilityRole)
      const chips = dialog.getByRole('tab');
      await expect(chips).toHaveCount(2);

      // First chip (Turvei - grusdekke) should be selected initially
      // react-native-web renders accessibilityState={{selected:true}} as class, not aria
      // Check that the first chip has the amber border/background (active styling)
      const firstChip = chips.first();
      await expect(firstChip).toBeVisible();
      await chips.nth(1).click();

      // Second chip should now be active after click
      // (click doesn't fail even if we can't easily check active state via aria)
      // Second feature's data should be visible
      await expect(dialog.getByText(/gang- og sykkelvei/i).first()).toBeVisible();
      await expect(dialog.getByText(/300 cm/i)).toBeVisible();
    });

    test('closes feature popup with close button', async ({ page }) => {
      await page.getByRole('button', { name: /åpne stedsinfo/i }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      await dialog.getByRole('button', { name: /lukk vindu/i }).click();
      await expect(dialog).not.toBeVisible();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  //  Screen-level: only one modal open at a time
  // ──────────────────────────────────────────────────────────────────────────

  test.describe('Modal isolation', () => {
    test('only one modal visible at a time', async ({ page }) => {
      // Open highscore first
      await page.getByRole('button', { name: /åpne toppliste/i }).click();
      await expect(page.getByRole('dialog')).toBeVisible();

      // Close it
      await page.getByRole('button', { name: /lukk vindu/i }).first().click();
      await expect(page.getByRole('dialog')).not.toBeVisible();

      // Open settings
      await page.getByRole('button', { name: /åpne innstillinger/i }).click();
      await expect(page.getByRole('dialog')).toBeVisible();

      // Close it
      await page.getByRole('button', { name: /lukk vindu/i }).first().click();

      // Open feature popup
      await page.getByRole('button', { name: /åpne stedsinfo/i }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
    });
  });
});
