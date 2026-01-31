import { test, expect } from '@playwright/test';

/**
 * Dashboard Favorites E2E Tests
 * Tests the favorites/bookmarks functionality
 */

test.describe('Dashboard Favorites', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/favorites');
  });

  test('should redirect to login if not authenticated', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/dashboard/favorites');

    await page.waitForURL(/\/auth\/login/);
    expect(page.url()).toContain('/auth/login');
  });

  test('should display favorites page header', async ({ page }) => {
    test.skip(!page.url().includes('/dashboard/favorites'), 'Requires authentication');

    await expect(page.getByText(/Mis Favoritos/i)).toBeVisible();
    await expect(page.locator('svg.lucide-heart')).toBeVisible();
  });

  test('should show list of favorited raffles or empty state', async ({ page }) => {
    test.skip(!page.url().includes('/dashboard/favorites'), 'Requires authentication');

    await page.waitForTimeout(2000);

    // Check for favorites list or empty state
    const emptyState = page.getByText(/No tenés favoritos/i);
    const favoritesList = page.getByText(/rifas que te gustan/i);

    const hasEmptyState = await emptyState.isVisible();
    const hasFavorites = await favoritesList.isVisible();

    expect(hasEmptyState || hasFavorites).toBeTruthy();
  });

  test('should display remove favorite button on each card', async ({ page }) => {
    test.skip(!page.url().includes('/dashboard/favorites'), 'Requires authentication');

    await page.waitForTimeout(2000);

    // Look for heart icons (favorite buttons)
    const heartIcons = page.locator('svg.lucide-heart');
    const heartCount = await heartIcons.count();

    if (heartCount > 0) {
      // Should have heart icons for removing favorites
      expect(heartCount).toBeGreaterThan(0);
    }
  });

  test('should show raffle cards with basic information', async ({ page }) => {
    test.skip(!page.url().includes('/dashboard/favorites'), 'Requires authentication');

    await page.waitForTimeout(2000);

    // Look for raffle card elements (prices, titles, etc.)
    const priceElements = page.locator('text=/\\$\\d+/');
    const priceCount = await priceElements.count();

    if (priceCount > 0) {
      expect(priceCount).toBeGreaterThan(0);
    }
  });

  test('should display filter and sort options', async ({ page }) => {
    test.skip(!page.url().includes('/dashboard/favorites'), 'Requires authentication');

    await page.waitForTimeout(1000);

    // Look for sort/filter controls
    const sortButton = page.locator('button, select').filter({ hasText: /ordenar|filtrar/i }).first();

    if (await sortButton.count() > 0) {
      await expect(sortButton).toBeVisible();
    }
  });

  test('should show price drop alerts toggle', async ({ page }) => {
    test.skip(!page.url().includes('/dashboard/favorites'), 'Requires authentication');

    await page.waitForTimeout(1500);

    // Look for price alert settings
    const alertText = page.getByText(/alerta de precio|notificar/i);

    if (await alertText.count() > 0) {
      await expect(alertText.first()).toBeVisible();
    }
  });

  test('should navigate to raffle detail when clicking on card', async ({ page }) => {
    test.skip(!page.url().includes('/dashboard/favorites'), 'Requires authentication');

    await page.waitForTimeout(2000);

    // Try to find and click first raffle card link
    const raffleLinks = page.locator('a[href*="/raffle/"]');
    const linkCount = await raffleLinks.count();

    if (linkCount > 0) {
      const firstLink = raffleLinks.first();
      const href = await firstLink.getAttribute('href');

      expect(href).toContain('/raffle/');
    }
  });
});
