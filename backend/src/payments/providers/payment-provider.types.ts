export interface TopUpBuyerProfile {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
}

export interface CreateCreditTopUpInput {
  topUpSessionId: string;
  userId: string;
  amount: number;
  providerReference: string;
  buyerProfile: TopUpBuyerProfile;
}

export interface CreateCreditTopUpResult {
  redirectUrl: string;
  providerSessionId: string;
}

export interface TopUpStatusResult {
  status: string;
  statusDetail: string;
  externalReference: string | null;
  providerOrderId?: string | null;
}

export interface ProviderTopUpDetails {
  providerPaymentId: string;
  status: string;
  statusDetail: string;
  amount: number;
  externalReference: string | null;
  providerOrderId?: string | null;
  processingFee?: number;
}

export interface NormalizedTopUpWebhook {
  eventType: string;
  paymentId: string | null;
  providerReference: string | null;
  providerOrderId: string | null;
  status: string | null;
  statusDetail: string | null;
}

export interface SyncTopUpStatusResult {
  status: string;
  alreadyProcessed: boolean;
  creditedAmount: number;
}

export interface MockTopUpSummary {
  id: string;
  publicToken: string;
  userId: string;
  userEmail: string;
  amount: number;
  creditedAmount: number;
  refundedAmount: number;
  status: string;
  statusDetail: string;
  providerOrderId: string;
  createdAt: string;
  approvedAt?: string | null;
  refundedAt?: string | null;
}

export type MockTopUpAction =
  | 'APPROVE'
  | 'PEND'
  | 'REJECT'
  | 'REFUND_FULL'
  | 'REFUND_PARTIAL'
  | 'EXPIRE';

export interface MockTopUpActionResult {
  topUpSessionId: string;
  status: string;
  providerOrderId: string;
  redirectUrl: string;
  mockToken: string;
}
