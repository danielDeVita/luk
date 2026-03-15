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
}

export interface CreateCheckoutSessionResult {
  initPoint: string;
  preferenceId: string;
}

export interface PaymentStatusResult {
  status: string;
  statusDetail: string;
  externalReference: string | null;
  merchantOrderId?: string | null;
}

export interface SyncStatusResult {
  status: string;
  alreadyProcessed: boolean;
  ticketsUpdated: number;
}

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
  status: string;
  statusDetail: string;
  merchantOrderId: string;
  promotionBonusGrantId?: string | null;
  promotionBonusRedemptionId?: string | null;
  createdAt: string;
  approvedAt?: string | null;
  refundedAt?: string | null;
}

export type MockPaymentAction =
  | 'APPROVE'
  | 'PEND'
  | 'REJECT'
  | 'REFUND_FULL'
  | 'REFUND_PARTIAL'
  | 'EXPIRE';

export interface MockPaymentActionResult {
  paymentId: string;
  status: string;
  merchantOrderId: string;
  redirectUrl: string;
  mockToken: string;
}
