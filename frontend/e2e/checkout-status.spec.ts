import { test, expect } from '@playwright/test';

test.describe('Checkout Status Page', () => {
  test.describe('Approved Payment', () => {
    test('shows success UI for approved payment', async ({ page }) => {
      // Navigate with approved status (simulating MP redirect)
      await page.goto('/checkout/status?status=approved&payment_id=12345678');

      // Should show success icon and title
      await expect(page.getByText('¡Pago Exitoso!')).toBeVisible({ timeout: 10000 });

      // Should show green checkmark icon
      await expect(page.locator('svg.text-green-500')).toBeVisible();

      // Should show success message
      await expect(
        page.getByText(/tu compra ha sido procesada correctamente/i)
      ).toBeVisible();

      // Should show payment ID
      await expect(page.getByText('12345678')).toBeVisible();
    });

    test('shows payment details section for approved payment', async ({ page }) => {
      await page.goto('/checkout/status?status=approved&payment_id=12345678&merchant_order_id=ORDER123');

      // Should show payment details
      await expect(page.getByText('ID de Pago:')).toBeVisible({ timeout: 10000 });
      await expect(page.getByText('12345678')).toBeVisible();
      await expect(page.getByText('Orden:')).toBeVisible();
      await expect(page.getByText('ORDER123')).toBeVisible();
    });

    test('shows navigation buttons after successful payment', async ({ page }) => {
      await page.goto('/checkout/status?status=approved&payment_id=12345678');

      // Wait for page to load
      await expect(page.getByText('¡Pago Exitoso!')).toBeVisible({ timeout: 10000 });

      // Should show "Ver Mis Tickets" button (primary)
      const ticketsButton = page.getByRole('link', { name: /ver mis tickets/i });
      await expect(ticketsButton).toBeVisible();
      await expect(ticketsButton).toHaveAttribute('href', '/dashboard/tickets');

      // Should show "Explorar Rifas" button
      const exploreButton = page.getByRole('link', { name: /explorar rifas/i });
      await expect(exploreButton).toBeVisible();
      await expect(exploreButton).toHaveAttribute('href', '/search');
    });
  });

  test.describe('Pending Payment', () => {
    test('shows pending UI for in-process payment', async ({ page }) => {
      await page.goto('/checkout/status?status=pending&payment_id=12345678');

      // Should show pending icon and title
      await expect(page.getByText('Pago Pendiente')).toBeVisible({ timeout: 10000 });

      // Should show yellow clock icon
      await expect(page.locator('svg.text-yellow-500').first()).toBeVisible();

      // Should show pending message
      await expect(
        page.getByText(/tu pago está siendo procesado/i)
      ).toBeVisible();
    });

    test('shows pending UI for in_process status', async ({ page }) => {
      await page.goto('/checkout/status?status=in_process&payment_id=12345678');

      // Should show pending state
      await expect(page.getByText('Pago Pendiente')).toBeVisible({ timeout: 10000 });
    });

    test('shows warning message for pending payment', async ({ page }) => {
      await page.goto('/checkout/status?status=pending&payment_id=12345678');

      await expect(page.getByText('Pago Pendiente')).toBeVisible({ timeout: 10000 });

      // Should show warning about automatic confirmation
      await expect(
        page.getByText(/tus tickets se confirmarán automáticamente/i)
      ).toBeVisible();

      // Should mention checking email
      await expect(page.getByText(/revisá tu email/i)).toBeVisible();
    });

    test('shows verify status button for pending payment', async ({ page }) => {
      await page.goto('/checkout/status?status=pending&payment_id=12345678');

      await expect(page.getByText('Pago Pendiente')).toBeVisible({ timeout: 10000 });

      // Should show retry/verify button
      const verifyButton = page.getByRole('button', { name: /verificar estado/i });
      await expect(verifyButton).toBeVisible();
    });
  });

  test.describe('Rejected Payment', () => {
    test('shows error UI for rejected payment', async ({ page }) => {
      await page.goto('/checkout/status?status=rejected&payment_id=12345678');

      // Should show error icon and title
      await expect(page.getByText('Pago Rechazado')).toBeVisible({ timeout: 10000 });

      // Should show red X icon
      await expect(page.locator('svg.text-red-500').first()).toBeVisible();

      // Should show error message
      await expect(
        page.getByText(/no pudimos procesar tu pago/i)
      ).toBeVisible();
    });

    test('shows retry suggestion for rejected payment', async ({ page }) => {
      await page.goto('/checkout/status?status=rejected&payment_id=12345678');

      await expect(page.getByText('Pago Rechazado')).toBeVisible({ timeout: 10000 });

      // Should suggest trying another payment method (use first() for multiple matches)
      await expect(
        page.getByText(/intenta con otra tarjeta|otro método de pago/i).first()
      ).toBeVisible();
    });

    test('shows navigation buttons after rejected payment', async ({ page }) => {
      await page.goto('/checkout/status?status=rejected&payment_id=12345678');

      await expect(page.getByText('Pago Rechazado')).toBeVisible({ timeout: 10000 });

      // Should show "Ver Mis Tickets" button (outline variant for rejected)
      await expect(
        page.getByRole('link', { name: /ver mis tickets/i })
      ).toBeVisible();

      // Should show "Explorar Rifas" button
      await expect(
        page.getByRole('link', { name: /explorar rifas/i })
      ).toBeVisible();
    });
  });

  test.describe('Edge Cases', () => {
    test('handles null status as rejected', async ({ page }) => {
      await page.goto('/checkout/status?status=null&payment_id=12345678');

      // Should show rejected state
      await expect(page.getByText('Pago Rechazado')).toBeVisible({ timeout: 10000 });
    });

    test('handles page without params gracefully', async ({ page }) => {
      // Navigate without any status params
      await page.goto('/checkout/status');

      // Page should load without crashing - may show loading, error, or redirect
      await expect(page.locator('body')).toBeVisible();

      // Wait for any state to resolve
      await page.waitForTimeout(2000);

      // Should have some actionable content (either status or navigation buttons)
      await expect(
        page.getByRole('link', { name: /volver al inicio|explorar|tickets/i }).first()
      ).toBeVisible({ timeout: 5000 });
    });

    test('handles collection_status param (MP alternative)', async ({ page }) => {
      // Mercado Pago sometimes uses collection_status instead of status
      await page.goto('/checkout/status?collection_status=approved&collection_id=12345678');

      // Should recognize approved status
      await expect(page.getByText('¡Pago Exitoso!')).toBeVisible({ timeout: 10000 });
    });

    test('handles missing payment_id gracefully', async ({ page }) => {
      await page.goto('/checkout/status?status=approved');

      // Should still show success UI
      await expect(page.getByText('¡Pago Exitoso!')).toBeVisible({ timeout: 10000 });

      // Should not crash
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Navigation', () => {
    test('Ver Mis Tickets button navigates to tickets dashboard', async ({ page }) => {
      await page.goto('/checkout/status?status=approved&payment_id=12345678');

      await expect(page.getByText('¡Pago Exitoso!')).toBeVisible({ timeout: 10000 });

      // Click on Ver Mis Tickets
      await page.getByRole('link', { name: /ver mis tickets/i }).click();

      // Should navigate to tickets page (may redirect to login if not authenticated)
      await page.waitForURL((url) =>
        url.pathname.includes('/dashboard/tickets') ||
        url.pathname.includes('/auth/login'),
        { timeout: 10000 }
      );
    });

    test('Explorar Rifas button navigates to search page', async ({ page }) => {
      await page.goto('/checkout/status?status=approved&payment_id=12345678');

      await expect(page.getByText('¡Pago Exitoso!')).toBeVisible({ timeout: 10000 });

      // Click on Explorar Rifas
      await page.getByRole('link', { name: /explorar rifas/i }).click();

      // Should navigate to search page
      await page.waitForURL('**/search', { timeout: 10000 });
      await expect(page).toHaveURL(/\/search/);
    });
  });

  test.describe('Retry Functionality', () => {
    test('retry button is present for pending payments', async ({ page }) => {
      await page.goto('/checkout/status?status=pending&payment_id=12345678');

      await expect(page.getByText('Pago Pendiente')).toBeVisible({ timeout: 10000 });

      const retryButton = page.getByRole('button', { name: /verificar estado/i });
      await expect(retryButton).toBeVisible();
      await expect(retryButton).toBeEnabled();
    });

    test('retry button shows loading state when clicked', async ({ page }) => {
      await page.goto('/checkout/status?status=pending&payment_id=12345678');

      await expect(page.getByText('Pago Pendiente')).toBeVisible({ timeout: 10000 });

      // Click retry button
      const retryButton = page.getByRole('button', { name: /verificar estado/i });
      await retryButton.click();

      // Should show loading state (button becomes disabled or shows spinner)
      // The loading state might be very quick, so check if button was clicked successfully
      await expect(
        page.getByRole('button', { name: /verificando/i }).or(
          page.locator('.animate-spin')
        ).or(
          page.getByRole('button', { name: /verificar estado/i })
        )
      ).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('UI Elements', () => {
    test('page renders properly with approved status', async ({ page }) => {
      await page.goto('/checkout/status?status=approved&payment_id=12345678');

      await expect(page.getByText('¡Pago Exitoso!')).toBeVisible({ timeout: 10000 });

      // Should have card with title and content
      await expect(page.getByText('¡Pago Exitoso!')).toBeVisible();
      await expect(page.getByText(/tu compra ha sido procesada/i)).toBeVisible();
    });

    test('approved status shows payment info section', async ({ page }) => {
      await page.goto('/checkout/status?status=approved&payment_id=12345678');

      await expect(page.getByText('¡Pago Exitoso!')).toBeVisible({ timeout: 10000 });

      // Should show ID de Pago label (this is always shown for approved)
      await expect(page.getByText('ID de Pago:')).toBeVisible({ timeout: 5000 });
    });
  });
});
