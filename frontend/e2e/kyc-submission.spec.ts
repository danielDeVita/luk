import { test, expect } from '@playwright/test';
import { apiLogin, TEST_SELLER } from './helpers/auth';

/**
 * KYC Submission E2E Tests
 * Tests the KYC verification flow for sellers
 */

// Unverified seller test user (not reliably in seed data)
const TEST_SELLER_UNVERIFIED = {
  email: 'unverified@test.com',
  password: 'Password123!',
};

test.describe('KYC Submission', () => {
  test('should show KYC form in seller dashboard', async ({
    page,
  }) => {
    test.skip(
      true,
      'Requires test user with KYC NOT_SUBMITTED status in database',
    );

    await apiLogin(page, TEST_SELLER_UNVERIFIED);
    await page.goto('/dashboard/seller');

    // Should show KYC requirement message
    await expect(
      page.getByText(/verificación de identidad requerida/i),
    ).toBeVisible();
  });

  test('should validate required KYC fields', async ({ page }) => {
    test.skip(true, 'Requires authenticated unverified seller');

    await page.goto('/dashboard/seller/kyc');

    // Try to submit without filling fields
    await page.locator('button[type="submit"]').click();

    // Should show validation errors
    await expect(
      page.getByText(/este campo es obligatorio/i).first(),
    ).toBeVisible();
  });

  test('should validate DNI format', async ({ page }) => {
    test.skip(true, 'Requires authenticated unverified seller');

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

    await apiLogin(page, TEST_SELLER_UNVERIFIED);
    await page.goto('/dashboard/seller/kyc');

    // Fill form
    await page.getByLabel(/nombre completo/i).fill('Juan Pérez');
    await page.getByLabel(/fecha de nacimiento/i).fill('1990-01-01');
    await page.getByLabel(/dni/i).fill('12345678');

    // Select document type
    await page.getByLabel(/tipo de documento/i).selectOption('DNI');

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

    await apiLogin(page, TEST_SELLER_UNVERIFIED);
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

    await apiLogin(page, TEST_SELLER_UNVERIFIED);
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

    await apiLogin(page, TEST_SELLER_UNVERIFIED);
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
    await apiLogin(page, TEST_SELLER);
    await page.goto('/dashboard/create');

    // Should be able to access form (create raffle page loads)
    await expect(
      page.getByText(/crear|nueva rifa/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('should show rejection reason after admin rejection', async ({
    page,
  }) => {
    test.skip(
      true,
      'Requires admin to reject KYC or test endpoint to simulate rejection',
    );

    await apiLogin(page, TEST_SELLER_UNVERIFIED);
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

    await apiLogin(page, TEST_SELLER_UNVERIFIED);
    await page.goto('/dashboard/seller/kyc');

    // Should show resubmit button
    await expect(
      page.getByRole('button', { name: /enviar nuevamente/i }),
    ).toBeVisible();
  });
});
