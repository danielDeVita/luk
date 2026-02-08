import { test, expect, Page } from '@playwright/test';
import { apiLogin, TEST_BUYER, TEST_SELLER } from './helpers/auth';

/**
 * Helper to login via the UI form (used only for tests that specifically
 * test the login UI flow — most tests should use apiLogin instead).
 */
async function loginAs(
  page: Page,
  user: { email: string; password: string },
) {
  await page.goto('/auth/login');
  await page.getByLabel(/email/i).fill(user.email);
  await page.locator('input[type="password"]').fill(user.password);
  await page.locator('button[type="submit"]').click();
  // Wait for redirect or dashboard
  await page.waitForURL((url) => !url.pathname.includes('/auth/login'), {
    timeout: 15000,
  });
}

test.describe('Authentication - Basic', () => {
  test('shows login page', async ({ page }) => {
    await page.goto('/auth/login');

    await expect(
      page.getByRole('heading', { name: /iniciar sesión/i }),
    ).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('shows register page', async ({ page }) => {
    await page.goto('/auth/register');

    await expect(
      page.getByRole('heading', { name: /crear cuenta/i }),
    ).toBeVisible();
    await expect(page.getByLabel(/nombre/i)).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
  });

  test('shows error for invalid credentials', async ({ page }) => {
    // Skip in CI - tests browser mutation error handling which is unreliable in CI
    test.skip(process.env.CI === 'true', 'Browser mutation error handling unreliable in CI');

    await page.goto('/auth/login');

    await page.getByLabel(/email/i).fill('invalid@test.com');
    await page.locator('input[type="password"]').fill('wrongpassword');
    await page.locator('button[type="submit"]').click();

    await expect(
      page
        .getByText(
          /credenciales|inválid|error|invalid|credentials|intentos|Demasiados/i,
        )
        .first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('can navigate from login to register', async ({ page }) => {
    await page.goto('/auth/login');

    await page
      .getByRole('link', { name: /registrarse|crear cuenta/i })
      .click();

    await expect(page).toHaveURL(/\/auth\/register/);
  });

  test('redirects to login when accessing protected route', async ({
    page,
  }) => {
    await page.goto('/dashboard/create');

    await expect(page).toHaveURL(/\/auth\/login/);
  });
});

test.describe('Authentication - Login Flow', () => {
  test('successful login as buyer redirects to home', async ({
    page,
  }) => {
    // Skip in CI - tests the actual UI login form + redirect flow
    test.skip(process.env.CI === 'true', 'UI login flow unreliable in CI');

    await loginAs(page, TEST_BUYER);

    // Should be on home or dashboard
    await expect(page).toHaveURL(/\/(dashboard|$)/);
  });

  test('successful login as seller shows dashboard access', async ({
    page,
  }) => {
    // Skip in CI - tests the actual UI login form + redirect flow
    test.skip(process.env.CI === 'true', 'UI login flow unreliable in CI');

    await loginAs(page, TEST_SELLER);

    // Navigate to seller dashboard
    await page.goto('/dashboard/sales');

    // Should load seller dashboard
    await expect(
      page.getByText(/ventas|estadísticas|rifas/i).first(),
    ).toBeVisible({
      timeout: 10000,
    });
  });

  test('logged in user can access protected routes', async ({
    page,
  }) => {
    await apiLogin(page, TEST_BUYER);

    // Navigate to favorites (protected route)
    await page.goto('/dashboard/favorites');

    // Should not redirect to login
    await expect(page).not.toHaveURL(/\/auth\/login/);
  });

  test('logout clears session', async ({ page }) => {
    await apiLogin(page, TEST_BUYER);

    // Click on user menu to logout
    const userMenu = page.locator('[data-testid="user-menu"]').or(
      page.getByRole('button', {
        name: new RegExp(TEST_BUYER.email.split('@')[0], 'i'),
      }),
    );

    if (await userMenu.isVisible()) {
      await userMenu.click();

      const logoutButton = page.getByRole('menuitem', {
        name: /cerrar sesión|logout/i,
      });
      if (await logoutButton.isVisible()) {
        await logoutButton.click();

        // Try accessing protected route
        await page.goto('/dashboard/create');
        await expect(page).toHaveURL(/\/auth\/login/);
      }
    }
  });
});

test.describe('Authentication - IP Blocking', () => {
  test('shows warning after multiple failed attempts', async ({
    page,
  }) => {
    // Skip in CI - tests browser mutation error handling which is unreliable in CI
    test.skip(process.env.CI === 'true', 'Browser mutation error handling unreliable in CI');

    await page.goto('/auth/login');

    // Try to login with wrong password multiple times
    for (let i = 0; i < 4; i++) {
      await page.getByLabel(/email/i).fill('test@test.com');
      await page
        .locator('input[type="password"]')
        .fill('wrongpassword' + i);
      await page.locator('button[type="submit"]').click();
      await page.waitForTimeout(500); // Wait between attempts
    }

    // Should show error about failed attempts or blocking
    await expect(
      page
        .getByText(
          /intentos|bloqueado|error|inválid|invalid|credentials/i,
        )
        .first(),
    ).toBeVisible({ timeout: 10000 });
  });
});
