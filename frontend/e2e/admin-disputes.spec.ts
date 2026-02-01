import { test, expect, Page } from '@playwright/test';

/**
 * Admin Disputes E2E Tests
 * Tests the admin dispute resolution interface
 */

// Test admin credentials
const TEST_ADMIN = {
  email: 'admin@test.com',
  password: 'Admin123!',
};

/**
 * Helper to login as admin
 */
async function loginAsAdmin(page: Page) {
  await page.goto('/auth/login');
  await page.getByLabel(/email/i).fill(TEST_ADMIN.email);
  await page.getByLabel(/contrase[ñn]a/i).fill(TEST_ADMIN.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.includes('/auth/login'), {
    timeout: 15000,
  });
}

test.describe('Admin Disputes', () => {
  test('should show disputes admin panel for admin users', async ({
    page,
  }) => {
    test.skip(true, 'Requires test admin user in database');

    await loginAsAdmin(page);
    await page.goto('/admin/disputes');

    // Should show admin panel
    await expect(
      page.getByRole('heading', { name: /gestión de reclamos/i }),
    ).toBeVisible();
  });

  test('should deny access to non-admin users', async ({ page }) => {
    test.skip(true, 'Login flow needs investigation in CI environment');

    // Login as regular user
    await page.goto('/auth/login');
    await page.getByLabel(/email/i).fill('comprador@test.com');
    await page.getByLabel(/contrase[ñn]a/i).fill('Password123!');
    await page.locator('button[type="submit"]').click();

    await page.waitForURL((url) => !url.pathname.includes('/auth/login'), {
      timeout: 15000,
    });

    // Try to access admin panel
    await page.goto('/admin/disputes');

    // Wait for page to load
    await page.waitForTimeout(2000);

    // Should redirect to home/dashboard or show error
    // Non-admin users should not see the admin disputes page
    const isOnAdminPage = page.url().includes('/admin/disputes');
    const unauthorizedText = page.getByText(/no autorizado|acceso denegado/i);
    const redirectedAway = !isOnAdminPage;

    const hasUnauthorized = await unauthorizedText
      .isVisible()
      .catch(() => false);

    // Either should be denied access or redirected away
    expect(hasUnauthorized || redirectedAway).toBeTruthy();
  });

  test('should display pending disputes', async ({ page }) => {
    test.skip(
      true,
      'Requires test admin user and pending disputes in database',
    );

    await loginAsAdmin(page);
    await page.goto('/admin/disputes');

    // Should show disputes table
    await expect(page.locator('table')).toBeVisible();
  });

  test('should filter disputes by status', async ({ page }) => {
    test.skip(
      true,
      'Requires test admin user and disputes in database',
    );

    await loginAsAdmin(page);
    await page.goto('/admin/disputes');

    // Select filter
    await page.getByLabel(/estado/i).selectOption('ABIERTA');

    // Should filter results
    await expect(page.getByText(/abierta/i).first()).toBeVisible();
  });

  test('should filter disputes by type', async ({ page }) => {
    test.skip(
      true,
      'Requires test admin user and disputes in database',
    );

    await loginAsAdmin(page);
    await page.goto('/admin/disputes');

    // Select type filter
    await page
      .getByLabel(/tipo/i)
      .selectOption('PRODUCTO_NO_RECIBIDO');

    // Should show filtered disputes
    await expect(
      page.getByText(/producto no recibido/i).first(),
    ).toBeVisible();
  });

  test('should open dispute details modal', async ({ page }) => {
    test.skip(
      true,
      'Requires test admin user and disputes in database',
    );

    await loginAsAdmin(page);
    await page.goto('/admin/disputes');

    // Click on first dispute
    await page.locator('table tbody tr').first().click();

    // Should show modal with details
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(
      page.getByText(/detalles del reclamo/i),
    ).toBeVisible();
  });

  test('should resolve dispute in buyer favor with refund', async ({
    page,
  }) => {
    test.skip(
      true,
      'Requires test admin user, test dispute, and backend integration',
    );

    await loginAsAdmin(page);
    await page.goto('/admin/disputes');

    // Open dispute
    await page.locator('table tbody tr').first().click();

    // Select resolution
    await page
      .getByLabel(/decisión/i)
      .selectOption('RESUELTA_COMPRADOR');
    await page
      .getByLabel(/resolución/i)
      .fill('Evidencia clara de fraude');

    // Submit
    await page.getByRole('button', { name: /resolver/i }).click();

    // Should show success message
    await expect(
      page.getByText(/reclamo resuelto correctamente/i),
    ).toBeVisible();
  });

  test('should resolve dispute in seller favor', async ({ page }) => {
    test.skip(
      true,
      'Requires test admin user, test dispute, and backend integration',
    );

    await loginAsAdmin(page);
    await page.goto('/admin/disputes');

    // Open dispute
    await page.locator('table tbody tr').first().click();

    // Select seller favor
    await page
      .getByLabel(/decisión/i)
      .selectOption('RESUELTA_VENDEDOR');
    await page
      .getByLabel(/resolución/i)
      .fill('Comprador recibió el producto');

    // Submit
    await page.getByRole('button', { name: /resolver/i }).click();

    // Should show success
    await expect(
      page.getByText(/reclamo resuelto correctamente/i),
    ).toBeVisible();
  });

  test('should handle partial resolution', async ({ page }) => {
    test.skip(true, 'Requires test admin user and test dispute');

    await loginAsAdmin(page);
    await page.goto('/admin/disputes');

    // Open dispute
    await page.locator('table tbody tr').first().click();

    // Select partial resolution
    await page
      .getByLabel(/decisión/i)
      .selectOption('RESUELTA_PARCIAL');

    // Should show amount input
    await expect(page.getByLabel(/monto reembolso/i)).toBeVisible();
  });

  test('should allow adding admin notes to dispute', async ({
    page,
  }) => {
    test.skip(true, 'Requires test admin user and test dispute');

    await loginAsAdmin(page);
    await page.goto('/admin/disputes');

    // Open dispute
    await page.locator('table tbody tr').first().click();

    // Add notes
    await page
      .getByLabel(/notas internas/i)
      .fill('Contacté al vendedor por teléfono');

    // Save
    await page
      .getByRole('button', { name: /guardar notas/i })
      .click();

    // Should save successfully
    await expect(page.getByText(/notas guardadas/i)).toBeVisible();
  });

  test('should show dispute history timeline', async ({ page }) => {
    test.skip(true, 'Requires test dispute with history');

    await loginAsAdmin(page);
    await page.goto('/admin/disputes');

    // Open dispute
    await page.locator('table tbody tr').first().click();

    // Should show timeline
    await expect(page.getByText(/historial/i)).toBeVisible();
    await expect(
      page.locator('.timeline-item').first(),
    ).toBeVisible();
  });

  test('should support bulk dispute resolution', async ({ page }) => {
    test.skip(true, 'Requires test admin user and multiple disputes');

    await loginAsAdmin(page);
    await page.goto('/admin/disputes');

    // Select multiple disputes
    await page.locator('input[type="checkbox"]').first().check();
    await page.locator('input[type="checkbox"]').nth(1).check();

    // Bulk action button should appear
    await expect(
      page.getByRole('button', { name: /acciones en lote/i }),
    ).toBeVisible();
  });

  test('should validate resolution form before submission', async ({
    page,
  }) => {
    test.skip(true, 'Requires test admin user and test dispute');

    await loginAsAdmin(page);
    await page.goto('/admin/disputes');

    // Open dispute
    await page.locator('table tbody tr').first().click();

    // Try to submit without selecting decision
    await page.getByRole('button', { name: /resolver/i }).click();

    // Should show validation error
    await expect(
      page.getByText(/debe seleccionar una decisión/i),
    ).toBeVisible();
  });

  test('should show confirmation dialog for critical actions', async ({
    page,
  }) => {
    test.skip(true, 'Requires test admin user and test dispute');

    await loginAsAdmin(page);
    await page.goto('/admin/disputes');

    // Open dispute
    await page.locator('table tbody tr').first().click();

    // Select resolution
    await page
      .getByLabel(/decisión/i)
      .selectOption('RESUELTA_COMPRADOR');
    await page.getByLabel(/resolución/i).fill('Test resolution');
    await page.getByRole('button', { name: /resolver/i }).click();

    // Should show confirmation
    await expect(
      page.getByText(/¿estás seguro de resolver este reclamo/i),
    ).toBeVisible();
  });
});
