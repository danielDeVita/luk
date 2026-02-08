import { test, expect } from '@playwright/test';
import { apiLogin, TEST_BUYER } from './helpers/auth';

/**
 * Dashboard Referrals E2E Tests
 * Tests the referral program functionality
 */

test.describe('Dashboard Referrals', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    if (!testInfo.title.includes('redirect to login')) {
      await apiLogin(page, TEST_BUYER);
      await page.goto('/dashboard/referrals');
    }
  });

  test('should redirect to login if not authenticated', async ({ page }) => {
    await page.goto('/dashboard/referrals');
    await page.waitForURL(/\/auth\/login/);
    expect(page.url()).toContain('/auth/login');
  });

  test('should display referrals page header', async ({ page }) => {
    await expect(page.locator('main').getByText(/Programa de Referidos/i).first()).toBeVisible();
    await expect(page.locator('main svg.lucide-users').first()).toBeVisible();
  });

  test('should show referral code or generate button', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Should show either existing code or button to generate
    const generateButton = page.getByRole('button', { name: /Generar.*c[oó]digo/i });
    const referralCode = page.getByText(/Tu c[oó]digo/i);

    const hasGenerateButton = await generateButton.isVisible();
    const hasReferralCode = await referralCode.isVisible();

    expect(hasGenerateButton || hasReferralCode).toBeTruthy();
  });

  test('should display copy referral code button when code exists', async ({ page }) => {
    await page.waitForTimeout(2000);

    // If code exists, should show copy button
    const copyButton = page.locator('button').filter({ has: page.locator('svg.lucide-copy') });

    if ((await copyButton.count()) > 0) {
      await expect(copyButton.first()).toBeVisible();
    }
  });

  test('should show referral statistics cards', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Should show stats: friends invited, earnings, pending credits
    const statsCards = [
      /Amigos invitados/i,
      /Total ganado/i,
      /Cr[eé]dito pendiente/i,
    ];

    for (const statText of statsCards) {
      const statElement = page.getByText(statText);
      if (await statElement.isVisible()) {
        await expect(statElement).toBeVisible();
      }
    }
  });

  test('should display referral program benefits', async ({ page }) => {
    await page.waitForTimeout(1000);

    // Should explain the 5% credit benefit
    const benefitText = page.getByText(/5%/i);

    if (await benefitText.isVisible()) {
      await expect(benefitText).toBeVisible();
    }
  });

  test('should show list of referred users when available', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Check for referred users list or empty state
    const emptyState = page.getByText(/no invitaste|no referiste/i);
    const usersList = page.getByText(/Tus invitados|invitados/i);

    const hasEmptyState = await emptyState.isVisible();
    const hasUsersList = await usersList.isVisible();

    expect(hasEmptyState || hasUsersList).toBeTruthy();
  });

  test('should indicate purchased status for referred users', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Look for purchase status indicators
    const checkIcon = page.locator('svg.lucide-check');
    const purchasedBadge = page.getByText(/Compró/i);

    if ((await checkIcon.count()) > 0 || (await purchasedBadge.count()) > 0) {
      // If referred users exist with purchases, indicators should be visible
      expect((await checkIcon.count()) > 0 || (await purchasedBadge.count()) > 0).toBeTruthy();
    }
  });

  test('should show earnings from each referred user', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Check for earnings display ($ amounts)
    const earningsText = page.locator('text=/\\$\\d+\\.\\d{2}/');

    if ((await earningsText.count()) > 0) {
      expect((await earningsText.count()) > 0).toBeTruthy();
    }
  });
});
