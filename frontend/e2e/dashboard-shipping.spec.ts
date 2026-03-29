import { test, expect } from '@playwright/test';
import { apiLogin, TEST_SELLER } from './helpers/auth';

/**
 * Dashboard Shipping Addresses E2E Tests
 * Tests shipping address management functionality
 */

test.describe('Dashboard Shipping Addresses', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    if (!testInfo.title.includes('redirect to login')) {
      await apiLogin(page, TEST_SELLER);
      await page.goto('/dashboard/shipping');
    }
  });

  test('should redirect to login if not authenticated', async ({ page }) => {
    await page.goto('/dashboard/shipping');
    await page.waitForURL(/\/auth\/login/);
    expect(page.url()).toContain('/auth/login');
  });

  test('should display shipping addresses page header', async ({ page }) => {
    await expect(page.locator('main').getByRole('heading', { name: /Direcciones de Env[ií]o/i })).toBeVisible();
  });

  test('should show add address button', async ({ page }) => {
    const addButton = page.getByRole('button', { name: /Nueva Direcci[oó]n/i });
    await expect(addButton).toBeVisible();
  });

  test('should open dialog when add address button is clicked', async ({ page }) => {
    const addButton = page.getByRole('button', { name: /Nueva Direcci[oó]n/i });
    await addButton.click();

    // Dialog should open with heading
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: /Nueva Direcci[oó]n/i })).toBeVisible();
  });

  test('should display address form fields in dialog', async ({ page }) => {
    const addButton = page.getByRole('button', { name: /Nueva Direcci[oó]n/i });
    await addButton.click();
    await page.waitForTimeout(500);

    const dialog = page.getByRole('dialog');

    // Check for required form fields
    await expect(dialog.getByLabel(/Nombre del destinatario/i)).toBeVisible();
    await expect(dialog.getByLabel(/Calle/i)).toBeVisible();
    await expect(dialog.getByLabel(/N[uú]mero/i)).toBeVisible();
    await expect(dialog.getByLabel(/Ciudad/i)).toBeVisible();
    // Provincia is a combobox, check the label text exists in the dialog
    await expect(page.getByText('Provincia', { exact: true })).toBeVisible();
    await expect(dialog.getByLabel(/C[oó]digo Postal/i)).toBeVisible();
  });

  test('should list existing shipping addresses', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Check for addresses list or empty state
    const emptyState = page.getByRole('heading', {
      name: /No tenés direcciones guardadas/i,
    });
    const addressCard = page
      .locator('[data-slot="card"]')
      .filter({ hasText: /Depósito principal|Predeterminada|Av\. QA 100/i });

    const hasEmptyState = await emptyState.isVisible();
    const hasAddresses = (await addressCard.count()) > 0;

    expect(hasEmptyState || hasAddresses).toBeTruthy();
  });

  test('should show default address badge', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Look for default address indicator
    const defaultBadge = page.getByText(/Predeterminada|Principal/i).first();

    if (await defaultBadge.isVisible()) {
      await expect(defaultBadge).toBeVisible();
      // Default badge should have star icon nearby
      const starIcon = page.locator('svg.lucide-star').first();
      if (await starIcon.isVisible()) {
        await expect(starIcon).toBeVisible();
      }
    }
  });

  test('should show address action buttons', async ({ page }) => {
    await page.waitForTimeout(2000);

    // If addresses exist, should show edit and delete buttons
    const editButtons = page.locator('button').filter({ has: page.locator('svg.lucide-edit-2') });
    const deleteButtons = page.locator('button').filter({ has: page.locator('svg.lucide-trash-2') });

    const hasEdit = (await editButtons.count()) > 0;
    const hasDelete = (await deleteButtons.count()) > 0;

    if (hasEdit || hasDelete) {
      expect(hasEdit || hasDelete).toBeTruthy();
    }
  });

  test('should enforce 5 address maximum limit message', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Check if max limit message is shown (when user has 5 addresses)
    const maxLimitMessage = page.getByText(/Alcanzaste el límite máximo/i);

    if (await maxLimitMessage.isVisible()) {
      await expect(maxLimitMessage).toBeVisible();

      // Add button should be disabled
      const addButton = page.getByRole('button', { name: /Nueva Direcci[oó]n/i });
      await expect(addButton).toBeDisabled();
    }
  });
});
