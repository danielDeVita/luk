/**
 * Platform fee rates for commission calculations.
 * Centralized to avoid duplication across services.
 */

// Estimated live payment-provider processing fee (~5%)
export const PAYMENT_PROVIDER_FEE_ESTIMATE_RATE = 0.05;

// Stripe fee rates (kept for reference, not currently used)
export const STRIPE_FEE_RATE = 0.029; // 2.9%
export const STRIPE_FIXED_FEE = 0.3; // $0.30

// Minimum sale threshold for raffle completion (70%)
export const MIN_SALE_THRESHOLD = 0.7;
