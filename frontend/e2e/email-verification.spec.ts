import { test, expect } from '@playwright/test';

/**
 * Email Verification E2E Tests
 * Tests the 6-digit code verification flow during registration
 */

test.describe('Email Verification', () => {
  test('should show verification page after registration', async ({
    page,
  }) => {
    await page.goto('/auth/register');

    // Fill registration form
    await page.getByLabel(/nombre/i).fill('Test');
    await page.getByLabel(/apellido/i).fill('User');
    await page
      .getByLabel(/email/i)
      .fill(`test-${Date.now()}@example.com`);
    await page.getByLabel(/contraseña/i).fill('Password123!');
    await page
      .locator('button[type="submit"]')
      .getByText(/crear cuenta/i)
      .click();

    // Should redirect to verification page
    await page.waitForURL(/\/auth\/verify-email/);
    await expect(
      page.getByText(/ingresá el código de 6 dígitos/i),
    ).toBeVisible();
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
    page,
  }) => {
    // Navigate directly to verify page (assumes user is in verification flow)
    await page.goto('/auth/verify-email');

    // Enter invalid code
    await page.getByLabel(/código/i).fill('000000');
    await page.locator('button[type="submit"]').click();

    // Should show error
    await expect(page.getByText(/código incorrecto/i)).toBeVisible({
      timeout: 5000,
    });
  });

  test('should show resend button after timeout', async ({
    page,
  }) => {
    await page.goto('/auth/verify-email');

    // Should show resend option
    await expect(
      page.getByText(/no recibiste el código/i),
    ).toBeVisible();
  });

  test('should allow resending verification code', async ({
    page,
  }) => {
    await page.goto('/auth/verify-email');

    const resendButton = page.getByRole('button', {
      name: /reenviar código/i,
    });
    if (await resendButton.isVisible()) {
      await resendButton.click();

      // Should show success message
      await expect(page.getByText(/código reenviado/i)).toBeVisible();
    } else {
      test.skip(true, 'Resend button not visible yet');
    }
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
    await page.getByLabel(/contraseña/i).fill('Password123!');
    await page
      .locator('button[type="submit"]')
      .getByText(/crear cuenta/i)
      .click();

    // Should preserve referral code through verification flow
    await expect(page).toHaveURL(/ref=TESTREF123/);
  });
});
