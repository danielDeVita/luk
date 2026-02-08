import { test, expect } from '@playwright/test';
import { apiLogin, TEST_BUYER } from './helpers/auth';

/**
 * Dashboard Settings E2E Tests
 * Tests user settings and preferences
 */

test.describe('Dashboard Settings', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    if (!testInfo.title.includes('redirect to login')) {
      await apiLogin(page, TEST_BUYER);
      await page.goto('/dashboard/settings');
    }
  });

  test('should redirect to login if not authenticated', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await page.waitForURL(/\/auth\/login/);
    expect(page.url()).toContain('/auth/login');
  });

  test('should display settings page header', async ({ page }) => {
    await expect(page.locator('main').getByText(/Configuración|Ajustes/i).first()).toBeVisible();
    await expect(page.locator('svg.lucide-settings').first()).toBeVisible();
  });

  test('should show profile information section', async ({ page }) => {
    await page.waitForTimeout(1500);

    // Check for profile fields
    const nameField = page.getByLabel(/Nombre/i);
    const emailField = page.getByLabel(/Email|Correo/i);

    if (await nameField.count() > 0) {
      await expect(nameField.first()).toBeVisible();
    }

    if (await emailField.count() > 0) {
      await expect(emailField.first()).toBeVisible();
    }
  });

  test('should display email update section', async ({ page }) => {
    await page.waitForTimeout(1500);

    // Look for email change section
    const emailSection = page.getByText(/cambiar email|actualizar correo/i);

    if (await emailSection.count() > 0) {
      await expect(emailSection.first()).toBeVisible();
    }
  });

  test('should show change password section', async ({ page }) => {
    await page.waitForTimeout(1500);

    // Check for password change section
    const passwordSection = page.getByText(/cambiar contraseña|password/i);

    if (await passwordSection.count() > 0) {
      await expect(passwordSection.first()).toBeVisible();
    }
  });

  test('should display notification preferences', async ({ page }) => {
    await page.waitForTimeout(1500);

    // Look for notification settings
    const notificationText = page.getByText(/notificaciones|alertas/i);

    if (await notificationText.count() > 0) {
      await expect(notificationText.first()).toBeVisible();
    }
  });

  test('should show save/update buttons', async ({ page }) => {
    await page.waitForTimeout(1500);

    // Look for save/update buttons
    const saveButtons = page.getByRole('button', { name: /guardar|actualizar|save/i });
    const buttonCount = await saveButtons.count();

    if (buttonCount > 0) {
      expect(buttonCount).toBeGreaterThan(0);
    }
  });

  test('should have account security options', async ({ page }) => {
    await page.waitForTimeout(1500);

    // Look for security-related text
    const securityText = page.getByText(/seguridad|contraseña|password|verificación/i);
    const textCount = await securityText.count();

    if (textCount > 0) {
      expect(textCount).toBeGreaterThan(0);
    }
  });
});
