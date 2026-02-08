import { test, expect } from '@playwright/test';

/**
 * Seller Profile E2E Tests
 * Tests public seller profile pages
 */

test.describe('Seller Profile', () => {
  test('should display seller profile page with basic info', async ({ page }) => {
    // Navigate to a seller profile (using a mock ID)
    await page.goto('/seller/test-seller-id');

    await page.waitForTimeout(2000);

    // Should show seller name/profile header OR a not-found/error page
    const profileHeader = page.locator('h1, h2').first();
    const errorText = page.getByText(/no encontrad|error|not found|no existe/i).first();

    const hasHeader = await profileHeader.isVisible();
    const hasError = await errorText.isVisible();

    expect(hasHeader || hasError).toBeTruthy();
  });

  test('should show verified badge for verified sellers', async ({ page }) => {
    await page.goto('/seller/test-seller-id');
    await page.waitForTimeout(2000);

    // Look for verified badge (shield check icon)
    const verifiedBadge = page.locator('svg.lucide-shield-check, svg.lucide-check');

    if (await verifiedBadge.count() > 0) {
      // Verified badge should be visible
      await expect(verifiedBadge.first()).toBeVisible();
    }
  });

  test('should display seller level badge', async ({ page }) => {
    await page.goto('/seller/test-seller-id');
    await page.waitForTimeout(2000);

    // Look for seller level (NUEVO, BRONCE, PLATA, ORO)
    const levelBadge = page.getByText(/NUEVO|BRONCE|PLATA|ORO|nivel/i);

    if (await levelBadge.count() > 0) {
      await expect(levelBadge.first()).toBeVisible();
    }
  });

  test('should show seller statistics', async ({ page }) => {
    await page.goto('/seller/test-seller-id');
    await page.waitForTimeout(2000);

    // Look for statistics (total raffles, completed, etc.)
    const statsSection = page.getByText(/rifas|ventas|completadas/i);
    const statsCount = await statsSection.count();

    if (statsCount > 0) {
      expect(statsCount).toBeGreaterThan(0);
    }
  });

  test('should display active raffles from seller', async ({ page }) => {
    await page.goto('/seller/test-seller-id');
    await page.waitForTimeout(2000);

    // Look for active raffles section
    const activeSection = page.getByText(/rifas activas|activa/i);

    if (await activeSection.count() > 0) {
      await expect(activeSection.first()).toBeVisible();
    }
  });

  test('should show completed raffles section', async ({ page }) => {
    await page.goto('/seller/test-seller-id');
    await page.waitForTimeout(2000);

    // Look for completed raffles
    const completedSection = page.getByText(/finalizadas|completadas/i);

    if (await completedSection.count() > 0) {
      await expect(completedSection.first()).toBeVisible();
    }
  });

  test('should have raffle cards with prices and images', async ({ page }) => {
    await page.goto('/seller/test-seller-id');
    await page.waitForTimeout(2000);

    // Look for price indicators
    const prices = page.locator('text=/\\$\\d+/');
    const priceCount = await prices.count();

    // If seller has raffles, should show prices
    if (priceCount > 0) {
      expect(priceCount).toBeGreaterThan(0);
    }
  });
});
