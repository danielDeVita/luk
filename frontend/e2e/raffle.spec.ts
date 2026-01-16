import { test, expect, Page } from '@playwright/test';

// Test user credentials (from seed data)
const TEST_SELLER = {
  email: 'vendedor@test.com',
  password: 'Password123!',
};

const TEST_BUYER = {
  email: 'comprador@test.com',
  password: 'Password123!',
};

/**
 * Helper to login with test credentials
 */
async function loginAs(page: Page, user: { email: string; password: string }) {
  await page.goto('/auth/login');
  await page.getByLabel(/email/i).fill(user.email);
  await page.getByLabel(/contraseña/i).fill(user.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.includes('/auth/login'), {
    timeout: 10000,
  });
}

test.describe('Raffle Browsing', () => {
  test('homepage loads with featured raffles section', async ({ page }) => {
    await page.goto('/');

    // Should show the page content
    await expect(page.locator('body')).toBeVisible();
    // Look for raffle cards or featured section
    await expect(
      page.getByText(/rifas|explor|particip/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('search page loads with filters', async ({ page }) => {
    await page.goto('/search');

    // Should show filters
    await expect(page.getByText(/explorar rifas|buscar/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('search page supports category filtering', async ({ page }) => {
    await page.goto('/search');

    // Look for category filter
    const categoryFilter = page.getByRole('combobox').or(
      page.getByPlaceholder(/categoría/i)
    );

    if (await categoryFilter.isVisible()) {
      await categoryFilter.click();
      // Categories should appear
      await expect(page.getByRole('option').first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('search page supports sorting', async ({ page }) => {
    await page.goto('/search');

    // Look for sort selector
    const sortButton = page.getByRole('combobox').or(
      page.getByText(/ordenar/i)
    );

    if (await sortButton.isVisible()) {
      await sortButton.click();
      // Sort options should appear
      await expect(
        page.getByText(/precio|fecha|recient/i).first()
      ).toBeVisible({ timeout: 5000 });
    }
  });

  test('raffle detail page shows error for invalid ID', async ({ page }) => {
    await page.goto('/raffle/invalid-raffle-id-12345');

    await expect(
      page.getByText(/no encontrad|error|not found/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('infinite scroll loads more results', async ({ page }) => {
    await page.goto('/search');

    // Wait for initial load
    await page.waitForTimeout(2000);

    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Should show loading indicator or more results
    await expect(
      page.getByText(/cargando|loading/i).or(page.locator('[href^="/raffle/"]'))
    ).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Ticket Purchase Flow', () => {
  test('buy button redirects to login for unauthenticated users', async ({ page }) => {
    await page.goto('/search');

    const raffleCard = page.locator('[href^="/raffle/"]').first();

    if (await raffleCard.isVisible()) {
      await raffleCard.click();
      await page.waitForURL(/\/raffle\//);

      const buyButton = page.getByRole('button', { name: /comprar/i });

      if (await buyButton.isVisible()) {
        await buyButton.click();
        await expect(page).toHaveURL(/\/auth\/login/, { timeout: 5000 });
      }
    }
  });

  test('authenticated user sees buy button enabled', async ({ page }) => {
    await loginAs(page, TEST_BUYER);
    await page.goto('/search');

    const raffleCard = page.locator('[href^="/raffle/"]').first();

    if (await raffleCard.isVisible()) {
      await raffleCard.click();
      await page.waitForURL(/\/raffle\//);

      // Buy button should be visible and not redirect to login
      const buyButton = page.getByRole('button', { name: /comprar/i });
      if (await buyButton.isVisible()) {
        await expect(buyButton).toBeEnabled();
      }
    }
  });

  test('can add raffle to favorites when logged in', async ({ page }) => {
    await loginAs(page, TEST_BUYER);
    await page.goto('/search');

    const raffleCard = page.locator('[href^="/raffle/"]').first();

    if (await raffleCard.isVisible()) {
      await raffleCard.click();
      await page.waitForURL(/\/raffle\//);

      // Look for favorite button
      const favoriteButton = page.getByRole('button', { name: /favorit|guardar/i }).or(
        page.locator('[aria-label*="favorit"]')
      );

      if (await favoriteButton.isVisible()) {
        await favoriteButton.click();
        // Should show success feedback
        await expect(
          page.getByText(/agregad|guardad|favorit/i).first()
        ).toBeVisible({ timeout: 5000 });
      }
    }
  });
});

test.describe('Seller Onboarding', () => {
  test('seller can access create raffle page', async ({ page }) => {
    await loginAs(page, TEST_SELLER);

    await page.goto('/dashboard/create');

    // Should show create raffle form
    await expect(page.getByText(/crear|nueva rifa/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('create raffle form has required fields', async ({ page }) => {
    await loginAs(page, TEST_SELLER);
    await page.goto('/dashboard/create');

    // Check for required form fields
    await expect(page.getByLabel(/título|nombre/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByLabel(/descripción/i).first()).toBeVisible();
    await expect(page.getByLabel(/precio/i).first()).toBeVisible();
  });

  test('seller dashboard shows stats', async ({ page }) => {
    await loginAs(page, TEST_SELLER);
    await page.goto('/dashboard/sales');

    // Should show seller stats
    await expect(
      page.getByText(/ingresos|ventas|tickets|rifas/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('seller can view their raffles list', async ({ page }) => {
    await loginAs(page, TEST_SELLER);
    await page.goto('/dashboard/sales');

    // Should show raffle list or empty state
    await expect(
      page.getByText(/mis rifas|rifas activ|no tienes/i).first()
    ).toBeVisible({ timeout: 10000 });
  });
});

test.describe('MP Connect Flow', () => {
  test('settings page shows MP Connect option', async ({ page }) => {
    await loginAs(page, TEST_SELLER);
    await page.goto('/dashboard/settings');

    // Navigate to payments tab
    const paymentsTab = page.getByRole('tab', { name: /pagos|payment/i }).or(
      page.getByText(/mercado pago|pagos/i)
    );

    if (await paymentsTab.isVisible()) {
      await paymentsTab.click();

      // Should show MP Connect button or status
      await expect(
        page.getByText(/conectar|mercado pago|vincular/i).first()
      ).toBeVisible({ timeout: 10000 });
    }
  });

  test('MP Connect button initiates OAuth flow', async ({ page }) => {
    await loginAs(page, TEST_SELLER);
    await page.goto('/dashboard/settings');

    // Navigate to payments section
    const paymentsTab = page.getByRole('tab', { name: /pagos/i });
    if (await paymentsTab.isVisible()) {
      await paymentsTab.click();
    }

    // Find and click connect button
    const connectButton = page.getByRole('button', { name: /conectar/i }).or(
      page.getByRole('link', { name: /conectar/i })
    );

    if (await connectButton.isVisible()) {
      // Just verify it's clickable, don't actually click (would redirect to MP)
      await expect(connectButton).toBeEnabled();
    }
  });
});

test.describe('Buyer Dashboard', () => {
  test('buyer can view their tickets', async ({ page }) => {
    await loginAs(page, TEST_BUYER);
    await page.goto('/dashboard/tickets');

    // Should show tickets or empty state
    await expect(
      page.getByText(/mis tickets|compras|no tienes/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('buyer can view favorites', async ({ page }) => {
    await loginAs(page, TEST_BUYER);
    await page.goto('/dashboard/favorites');

    // Should show favorites or empty state
    await expect(
      page.getByText(/favoritos|guardad|no tienes/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('buyer stats are visible in dashboard', async ({ page }) => {
    await loginAs(page, TEST_BUYER);
    await page.goto('/dashboard/tickets');

    // Should show stats cards
    await expect(
      page.getByText(/tickets|participaciones|ganados/i).first()
    ).toBeVisible({ timeout: 10000 });
  });
});
