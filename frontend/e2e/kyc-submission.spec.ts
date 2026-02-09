import { test, expect } from '@playwright/test';
import {
  apiLogin,
  TEST_SELLER,
  TEST_UNVERIFIED,
  TEST_PENDING_KYC,
  TEST_REJECTED_KYC,
} from './helpers/auth';

/**
 * KYC Submission E2E Tests
 * Tests the KYC verification flow for sellers.
 *
 * KYC lives at /dashboard/settings under the "Verificación" tab.
 * Seed data provides users in each KYC state:
 * - unverified@test.com    → NOT_SUBMITTED (sees form)
 * - pending-kyc@test.com   → PENDING_REVIEW (sees pending message)
 * - rejected-kyc@test.com  → REJECTED (sees rejection alert + form)
 * - vendedor@test.com      → VERIFIED (sees verified badge)
 */

test.describe('KYC Submission', () => {
  test('should show KYC form for unverified user', async ({ page }) => {
    await apiLogin(page, TEST_UNVERIFIED);
    await page.goto('/dashboard/settings');

    // Click the Verificación tab
    await page.getByRole('tab', { name: /verificación/i }).click();

    // Should show the KYC form with document fields
    await expect(
      page.getByText(/documento de identidad/i),
    ).toBeVisible({ timeout: 10000 });

    // Should have document type selector and number input
    await expect(page.getByText(/tipo de documento/i)).toBeVisible();
    await expect(page.getByLabel(/número de documento/i)).toBeVisible();
  });

  test('should show pending status for user with KYC PENDING_REVIEW', async ({
    page,
  }) => {
    await apiLogin(page, TEST_PENDING_KYC);
    await page.goto('/dashboard/settings');

    // Click the Verificación tab
    await page.getByRole('tab', { name: /verificación/i }).click();

    // Should show pending message
    await expect(
      page.getByText(/verificación en proceso/i),
    ).toBeVisible({ timeout: 10000 });
  });

  test('should show rejection reason for user with KYC REJECTED', async ({
    page,
  }) => {
    await apiLogin(page, TEST_REJECTED_KYC);
    await page.goto('/dashboard/settings');

    // Click the Verificación tab
    await page.getByRole('tab', { name: /verificación/i }).click();

    // Should show rejection alert
    await expect(
      page.getByText(/verificación rechazada/i),
    ).toBeVisible({ timeout: 10000 });

    // Should show rejection reason
    await expect(
      page.getByText(/documento ilegible/i),
    ).toBeVisible();
  });

  test('should show form below rejection for resubmission', async ({
    page,
  }) => {
    await apiLogin(page, TEST_REJECTED_KYC);
    await page.goto('/dashboard/settings');

    // Click the Verificación tab
    await page.getByRole('tab', { name: /verificación/i }).click();

    // Should show rejection alert AND form for resubmission
    await expect(
      page.getByText(/verificación rechazada/i),
    ).toBeVisible({ timeout: 10000 });

    // Should also show the form below for resubmission
    await expect(
      page.getByText(/documento de identidad/i),
    ).toBeVisible();

    // Resubmission instruction text
    await expect(
      page.getByText(/volver a enviar/i),
    ).toBeVisible();
  });

  test('should show verified status for KYC-approved user', async ({
    page,
  }) => {
    await apiLogin(page, TEST_SELLER);
    await page.goto('/dashboard/settings');

    // Click the Verificación tab
    await page.getByRole('tab', { name: /verificación/i }).click();

    // Should show verified status
    await expect(
      page.getByText(/identidad verificada/i),
    ).toBeVisible({ timeout: 10000 });
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

  // Full KYC submission requires Cloudinary for document photo upload.
  // In CI there is no Cloudinary config, so this test is skipped.
  test('should fill KYC form and submit', async ({ page }) => {
    test.skip(
      true,
      'Full KYC submission requires Cloudinary for document photo upload',
    );

    await apiLogin(page, TEST_UNVERIFIED);
    await page.goto('/dashboard/settings');
    await page.getByRole('tab', { name: /verificación/i }).click();

    // Fill form fields
    await page.getByLabel(/número de documento/i).fill('12345678');
    await page.locator('button[type="submit"]').click();
  });

  // Validating required fields requires interacting with the form
  // which needs document photo upload (Cloudinary).
  test('should validate required KYC fields', async ({ page }) => {
    test.skip(
      true,
      'KYC form validation requires Cloudinary for document photo fields',
    );

    await apiLogin(page, TEST_UNVERIFIED);
    await page.goto('/dashboard/settings');
    await page.getByRole('tab', { name: /verificación/i }).click();

    await page.locator('button[type="submit"]').click();
    await expect(
      page.getByText(/obligatorio|requerido/i).first(),
    ).toBeVisible();
  });

  // DNI validation is part of the form submit flow which needs Cloudinary.
  test('should validate DNI format', async ({ page }) => {
    test.skip(
      true,
      'DNI format validation requires full form interaction with Cloudinary',
    );

    await apiLogin(page, TEST_UNVERIFIED);
    await page.goto('/dashboard/settings');
    await page.getByRole('tab', { name: /verificación/i }).click();

    await page.getByLabel(/número de documento/i).fill('123');
    await page.locator('button[type="submit"]').click();
  });
});
