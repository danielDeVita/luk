import { describe, expect, it, beforeEach } from "vitest";
import {
  addOnboardingDismissal,
  getBuyerOnboardingProgress,
  getSellerOnboardingProgress,
  readOnboardingDismissals,
} from "../onboarding";

describe("onboarding helpers", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("marks buyer steps as pending for a new buyer", () => {
    const progress = getBuyerOnboardingProgress({
      shippingAddressesCount: 0,
      creditBalance: 0,
      walletLedgerTypes: [],
      ticketsCount: 0,
      ticketReceiptsCount: 0,
      favoritesCount: 0,
    });

    expect(progress.completedCount).toBe(0);
    expect(progress.progress).toBe(0);
    expect(progress.allComplete).toBe(false);
    expect(progress.steps.map((step) => step.completed)).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  it("marks buyer steps as complete from wallet, shipping and ticket data", () => {
    const progress = getBuyerOnboardingProgress({
      shippingAddressesCount: 1,
      creditBalance: 5000,
      walletLedgerTypes: ["CREDIT_TOP_UP"],
      ticketsCount: 2,
      ticketReceiptsCount: 1,
      favoritesCount: 0,
    });

    expect(progress.completedCount).toBe(5);
    expect(progress.progress).toBe(100);
    expect(progress.allComplete).toBe(true);
  });

  it("marks seller steps as complete from verified account data", () => {
    const progress = getSellerOnboardingProgress({
      user: {
        nombre: "Sofia",
        apellido: "Seller",
        phone: "+54 11 1234-5678",
        kycStatus: "VERIFIED",
        sellerPaymentAccountStatus: "CONNECTED",
        street: "Av. Corrientes",
        city: "CABA",
        province: "CABA",
        postalCode: "1043",
        cuitCuil: "20-12345678-9",
      },
      sellerRafflesCount: 1,
      sellerPayableBalance: 0,
    });

    expect(progress.completedCount).toBe(6);
    expect(progress.progress).toBe(100);
    expect(progress.allComplete).toBe(true);
  });

  it("stores dismissals without marking onboarding steps as complete", () => {
    const dismissals = addOnboardingDismissal(
      "user-1",
      "wallet-first-top-up",
      window.localStorage,
    );
    const progress = getBuyerOnboardingProgress({
      shippingAddressesCount: 0,
      creditBalance: 0,
      walletLedgerTypes: [],
      ticketsCount: 0,
      ticketReceiptsCount: 0,
      favoritesCount: 0,
    });

    expect(dismissals).toEqual(["wallet-first-top-up"]);
    expect(readOnboardingDismissals("user-1", window.localStorage)).toEqual([
      "wallet-first-top-up",
    ]);
    expect(progress.completedCount).toBe(0);
  });
});
