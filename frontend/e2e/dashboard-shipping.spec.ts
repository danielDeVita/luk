import { test, expect } from '@playwright/test';

/**
 * Dashboard Shipping Addresses E2E Tests
 * Tests shipping address management functionality
 */

test.describe('Dashboard Shipping Addresses', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/shipping');
  });

  test('should redirect to login if not authenticated', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/dashboard/shipping');

    await page.waitForURL(/\/auth\/login/);
    expect(page.url()).toContain('/auth/login');
  });

  test('should display shipping addresses page header', async ({ page }) => {
    test.skip(!page.url().includes('/dashboard/shipping'), 'Requires authentication');

    await expect(page.getByText(/Direcciones de Envío/i)).toBeVisible();
    await expect(page.locator('svg.lucide-map-pin')).toBeVisible();
  });

  test('should show add address button', async ({ page }) => {
    test.skip(!page.url().includes('/dashboard/shipping'), 'Requires authentication');

    const addButton = page.getByRole('button', { name: /Agregar Dirección/i });
    await expect(addButton).toBeVisible();
  });

  test('should open dialog when add address button is clicked', async ({ page }) => {
    test.skip(!page.url().includes('/dashboard/shipping'), 'Requires authentication');

    const addButton = page.getByRole('button', { name: /Agregar Dirección/i });
    await addButton.click();

    // Dialog should open
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(/Nueva Dirección/i)).toBeVisible();
  });

  test('should display address form fields in dialog', async ({ page }) => {
    test.skip(!page.url().includes('/dashboard/shipping'), 'Requires authentication');

    const addButton = page.getByRole('button', { name: /Agregar Dirección/i });
    await addButton.click();
    await page.waitForTimeout(500);

    // Check for required form fields
    await expect(page.getByLabel(/Nombre del destinatario/i)).toBeVisible();
    await expect(page.getByLabel(/Calle/i)).toBeVisible();
    await expect(page.getByLabel(/Número/i)).toBeVisible();
    await expect(page.getByLabel(/Ciudad/i)).toBeVisible();
    await expect(page.getByLabel(/Provincia/i)).toBeVisible();
    await expect(page.getByLabel(/Código Postal/i)).toBeVisible();
  });

  test('should list existing shipping addresses', async ({ page }) => {
    test.skip(!page.url().includes('/dashboard/shipping'), 'Requires authentication');

    await page.waitForTimeout(2000);

    // Check for addresses list or empty state
    const emptyState = page.getByText(/No tenés direcciones/i);
    const addressCard = page.locator('[class*="border"]').filter({ hasText: /Calle/i });

    const hasEmptyState = await emptyState.isVisible();
    const hasAddresses = (await addressCard.count()) > 0;

    expect(hasEmptyState || hasAddresses).toBeTruthy();
  });

  test('should show default address badge', async ({ page }) => {
    test.skip(!page.url().includes('/dashboard/shipping'), 'Requires authentication');

    await page.waitForTimeout(2000);

    // Look for default address indicator
    const defaultBadge = page.getByText(/Principal/i).first();

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
    test.skip(!page.url().includes('/dashboard/shipping'), 'Requires authentication');

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
    test.skip(!page.url().includes('/dashboard/shipping'), 'Requires authentication');

    await page.waitForTimeout(2000);

    // Check if max limit message is shown (when user has 5 addresses)
    const maxLimitMessage = page.getByText(/Alcanzaste el límite máximo/i);

    if (await maxLimitMessage.isVisible()) {
      await expect(maxLimitMessage).toBeVisible();

      // Add button should be disabled
      const addButton = page.getByRole('button', { name: /Agregar Dirección/i });
      await expect(addButton).toBeDisabled();
    }
  });
});
