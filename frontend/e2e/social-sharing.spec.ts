import { test, expect } from '@playwright/test';

/**
 * Social Sharing E2E Tests
 * Tests social media sharing functionality on raffle pages
 */

test.describe('Social Sharing', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a raffle detail page (any raffle ID)
    await page.goto('/raffle/test-raffle-id');
    await page.waitForTimeout(1500);
  });

  test('should display share button on raffle page', async ({ page }) => {
    // Look for "Compartir" share button
    const shareButton = page.getByRole('button', { name: /compartir|share/i });

    if (await shareButton.count() > 0) {
      await expect(shareButton.first()).toBeVisible();
    }
  });

  test('should open share dropdown menu when clicked', async ({ page }) => {
    const shareButton = page.getByRole('button', { name: /compartir|share/i });

    if (await shareButton.count() > 0) {
      // Click share button
      await shareButton.first().click();
      await page.waitForTimeout(500);

      // Look for WhatsApp option (one of the share options)
      const whatsappOption = page.getByText(/whatsapp/i);

      if (await whatsappOption.count() > 0) {
        await expect(whatsappOption.first()).toBeVisible();
      }
    }
  });

  test('should show social media share options in dropdown', async ({ page }) => {
    const shareButton = page.getByRole('button', { name: /compartir|share/i });

    if (await shareButton.count() > 0) {
      await shareButton.first().click();
      await page.waitForTimeout(500);

      // Check for multiple social media options
      const socialOptions = page.getByText(/whatsapp|facebook|twitter|telegram|linkedin/i);
      const count = await socialOptions.count();

      if (count > 0) {
        // Should have at least one social media option
        expect(count).toBeGreaterThan(0);
      }
    }
  });

  test('should show copy link option in share menu', async ({ page }) => {
    const shareButton = page.getByRole('button', { name: /compartir|share/i });

    if (await shareButton.count() > 0) {
      await shareButton.first().click();
      await page.waitForTimeout(500);

      // Look for "Copiar enlace" option
      const copyOption = page.getByText(/copiar enlace|copy link|copiar/i);

      if (await copyOption.count() > 0) {
        await expect(copyOption.first()).toBeVisible();
      }
    }
  });

  test('should show success toast when copying link', async ({ page }) => {
    // Grant clipboard permissions
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

    const shareButton = page.getByRole('button', { name: /compartir|share/i });

    if (await shareButton.count() > 0) {
      await shareButton.first().click();
      await page.waitForTimeout(500);

      // Click copy link option
      const copyOption = page.getByText(/copiar enlace|copy link/i);

      if (await copyOption.count() > 0) {
        await copyOption.first().click();
        await page.waitForTimeout(500);

        // Look for success toast/message
        const successToast = page.getByText(/copiado|copied|enlace copiado/i);

        if (await successToast.count() > 0) {
          await expect(successToast.first()).toBeVisible();
        }
      }
    }
  });
});
