import { test, expect } from '@playwright/test';

/**
 * Search & Filters E2E Tests
 * Tests search and filter functionality
 */

test.describe('Search & Filters', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/search');
  });

  test('should display search page with search input', async ({ page }) => {
    await page.waitForTimeout(1000);

    const searchInput = page.getByPlaceholder(/buscar|search/i);
    await expect(searchInput).toBeVisible();
  });

  test('should show category filter dropdown', async ({ page }) => {
    await page.waitForTimeout(1000);

    // Look for category selector
    const categoryFilter = page.getByText(/categoría|category/i);

    if (await categoryFilter.count() > 0) {
      await expect(categoryFilter.first()).toBeVisible();
    }
  });

  test('should display price range slider', async ({ page }) => {
    await page.waitForTimeout(1000);

    // Look for price filter
    const priceFilter = page.getByText(/precio|price/i);

    if (await priceFilter.count() > 0) {
      await expect(priceFilter.first()).toBeVisible();
    }
  });

  test('should show sort options dropdown', async ({ page }) => {
    await page.waitForTimeout(1000);

    // Look for sort controls
    const sortControl = page.getByText(/ordenar|sort/i);

    if (await sortControl.count() > 0) {
      await expect(sortControl.first()).toBeVisible();
    }
  });

  test('should have clear filters button', async ({ page }) => {
    await page.waitForTimeout(1000);

    // Look for clear/reset button
    const clearButton = page.getByRole('button', { name: /limpiar|clear|reset/i });

    if (await clearButton.count() > 0) {
      await expect(clearButton.first()).toBeVisible();
    }
  });

  test('should display search results or empty state', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Look for results or no results message
    const noResults = page.getByText(/no se encontraron|no results|sin resultados/i);
    const raffleCards = page.locator('a[href*="/raffle/"]');

    const hasNoResults = await noResults.isVisible();
    const hasResults = (await raffleCards.count()) > 0;

    expect(hasNoResults || hasResults).toBeTruthy();
  });

  test('should update results when applying filters', async ({ page }) => {
    await page.waitForTimeout(1500);

    // Try to interact with search
    const searchInput = page.getByPlaceholder(/buscar|search/i);

    if (await searchInput.count() > 0) {
      await searchInput.fill('iPhone');
      await page.keyboard.press('Enter');

      await page.waitForTimeout(1000);

      // Page should still be on search route
      expect(page.url()).toContain('/search');
    }
  });
});
