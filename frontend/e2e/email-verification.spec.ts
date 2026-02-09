import { test, expect } from '@playwright/test';

/**
 * Email Verification E2E Tests
 * Tests the 6-digit code verification flow during registration
 */

test.describe('Email Verification', () => {
  // Skip in CI - registration triggers email sending via Brevo. CI has a fake API key
  // so the email call fails, and the verification page may not render correctly.
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

  // The 6-digit verification code is sent via Brevo email. There's no way to
  // retrieve it in tests without a test email inbox service or a backend
  // endpoint that returns the code directly.
  test('should auto-login with correct verification code', async ({
    page: _page,
  }) => {
    test.skip(
      true,
      'Requires test email service or backend test endpoint for code retrieval',
    );
  });

  // The /auth/verify-email page redirects away unless there's an active
  // verification session (set during registration). Can't test in isolation.
  test('should show error for wrong verification code', async ({
    page: _page,
  }) => {
    test.skip(true, 'Requires active verification session to access verify-email page');
  });

  // Same as above — verify-email page requires an active session from registration.
  test('should show resend button after timeout', async ({
    page: _page,
  }) => {
    test.skip(true, 'Requires active verification session to access verify-email page');
  });

  // Same as above — verify-email page requires an active session from registration.
  test('should allow resending verification code', async ({
    page: _page,
  }) => {
    test.skip(true, 'Requires active verification session to access verify-email page');
  });

  // Testing the 3-attempt lockout requires a backend endpoint to simulate
  // failed verification attempts without a real code.
  test('should enforce max 3 verification attempts', async ({
    page: _page,
  }) => {
    test.skip(
      true,
      'Requires backend test endpoint to simulate failed attempts',
    );
  });

  // The 15-minute code expiry would require mocking Date.now() or a backend
  // endpoint to fast-forward the expiry timer — not feasible in E2E tests.
  test('should show code expiry message after 15 minutes', async ({
    page: _page,
  }) => {
    test.skip(true, 'Requires time manipulation in test environment');
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
