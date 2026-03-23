import { TicketPurchaseMode } from '../../common/enums';

/**
 * Shared checkout payload used by both live and mock payment providers.
 */
export interface CreateCheckoutSessionInput {
  raffleId: string;
  cantidad: number;
  buyerId: string;
  precioPorTicket: number;
  tituloRifa: string;
  reservationId: string;
  grossSubtotal: number;
  discountApplied: number;
  cashChargedAmount: number;
  bonusGrantId?: string | null;
  promotionBonusRedemptionId?: string | null;
  promotionToken?: string | null;
  purchaseMode: TicketPurchaseMode;
  selectedNumbers?: number[] | null;
  selectionPremiumPercent: number;
  selectionPremiumAmount: number;
}

/**
 * Minimal checkout session data returned to the tickets flow.
 */
export interface CreateCheckoutSessionResult {
  initPoint: string;
  preferenceId: string;
}

/**
 * Normalized payment status shape consumed by controllers and checkout status pages.
 */
export interface PaymentStatusResult {
  status: string;
  statusDetail: string;
  externalReference: string | null;
  merchantOrderId?: string | null;
}

/**
 * Sync result returned when the backend replays provider state after a missed webhook.
 */
export interface SyncStatusResult {
  status: string;
  alreadyProcessed: boolean;
  ticketsUpdated: number;
}

/**
 * Browser-facing summary of a mock payment checkout session.
 */
export interface MockPaymentSummary {
  id: string;
  publicToken: string;
  raffleId: string;
  raffleTitle: string;
  buyerId: string;
  buyerEmail: string;
  quantity: number;
  grossSubtotal: number;
  discountApplied: number;
  cashChargedAmount: number;
  purchaseMode: TicketPurchaseMode;
  selectedNumbers?: number[] | null;
  selectionPremiumPercent: number;
  selectionPremiumAmount: number;
  status: string;
  statusDetail: string;
  merchantOrderId: string;
  promotionBonusGrantId?: string | null;
  promotionBonusRedemptionId?: string | null;
  createdAt: string;
  approvedAt?: string | null;
  refundedAt?: string | null;
}

/**
 * Allowed actions that QA can trigger against a mock payment.
 */
export type MockPaymentAction =
  | 'APPROVE'
  | 'PEND'
  | 'REJECT'
  | 'REFUND_FULL'
  | 'REFUND_PARTIAL'
  | 'EXPIRE';

/**
 * Result returned after applying a mock payment action.
 */
export interface MockPaymentActionResult {
  paymentId: string;
  status: string;
  merchantOrderId: string;
  redirectUrl: string;
  mockToken: string;
}
