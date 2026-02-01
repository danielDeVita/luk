import { test, expect, Page } from '@playwright/test';

/**
 * KYC Submission E2E Tests
 * Tests the KYC verification flow for sellers
 */

// Test seller who needs to submit KYC
const TEST_SELLER_UNVERIFIED = {
  email: 'seller-unverified@test.com',
  password: 'Password123!',
};

/**
 * Helper to login as unverified seller
 */
async function loginAsUnverifiedSeller(page: Page) {
  await page.goto('/auth/login');
  await page.getByLabel(/email/i).fill(TEST_SELLER_UNVERIFIED.email);
  await page
    .getByLabel(/contrase[ñn]a/i)
    .fill(TEST_SELLER_UNVERIFIED.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(
    (url) => !url.pathname.includes('/auth/login'),
    {
      timeout: 10000,
    },
  );
}

test.describe('KYC Submission', () => {
  test('should show KYC form in seller dashboard', async ({
    page,
  }) => {
    test.skip(
      true,
      'Requires test user with KYC NOT_SUBMITTED status in database',
    );

    await loginAsUnverifiedSeller(page);
    await page.goto('/dashboard/seller');

    // Should show KYC requirement message
    await expect(
      page.getByText(/verificación de identidad requerida/i),
    ).toBeVisible();
  });

  test('should validate required KYC fields', async ({ page }) => {
    await page.goto('/dashboard/seller/kyc');

    // Try to submit without filling fields
    await page.locator('button[type="submit"]').click();

    // Should show validation errors
    await expect(
      page.getByText(/este campo es obligatorio/i).first(),
    ).toBeVisible();
  });

  test('should validate DNI format', async ({ page }) => {
    await page.goto('/dashboard/seller/kyc');

    // Enter invalid DNI
    await page.getByLabel(/dni/i).fill('123'); // Too short
    await page.locator('button[type="submit"]').click();

    // Should show format error
    await expect(
      page.getByText(/dni debe tener 7-8 dígitos/i),
    ).toBeVisible();
  });

  test('should fill KYC form and set status to pending', async ({
    page,
  }) => {
    test.skip(
      true,
      'Requires test user with KYC NOT_SUBMITTED and file upload capability',
    );

    await loginAsUnverifiedSeller(page);
    await page.goto('/dashboard/seller/kyc');

    // Fill form
    await page.getByLabel(/nombre completo/i).fill('Juan Pérez');
    await page.getByLabel(/fecha de nacimiento/i).fill('1990-01-01');
    await page.getByLabel(/dni/i).fill('12345678');

    // Select document type
    await page.getByLabel(/tipo de documento/i).selectOption('DNI');

    // Upload documents (would need test files)
    // await page.getByLabel(/foto frente dni/i).setInputFiles('test-dni-front.jpg');
    // await page.getByLabel(/foto reverso dni/i).setInputFiles('test-dni-back.jpg');

    await page.locator('button[type="submit"]').click();

    // Should show success message
    await expect(
      page.getByText(/documentación enviada correctamente/i),
    ).toBeVisible();
  });

  test('should show pending status after KYC submission', async ({
    page,
  }) => {
    test.skip(
      true,
      'Requires test user with KYC PENDING_REVIEW status',
    );

    await loginAsUnverifiedSeller(page);
    await page.goto('/dashboard/seller');

    // Should show pending message
    await expect(
      page.getByText(/verificación en proceso/i),
    ).toBeVisible();
  });

  test('should prevent raffle creation without KYC verification', async ({
    page,
  }) => {
    test.skip(
      true,
      'Requires test user with KYC NOT_SUBMITTED status',
    );

    await loginAsUnverifiedSeller(page);
    await page.goto('/dashboard/seller/create-raffle');

    // Should show KYC requirement message
    await expect(
      page.getByText(/debes verificar tu identidad/i),
    ).toBeVisible();
  });

  test('should show success message after admin approval', async ({
    page,
  }) => {
    test.skip(
      true,
      'Requires admin to approve KYC or test endpoint to simulate approval',
    );

    await loginAsUnverifiedSeller(page);
    await page.goto('/dashboard/seller');

    // After admin approves, should show verified status
    await expect(
      page.getByText(/identidad verificada/i),
    ).toBeVisible();
  });

  test('should allow raffle creation after KYC approval', async ({
    page,
  }) => {
    // Use verified seller from seed data
    await page.goto('/auth/login');
    await page.getByLabel(/email/i).fill('vendedor@test.com');
    await page.getByLabel(/contrase[ñn]a/i).fill('Password123!');
    await page.locator('button[type="submit"]').click();

    await page.waitForURL(
      (url) => !url.pathname.includes('/auth/login'),
    );
    await page.goto('/dashboard/seller/create-raffle');

    // Should be able to access form
    await expect(page.getByLabel(/título/i)).toBeVisible();
  });

  test('should show rejection reason after admin rejection', async ({
    page,
  }) => {
    test.skip(
      true,
      'Requires admin to reject KYC or test endpoint to simulate rejection',
    );

    await loginAsUnverifiedSeller(page);
    await page.goto('/dashboard/seller');

    // Should show rejection message
    await expect(
      page.getByText(/verificación rechazada/i),
    ).toBeVisible();

    // Should show reason
    await expect(page.getByText(/motivo:/i)).toBeVisible();
  });

  test('should allow resubmission after rejection', async ({
    page,
  }) => {
    test.skip(true, 'Requires test user with KYC REJECTED status');

    await loginAsUnverifiedSeller(page);
    await page.goto('/dashboard/seller/kyc');

    // Should show resubmit button
    await expect(
      page.getByRole('button', { name: /enviar nuevamente/i }),
    ).toBeVisible();
  });
});
