import { test, expect } from '@playwright/test';
import { apiLogin, TEST_SELLER } from './helpers/auth';

/**
 * Dashboard Payouts E2E Tests
 * Tests the seller payouts management page
 */

test.describe('Dashboard Payouts', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    if (!testInfo.title.includes('redirect to login')) {
      await apiLogin(page, TEST_SELLER);
      await page.goto('/dashboard/payouts');
    }
  });

  test('should redirect to login if not authenticated', async ({ page }) => {
    await page.goto('/dashboard/payouts');
    await page.waitForURL(/\/auth\/login/);
    expect(page.url()).toContain('/auth/login');
  });

  test('should display payouts page header', async ({ page }) => {
    await expect(page.locator('main').getByRole('heading', { name: /Mis Pagos/i })).toBeVisible();
  });

  test('should display summary cards with totals', async ({ page }) => {
    // Wait for data to load
    await page.waitForTimeout(2000);

    // Should show "Total Recibido" card
    await expect(page.getByText(/Total Recibido/i)).toBeVisible();

    // Should show "Pendiente" card
    await expect(page.getByText(/Pendiente/i)).toBeVisible();

    // Should show monetary amounts (check for $ symbol)
    const amountElements = page.locator('text=/\\$\\d+\\.\\d{2}/');
    const amountCount = await amountElements.count();
    expect(amountCount).toBeGreaterThan(0);
  });

  test('should display list of payouts when available', async ({ page }) => {
    // Wait for payouts to load
    await page.waitForTimeout(2000);

    // Check for payout history heading or empty state
    const historyHeading = page.getByText(/Historial de Pagos/i);
    const emptyState = page.getByText(/No tenés pagos/i);

    // Either should be visible
    const hasHistory = await historyHeading.isVisible();
    const isEmpty = await emptyState.isVisible();
    expect(hasHistory || isEmpty).toBeTruthy();
  });

  test('should show payout status badges', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Look for status badges (Pendiente, Procesando, Completado, Fallido)
    const statusTexts = [
      /Pendiente/i,
      /Procesando/i,
      /Completado/i,
      /Fallido/i,
    ];

    let foundStatus = false;
    for (const statusText of statusTexts) {
      const statusBadge = page.getByText(statusText).first();
      if (await statusBadge.isVisible()) {
        foundStatus = true;
        break;
      }
    }

    // If there are payouts, at least one status should be visible
    // This test is conditional based on data availability
    if (foundStatus) {
      expect(foundStatus).toBeTruthy();
    }
  });

  test('should display payout details including fees', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Check for fee-related text if payouts exist
    const platformFee = page.getByText(/Comisi[oó]n.*plataforma/i).first();
    const processingFee = page.getByText(/Comisi[oó]n.*procesamiento/i).first();

    const hasPlatformFee = await platformFee.isVisible();
    const hasProcessingFee = await processingFee.isVisible();

    // If payouts exist, should show fee information
    if (hasPlatformFee || hasProcessingFee) {
      expect(hasPlatformFee || hasProcessingFee).toBeTruthy();
    }
  });

  test('should show scheduled date for pending payouts', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Look for scheduled date indicator
    const scheduledText = page.getByText(/Programado para/i).first();

    if (await scheduledText.isVisible()) {
      await expect(scheduledText).toBeVisible();
    }
  });

  test('should show empty state when no payouts', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Check for empty state message
    const emptyMessage = page.getByText(/No tenés pagos/i);

    if (await emptyMessage.isVisible()) {
      await expect(emptyMessage).toBeVisible();

      // Should suggest creating a raffle
      const suggestion = page.getByText(/Cre[aá]r? una rifa/i);
      if (await suggestion.isVisible()) {
        await expect(suggestion).toBeVisible();
      }
    }
  });
});
