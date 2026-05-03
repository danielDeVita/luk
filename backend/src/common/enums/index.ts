import { registerEnumType } from '@nestjs/graphql';
import {
  UserRole,
  RaffleStatus,
  DeliveryStatus,
  ProductCondition,
  TicketStatus,
  DisputeType,
  DisputeStatus,
  SellerLevel,
  SellerPaymentAccountStatus,
  PayoutStatus,
  TransactionType,
  TransactionStatus,
  AuditAction,
  ActivityType,
  DocumentType,
  KycStatus,
  SellerPaymentAccountIdentifierType,
  TicketPurchaseMode,
  TicketReceiptAcceptanceSource,
  WalletLedgerEntryType,
} from '@prisma/client';

export {
  UserRole,
  RaffleStatus,
  DeliveryStatus,
  ProductCondition,
  TicketStatus,
  DisputeType,
  DisputeStatus,
  SellerLevel,
  SellerPaymentAccountStatus,
  PayoutStatus,
  TransactionType,
  TransactionStatus,
  AuditAction,
  ActivityType,
  DocumentType,
  KycStatus,
  SellerPaymentAccountIdentifierType,
  TicketPurchaseMode,
  TicketReceiptAcceptanceSource,
  WalletLedgerEntryType,
};

export enum RaffleSort {
  PRICE_ASC = 'PRICE_ASC',
  PRICE_DESC = 'PRICE_DESC',
  END_DATE_ASC = 'END_DATE_ASC',
  END_DATE_DESC = 'END_DATE_DESC',
  CREATED_ASC = 'CREATED_ASC',
  CREATED_DESC = 'CREATED_DESC',
}

export enum PackIneligibilityReason {
  INSUFFICIENT_STOCK = 'INSUFFICIENT_STOCK',
  BUYER_LIMIT = 'BUYER_LIMIT',
}

registerEnumType(UserRole, { name: 'UserRole' });
registerEnumType(RaffleStatus, { name: 'RaffleStatus' });
registerEnumType(DeliveryStatus, { name: 'DeliveryStatus' });
registerEnumType(ProductCondition, { name: 'ProductCondition' });
registerEnumType(TicketStatus, { name: 'TicketStatus' });
registerEnumType(DisputeType, { name: 'DisputeType' });
registerEnumType(DisputeStatus, { name: 'DisputeStatus' });
registerEnumType(SellerLevel, { name: 'SellerLevel' });
registerEnumType(SellerPaymentAccountStatus, {
  name: 'SellerPaymentAccountStatus',
});
registerEnumType(PayoutStatus, { name: 'PayoutStatus' });
registerEnumType(TransactionType, { name: 'TransactionType' });
registerEnumType(TransactionStatus, { name: 'TransactionStatus' });
registerEnumType(AuditAction, { name: 'AuditAction' });
registerEnumType(ActivityType, { name: 'ActivityType' });
registerEnumType(RaffleSort, { name: 'RaffleSort' });
registerEnumType(DocumentType, { name: 'DocumentType' });
registerEnumType(KycStatus, { name: 'KycStatus' });
registerEnumType(SellerPaymentAccountIdentifierType, {
  name: 'SellerPaymentAccountIdentifierType',
});
registerEnumType(WalletLedgerEntryType, { name: 'WalletLedgerEntryType' });
registerEnumType(TicketPurchaseMode, { name: 'TicketPurchaseMode' });
registerEnumType(TicketReceiptAcceptanceSource, {
  name: 'TicketReceiptAcceptanceSource',
});
registerEnumType(PackIneligibilityReason, {
  name: 'PackIneligibilityReason',
});
