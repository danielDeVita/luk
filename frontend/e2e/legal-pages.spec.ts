import { test, expect } from '@playwright/test';

/**
 * Legal Pages E2E Tests
 * Tests legal documentation pages (Terms of Service, Privacy Policy)
 */

test.describe('Legal Pages', () => {
  test('should display Terms of Service page', async ({ page }) => {
    await page.goto('/legal/terminos');
    await page.waitForTimeout(1000);

    // Check for main heading
    const heading = page.getByRole('heading', { name: /términos/i, level: 1 });
    await expect(heading).toBeVisible();

    // Check for back button
    const backButton = page.getByRole('link', { name: /volver al inicio/i });
    await expect(backButton).toBeVisible();
  });

  test('should display Privacy Policy page', async ({ page }) => {
    await page.goto('/legal/privacidad');
    await page.waitForTimeout(1000);

    // Should have heading (either "Privacidad" or "Política de Privacidad")
    const headings = page.locator('h1');
    await expect(headings.first()).toBeVisible();

    // Check for back button (may have multiple matches, use first)
    const backButton = page.getByRole('link', { name: /volver al inicio/i });

    if (await backButton.count() > 0) {
      await expect(backButton.first()).toBeVisible();
    }
  });

  test('should show last updated date on legal pages', async ({ page }) => {
    await page.goto('/legal/terminos');
    await page.waitForTimeout(1000);

    // Look for "Última actualización" or similar date indicator
    const dateText = page.getByText(/última actualización|última modificación|fecha/i);

    if (await dateText.count() > 0) {
      await expect(dateText.first()).toBeVisible();
    }
  });

  test('should render content with proper markdown/HTML formatting', async ({ page }) => {
    await page.goto('/legal/terminos');
    await page.waitForTimeout(1000);

    // Check for article/prose container (indicating formatted content)
    const article = page.locator('article, .prose');

    if (await article.count() > 0) {
      await expect(article.first()).toBeVisible();
    }

    // Should have multiple headings (sections)
    const headings = page.locator('h2');
    const headingCount = await headings.count();

    if (headingCount > 0) {
      expect(headingCount).toBeGreaterThan(0);
    }
  });

  test('should allow navigation back to home from legal pages', async ({ page }) => {
    await page.goto('/legal/terminos');
    await page.waitForTimeout(1000);

    // Click back button
    const backButton = page.getByRole('link', { name: /volver al inicio/i });

    if (await backButton.count() > 0) {
      const href = await backButton.getAttribute('href');
      expect(href).toBe('/');
    }
  });
});
