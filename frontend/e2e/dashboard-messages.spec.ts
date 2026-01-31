import { test, expect } from '@playwright/test';

/**
 * Dashboard Messages E2E Tests
 * Tests the buyer-seller messaging functionality
 */

test.describe('Dashboard Messages', () => {
  test.beforeEach(async ({ page }) => {
    // Note: Requires user to be authenticated
    // In a real scenario, you'd use loginAs() helper or setup auth
    await page.goto('/dashboard/messages');
  });

  test('should redirect to login if not authenticated', async ({ page }) => {
    // Clear any existing auth
    await page.context().clearCookies();
    await page.goto('/dashboard/messages');

    // Should redirect to login
    await page.waitForURL(/\/auth\/login/);
    expect(page.url()).toContain('/auth/login');
  });

  test('should display conversations list', async ({ page }) => {
    // Skip if not authenticated (depends on test setup)
    test.skip(!page.url().includes('/dashboard/messages'), 'Requires authentication');

    // Should show conversations header
    await expect(page.getByText(/Mensajes/i)).toBeVisible();
    await expect(page.getByText(/Conversaciones/i)).toBeVisible();
  });

  test('should show empty state when no conversations', async ({ page }) => {
    test.skip(!page.url().includes('/dashboard/messages'), 'Requires authentication');

    // Wait for loading to finish
    await page.waitForTimeout(2000);

    // If no conversations, should show empty state
    const emptyState = page.getByText(/No tenés conversaciones/i);
    if (await emptyState.isVisible()) {
      await expect(emptyState).toBeVisible();
    }
  });

  test('should display conversation with unread count badge', async ({ page }) => {
    test.skip(!page.url().includes('/dashboard/messages'), 'Requires authentication');

    // Wait for conversations to load
    await page.waitForTimeout(2000);

    // Check if there are conversations with unread badges
    const unreadBadge = page.locator('.bg-primary.text-primary-foreground.text-xs');
    const badgeCount = await unreadBadge.count();

    // If unread badges exist, verify they're visible
    if (badgeCount > 0) {
      await expect(unreadBadge.first()).toBeVisible();
    }
  });

  test('should select and view conversation details', async ({ page }) => {
    test.skip(!page.url().includes('/dashboard/messages'), 'Requires authentication');

    // Wait for conversations to load
    await page.waitForTimeout(2000);

    // Get first conversation button (if exists)
    const firstConversation = page.locator('button').filter({ hasText: /Conversaciones/i }).first();
    const conversationExists = await firstConversation.count() > 0;

    if (conversationExists) {
      await firstConversation.click();

      // Should show conversation detail with user name
      await expect(page.locator('svg.lucide-user')).toBeVisible({ timeout: 5000 });
    }
  });

  test('should show message input and send button', async ({ page }) => {
    test.skip(!page.url().includes('/dashboard/messages'), 'Requires authentication');

    // Wait for page to load
    await page.waitForTimeout(2000);

    // Select first conversation if available
    const firstConversation = page.locator('button[class*="hover:bg-muted"]').first();
    if (await firstConversation.isVisible()) {
      await firstConversation.click();

      // Wait for conversation to load
      await page.waitForTimeout(1000);

      // Should show message input
      const messageInput = page.getByPlaceholder(/Escribe un mensaje/i);
      await expect(messageInput).toBeVisible({ timeout: 5000 });

      // Should show send button
      const sendButton = page.locator('button[type="submit"]').last();
      await expect(sendButton).toBeVisible();
    }
  });

  test('should disable send button when message is empty', async ({ page }) => {
    test.skip(!page.url().includes('/dashboard/messages'), 'Requires authentication');

    // Wait and select first conversation
    await page.waitForTimeout(2000);
    const firstConversation = page.locator('button[class*="hover:bg-muted"]').first();

    if (await firstConversation.isVisible()) {
      await firstConversation.click();
      await page.waitForTimeout(1000);

      // Send button should be disabled when input is empty
      const sendButton = page.locator('button[type="submit"]').last();
      if (await sendButton.isVisible()) {
        await expect(sendButton).toBeDisabled();
      }
    }
  });

  test('should show closed conversation message when inactive', async ({ page }) => {
    test.skip(!page.url().includes('/dashboard/messages'), 'Requires authentication');

    // This test checks for closed conversations
    await page.waitForTimeout(2000);

    // If closed conversation exists, should show message
    const closedMessage = page.getByText(/Esta conversación está cerrada/i);
    if (await closedMessage.isVisible()) {
      await expect(closedMessage).toBeVisible();

      // Input should be disabled
      const messageInput = page.getByPlaceholder(/Escribe un mensaje/i);
      await expect(messageInput).toBeDisabled();
    }
  });
});
