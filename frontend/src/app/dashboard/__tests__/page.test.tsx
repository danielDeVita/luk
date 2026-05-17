import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useQuery } from "@apollo/client/react";
import { useRouter } from "next/navigation";
import type { DocumentNode } from "graphql";
import { useAuthStore } from "@/store/auth";
import DashboardHomePage from "../page";

vi.mock("@apollo/client/react", () => ({
  useQuery: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

describe("DashboardHomePage", () => {
  const mockUseQuery = vi.mocked(useQuery);
  const mockUseRouter = vi.mocked(useRouter);
  const mockUseAuthStore = vi.mocked(useAuthStore);

  const getOperationText = (operation: DocumentNode) =>
    operation.loc?.source.body ?? "";

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRouter.mockReturnValue({
      push: vi.fn(),
      replace: vi.fn(),
      refresh: vi.fn(),
      prefetch: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
    });
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      hasHydrated: true,
      user: {
        id: "user-1",
        email: "buyer@test.com",
        nombre: "Buyer",
        apellido: "Test",
        role: "USER",
      },
    } as ReturnType<typeof useAuthStore>);
  });

  it("renders buyer and seller onboarding paths with pending CTAs", async () => {
    mockUseQuery.mockImplementation((operation) => {
      const body = getOperationText(operation as DocumentNode);

      if (body.includes("query DashboardMe")) {
        return {
          data: {
            me: {
              id: "user-1",
              nombre: "Buyer",
              apellido: "Test",
              phone: null,
              sellerPaymentAccountStatus: "NOT_CONNECTED",
              kycStatus: "NOT_SUBMITTED",
              street: null,
              city: null,
              province: null,
              postalCode: null,
              cuitCuil: null,
            },
          },
          loading: false,
          error: undefined,
        } as ReturnType<typeof useQuery>;
      }

      if (body.includes("query DashboardWallet")) {
        return {
          data: {
            myWallet: {
              id: "wallet-1",
              creditBalance: 0,
              sellerPayableBalance: 0,
            },
          },
          loading: false,
          error: undefined,
        } as ReturnType<typeof useQuery>;
      }

      if (body.includes("query DashboardWalletLedger")) {
        return {
          data: { walletLedger: [] },
          loading: false,
          error: undefined,
        } as ReturnType<typeof useQuery>;
      }

      if (body.includes("query DashboardShippingAddresses")) {
        return {
          data: { myShippingAddresses: [] },
          loading: false,
          error: undefined,
        } as ReturnType<typeof useQuery>;
      }

      if (body.includes("query DashboardTickets")) {
        return {
          data: { myTickets: [] },
          loading: false,
          error: undefined,
        } as ReturnType<typeof useQuery>;
      }

      if (body.includes("query DashboardTicketPurchaseReceipts")) {
        return {
          data: { myTicketPurchaseReceipts: [] },
          loading: false,
          error: undefined,
        } as ReturnType<typeof useQuery>;
      }

      if (body.includes("query DashboardSellerRaffles")) {
        return {
          data: { myRafflesAsSeller: [] },
          loading: false,
          error: undefined,
        } as ReturnType<typeof useQuery>;
      }

      return {
        data: { buyerStats: { favoritesCount: 0 } },
        loading: false,
        error: undefined,
      } as ReturnType<typeof useQuery>;
    });

    render(<DashboardHomePage />);

    expect(await screen.findByText("Primeros pasos en LUK")).toBeInTheDocument();
    expect(screen.getByText("Quiero comprar")).toBeInTheDocument();
    expect(screen.getByText("Quiero vender")).toBeInTheDocument();
    expect(screen.getByText("Cargá tu dirección")).toBeInTheDocument();
    expect(screen.getByText("Conectá Mercado Pago")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /agregar dirección/i }),
    ).toHaveAttribute("href", "/dashboard/shipping");
  });
});
