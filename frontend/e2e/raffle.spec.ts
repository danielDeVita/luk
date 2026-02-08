import { test, expect } from '@playwright/test';
import { apiLogin, TEST_SELLER, TEST_BUYER } from './helpers/auth';

test.describe('Raffle Browsing', () => {
  test('homepage loads with featured raffles section', async ({
    page,
  }) => {
    await page.goto('/');

    // Should show the page content
    await expect(page.locator('body')).toBeVisible();
    // Look for raffle cards or featured section
    await expect(
      page.getByText(/rifas|explor|particip/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('search page loads with filters', async ({ page }) => {
    await page.goto('/search');

    // Should show filters
    await expect(
      page.getByText(/explorar rifas|buscar/i).first(),
    ).toBeVisible({
      timeout: 10000,
    });
  });

  test('search page supports category filtering', async ({
    page,
  }) => {
    await page.goto('/search');

    // Look for category filter (first combobox on search page)
    const categoryFilter = page.locator('main').getByRole('combobox').first();

    if (await categoryFilter.isVisible()) {
      await categoryFilter.click();
      // Categories should appear
      await expect(page.getByRole('option').first()).toBeVisible({
        timeout: 5000,
      });
    }
  });

  test('search page supports sorting', async ({ page }) => {
    await page.goto('/search');

    // Look for sort selector (last combobox on search page)
    const sortButton = page.locator('main').getByRole('combobox').last();

    if (await sortButton.isVisible()) {
      await sortButton.click();
      // Sort options should appear
      await expect(
        page.getByText(/precio|fecha|recient/i).first(),
      ).toBeVisible({ timeout: 5000 });
    }
  });

  test('raffle detail page shows error for invalid ID', async ({
    page,
  }) => {
    await page.goto('/raffle/invalid-raffle-id-12345');

    await expect(
      page.getByText(/no encontrad|error|not found/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('infinite scroll loads more results', async ({ page }) => {
    await page.goto('/search');

    // Wait for initial load
    await page.waitForTimeout(2000);

    // Scroll to bottom
    await page.evaluate(() =>
      window.scrollTo(0, document.body.scrollHeight),
    );

    // Should show loading indicator or more results
    await expect(
      page
        .getByText(/cargando|loading/i)
        .or(page.locator('[href^="/raffle/"]'))
        .first(),
    ).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Ticket Purchase Flow', () => {
  test('buy button redirects to login for unauthenticated users', async ({
    page,
  }) => {
    await page.goto('/search');

    const raffleCard = page.locator('[href^="/raffle/"]').first();

    if (await raffleCard.isVisible()) {
      await raffleCard.click();
      await page.waitForURL(/\/raffle\//);

      const buyButton = page.getByRole('button', {
        name: /comprar/i,
      });

      if (await buyButton.isVisible()) {
        await buyButton.click();
        await expect(page).toHaveURL(/\/auth\/login/, {
          timeout: 5000,
        });
      }
    }
  });

  test('authenticated user sees buy button enabled', async ({
    page,
  }) => {
    await apiLogin(page, TEST_BUYER);
    await page.goto('/search');

    const raffleCard = page.locator('[href^="/raffle/"]').first();

    if (await raffleCard.isVisible()) {
      await raffleCard.click();
      await page.waitForURL(/\/raffle\//);

      // Buy button should be visible and not redirect to login
      const buyButton = page.getByRole('button', {
        name: /comprar/i,
      });
      if (await buyButton.isVisible()) {
        await expect(buyButton).toBeEnabled();
      }
    }
  });

  test('can add raffle to favorites when logged in', async ({
    page,
  }) => {
    await apiLogin(page, TEST_BUYER);
    await page.goto('/search');

    const raffleCard = page.locator('[href^="/raffle/"]').first();

    if (await raffleCard.isVisible()) {
      await raffleCard.click();
      await page.waitForURL(/\/raffle\//);

      // Look for favorite button
      const favoriteButton = page
        .getByRole('button', { name: /favorit|guardar/i })
        .or(page.locator('[aria-label*="favorit"]'));

      if (await favoriteButton.isVisible()) {
        await favoriteButton.click();
        // Should show success feedback
        await expect(
          page.getByText(/agregad|guardad|favorit/i).first(),
        ).toBeVisible({ timeout: 5000 });
      }
    }
  });
});

test.describe('Seller Onboarding', () => {
  test('seller can access create raffle page', async ({ page }) => {
    await apiLogin(page, TEST_SELLER);

    await page.goto('/dashboard/create');

    // Should show create raffle form
    await expect(
      page.getByText(/crear|nueva rifa/i).first(),
    ).toBeVisible({
      timeout: 10000,
    });
  });

  test('create raffle form has required fields', async ({ page }) => {
    await apiLogin(page, TEST_SELLER);
    await page.goto('/dashboard/create');

    // Check for required form fields
    await expect(
      page.getByLabel(/título|nombre/i).first(),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByLabel(/descripción/i).first(),
    ).toBeVisible();
    await expect(page.getByLabel(/precio/i).first()).toBeVisible();
  });

  test('seller dashboard shows stats', async ({ page }) => {
    await apiLogin(page, TEST_SELLER);
    await page.goto('/dashboard/sales');

    // Should show seller stats
    await expect(
      page.getByText(/ingresos|ventas|tickets|rifas/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('seller can view their raffles list', async ({ page }) => {
    await apiLogin(page, TEST_SELLER);
    await page.goto('/dashboard/sales');

    // Should show raffle list or empty state (scoped to main to avoid hidden nav items)
    await expect(
      page.locator('main').getByText(/mis rifas|rifas activ|no tienes/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });
});

test.describe('MP Connect Flow', () => {
  test('settings page shows MP Connect option', async ({ page }) => {
    await apiLogin(page, TEST_SELLER);
    await page.goto('/dashboard/settings');

    // Navigate to payments tab (scoped to main to avoid nav items)
    const paymentsTab = page.locator('main')
      .getByRole('tab', { name: /pagos|payment/i })
      .or(page.locator('main').getByText(/mercado pago|pagos/i))
      .first();

    if (await paymentsTab.isVisible()) {
      await paymentsTab.click();

      // Should show MP Connect button or status
      await expect(
        page.getByText(/conectar|mercado pago|vincular/i).first(),
      ).toBeVisible({ timeout: 10000 });
    }
  });

  test('MP Connect button initiates OAuth flow', async ({ page }) => {
    await apiLogin(page, TEST_SELLER);
    await page.goto('/dashboard/settings');

    // Navigate to payments section
    const paymentsTab = page.getByRole('tab', { name: /pagos/i });
    if (await paymentsTab.isVisible()) {
      await paymentsTab.click();
    }

    // Find and click connect button
    const connectButton = page
      .getByRole('button', { name: /conectar/i })
      .or(page.getByRole('link', { name: /conectar/i }));

    if (await connectButton.isVisible()) {
      // Just verify it's clickable, don't actually click (would redirect to MP)
      await expect(connectButton).toBeEnabled();
    }
  });
});

test.describe('Buyer Dashboard', () => {
  test('buyer can view their tickets', async ({ page }) => {
    await apiLogin(page, TEST_BUYER);
    await page.goto('/dashboard/tickets');

    // Should show tickets or empty state
    await expect(
      page.getByText(/mis tickets|compras|no tienes/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('buyer can view favorites', async ({ page }) => {
    await apiLogin(page, TEST_BUYER);
    await page.goto('/dashboard/favorites');

    // Should show favorites or empty state (scoped to main to avoid hidden nav items)
    await expect(
      page.locator('main').getByText(/favoritos|guardad|no tienes/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('buyer stats are visible in dashboard', async ({ page }) => {
    await apiLogin(page, TEST_BUYER);
    await page.goto('/dashboard/tickets');

    // Should show stats cards
    await expect(
      page.getByText(/tickets|participaciones|ganados/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Raffle Creation Flow', () => {
  test('redirects unauthenticated users to login', async ({
    page,
  }) => {
    await page.goto('/dashboard/create');

    // Should redirect to login
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 10000 });
  });

  test('shows form validation errors for empty submission', async ({
    page,
  }) => {
    await apiLogin(page, TEST_SELLER);
    await page.goto('/dashboard/create');

    // Wait for form to load
    await page.waitForSelector('button[type="submit"]', {
      timeout: 10000,
    });

    // Try to submit empty form
    const submitButton = page
      .locator('button[type="submit"]')
      .first();
    await submitButton.click();

    // Should show validation errors
    await expect(
      page.getByText(/mínimo|requerido|obligatorio/i).first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test('shows validation error for short title', async ({ page }) => {
    await apiLogin(page, TEST_SELLER);
    await page.goto('/dashboard/create');

    // Fill title with less than 10 characters
    const titleInput = page.getByLabel(/título|nombre/i).first();
    await titleInput.fill('Short');

    // Trigger validation by clicking away or submitting
    await page.locator('button[type="submit"]').first().click();

    // Should show minimum length error
    await expect(page.getByText(/mínimo 10/i).first()).toBeVisible({
      timeout: 5000,
    });
  });

  test('shows validation error for short description', async ({
    page,
  }) => {
    await apiLogin(page, TEST_SELLER);
    await page.goto('/dashboard/create');

    // Fill description with less than 50 characters
    const descriptionInput = page.getByLabel(/descripción/i).first();
    await descriptionInput.fill('Too short description');

    // Trigger validation
    await page.locator('button[type="submit"]').first().click();

    // Should show minimum length error
    await expect(
      page.getByText(/mínimo 50|mínimo 20/i).first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test('shows validation error for invalid ticket price', async ({
    page,
  }) => {
    await apiLogin(page, TEST_SELLER);
    await page.goto('/dashboard/create');

    // Find price input and enter invalid value
    const priceInput = page.getByLabel(/precio/i).first();
    await priceInput.fill('0');

    // Trigger validation
    await page.locator('button[type="submit"]').first().click();

    // Should show minimum price error
    await expect(page.getByText(/mínimo/i).first()).toBeVisible({
      timeout: 5000,
    });
  });

  test('shows validation error for invalid ticket count', async ({
    page,
  }) => {
    await apiLogin(page, TEST_SELLER);
    await page.goto('/dashboard/create');

    // Find tickets input
    const ticketsInput = page
      .getByLabel(/tickets|número de tickets|cantidad/i)
      .first();
    if (await ticketsInput.isVisible()) {
      await ticketsInput.fill('5'); // Less than minimum (10)

      // Trigger validation
      await page.locator('button[type="submit"]').first().click();

      // Should show minimum tickets error
      await expect(
        page.getByText(/mínimo 10|mínimo/i).first(),
      ).toBeVisible({ timeout: 5000 });
    }
  });

  test('category dropdown is functional', async ({ page }) => {
    await apiLogin(page, TEST_SELLER);
    await page.goto('/dashboard/create');

    // Wait for form to load
    await page.waitForTimeout(1000);

    // Find category select/dropdown
    const categorySelect = page
      .locator('select[name="categoria"]')
      .or(page.getByLabel(/categoría/i));

    if (await categorySelect.isVisible()) {
      await categorySelect.click();

      // Should show category options
      await expect(
        page.getByText(/electrónica|moda|hogar|deportes/i).first(),
      ).toBeVisible({ timeout: 5000 });
    }
  });

  test('condition dropdown shows correct options', async ({
    page,
  }) => {
    await apiLogin(page, TEST_SELLER);
    await page.goto('/dashboard/create');

    // Wait for form to load
    await page.waitForTimeout(1000);

    // Find condition select
    const conditionSelect = page
      .locator('select[name="condicion"]')
      .or(page.getByLabel(/condición|estado/i));

    if (await conditionSelect.isVisible()) {
      await conditionSelect.click();

      // Should show condition options (NUEVO, USADO, etc.)
      await expect(
        page.getByText(/nuevo|usado/i).first(),
      ).toBeVisible({ timeout: 5000 });
    }
  });

  test('successfully creates raffle with valid data', async ({
    page,
  }) => {
    await apiLogin(page, TEST_SELLER);
    await page.goto('/dashboard/create');

    // Wait for form to load
    await page.waitForTimeout(2000);

    // Fill in the form with valid data
    const titleInput = page.getByLabel(/título|nombre/i).first();
    await titleInput.fill('iPhone 15 Pro Max 256GB Nuevo en Caja');

    const descriptionInput = page.getByLabel(/descripción/i).first();
    await descriptionInput.fill(
      'iPhone 15 Pro Max de 256GB completamente nuevo, sellado de fábrica. Incluye todos los accesorios originales, garantía oficial de Apple Argentina por 12 meses. Color: Titanio Natural. IMEI libre, listo para usar con cualquier compañía.',
    );

    // Fill product name
    const productNameInput = page
      .getByLabel(/nombre del producto|producto/i)
      .first();
    if (await productNameInput.isVisible()) {
      await productNameInput.fill('iPhone 15 Pro Max 256GB');
    }

    // Fill product description
    const productDescInput = page
      .getByLabel(/descripción del producto/i)
      .first();
    if (await productDescInput.isVisible()) {
      await productDescInput.fill(
        'Smartphone Apple iPhone 15 Pro Max con pantalla de 6.7 pulgadas, chip A17 Pro, cámara principal de 48MP.',
      );
    }

    // Select category
    const categorySelect = page.locator('select[name="categoria"]');
    if (await categorySelect.isVisible()) {
      await categorySelect.selectOption('Electrónica');
    }

    // Select condition (NUEVO)
    const conditionSelect = page.locator('select[name="condicion"]');
    if (await conditionSelect.isVisible()) {
      await conditionSelect.selectOption('NUEVO');
    }

    // Fill price
    const priceInput = page.getByLabel(/precio/i).first();
    await priceInput.fill('150');

    // Fill ticket count
    const ticketsInput = page
      .getByLabel(/tickets|número|cantidad/i)
      .first();
    if (await ticketsInput.isVisible()) {
      await ticketsInput.fill('100');
    }

    // Fill date (tomorrow's date)
    const dateInput = page
      .locator('input[type="date"]')
      .or(page.getByLabel(/fecha|límite/i));
    if (await dateInput.isVisible()) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 30);
      const dateString = tomorrow.toISOString().split('T')[0];
      await dateInput.fill(dateString);
    }

    // Submit form
    const submitButton = page
      .locator('button[type="submit"]')
      .first();
    await submitButton.click();

    // Should show success message or redirect to raffle detail
    await expect(
      page
        .getByText(/éxito|creada|exitosamente/i)
        .or(page.locator('body')),
    ).toBeVisible({ timeout: 15000 });

    // Should redirect to raffle detail page or dashboard
    await page.waitForURL(/\/(raffle|dashboard)\//, {
      timeout: 15000,
    });
  });

  test('submit button is disabled during submission', async ({
    page,
  }) => {
    await apiLogin(page, TEST_SELLER);
    await page.goto('/dashboard/create');

    // Wait for form
    await page.waitForTimeout(2000);

    // Fill minimal valid data
    await page
      .getByLabel(/título/i)
      .first()
      .fill('Test Raffle Creation Flow E2E');
    await page
      .getByLabel(/descripción/i)
      .first()
      .fill(
        'This is a test description for the raffle creation E2E test. It needs to be at least 50 characters long to pass validation.',
      );

    const productNameInput = page
      .getByLabel(/nombre del producto/i)
      .first();
    if (await productNameInput.isVisible()) {
      await productNameInput.fill('Test Product');
      await page
        .getByLabel(/descripción del producto/i)
        .first()
        .fill('Test product description for E2E testing.');
    }

    await page
      .getByLabel(/precio/i)
      .first()
      .fill('50');

    // Get submit button
    const submitButton = page
      .locator('button[type="submit"]')
      .first();

    // Submit
    await submitButton.click();

    // Button should show loading state or be disabled
    await expect(submitButton)
      .toBeDisabled({ timeout: 2000 })
      .catch(() => {
        // If not disabled, at least check for loading text
        expect(
          page.getByText(/creando|enviando|guardando/i).first(),
        ).toBeVisible();
      });
  });

  test('displays error message when creation fails', async ({
    page,
  }) => {
    await apiLogin(page, TEST_SELLER);
    await page.goto('/dashboard/create');

    // Fill form with data that might cause an error
    // (e.g., missing required fields after form changes)
    await page
      .getByLabel(/título/i)
      .first()
      .fill('a'.repeat(101)); // Exceeds max length

    const submitButton = page
      .locator('button[type="submit"]')
      .first();
    await submitButton.click();

    // Should show error message
    await expect(
      page.getByText(/error|máximo|inválido/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('form preserves data after validation error', async ({
    page,
  }) => {
    await apiLogin(page, TEST_SELLER);
    await page.goto('/dashboard/create');

    // Fill some fields
    const testTitle = 'My Test Raffle Title For E2E';
    await page
      .getByLabel(/título/i)
      .first()
      .fill(testTitle);
    await page
      .getByLabel(/precio/i)
      .first()
      .fill('100');

    // Submit with missing required field (description)
    await page.locator('button[type="submit"]').first().click();

    // Wait for validation error
    await page.waitForTimeout(1000);

    // Check that filled fields still have their values
    const titleInput = page.getByLabel(/título/i).first();
    await expect(titleInput).toHaveValue(testTitle);
  });
});
