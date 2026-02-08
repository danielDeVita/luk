import { test, expect } from '@playwright/test';

/**
 * Email Verification E2E Tests
 * Tests the 6-digit code verification flow during registration
 */

test.describe('Email Verification', () => {
  test('should show verification page after registration', async ({
    page,
  }) => {
    test.skip(!!process.env.CI, 'Registration requires real email service in CI');
    await page.goto('/auth/register');

    // Fill registration form
    await page.getByLabel(/nombre/i).fill('Test');
    await page.getByLabel(/apellido/i).fill('User');

    // Fill birth date (must be 18+)
    const birthDate = page.getByLabel(/fecha de nacimiento/i);
    await birthDate.fill('2000-01-15');

    await page
      .getByLabel(/email/i)
      .fill(`test-${Date.now()}@example.com`);
    await page.getByLabel('Contraseña', { exact: true }).fill('Password123!');
    await page.getByLabel('Confirmar Contraseña').fill('Password123!');

    // Accept terms and conditions
    await page.getByRole('checkbox').check();

    await page
      .locator('button[type="submit"]')
      .getByText(/crear cuenta/i)
      .click();

    // Should show verification form (may stay on same URL or redirect)
    await expect(
      page.getByText(/código de 6 dígitos|verificá tu email/i).first(),
    ).toBeVisible({ timeout: 15000 });
  });

  test('should auto-login with correct verification code', async ({
    page: _page,
  }) => {
    // Note: This test requires either:
    // 1. A test email service that can retrieve codes
    // 2. A backend test endpoint to generate verification codes
    // 3. Mocking the email service in test environment
    //
    // For now, we'll test the UI flow assuming we have the code
    test.skip(
      true,
      'Requires test email service or backend test endpoint for code retrieval',
    );
  });

  test('should show error for wrong verification code', async ({
    page: _page,
  }) => {
    test.skip(true, 'Requires active verification session to access verify-email page');
  });

  test('should show resend button after timeout', async ({
    page: _page,
  }) => {
    test.skip(true, 'Requires active verification session to access verify-email page');
  });

  test('should allow resending verification code', async ({
    page: _page,
  }) => {
    test.skip(true, 'Requires active verification session to access verify-email page');
  });

  test('should enforce max 3 verification attempts', async ({
    page: _page,
  }) => {
    test.skip(
      true,
      'Requires backend test endpoint to simulate failed attempts',
    );
    // This would test the throttling mechanism
    // After 3 failed attempts, should show lockout message
  });

  test('should show code expiry message after 15 minutes', async ({
    page: _page,
  }) => {
    test.skip(true, 'Requires time manipulation in test environment');
    // Would need to mock/manipulate time to test 15-minute expiry
  });

  test('should apply referral code from URL after verification', async ({
    page,
  }) => {
    // Register with referral code in URL
    await page.goto('/auth/register?ref=TESTREF123');

    await page.getByLabel(/nombre/i).fill('Test');
    await page.getByLabel(/apellido/i).fill('User');
    await page
      .getByLabel(/email/i)
      .fill(`test-ref-${Date.now()}@example.com`);
    await page.getByLabel('Contraseña', { exact: true }).fill('Password123!');
    await page.getByLabel('Confirmar Contraseña').fill('Password123!');
    await page
      .locator('button[type="submit"]')
      .getByText(/crear cuenta/i)
      .click();

    // Should preserve referral code through verification flow
    await expect(page).toHaveURL(/ref=TESTREF123/);
  });
});
