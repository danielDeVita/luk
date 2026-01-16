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
  MpConnectStatus,
  PayoutStatus,
  TransactionType,
  TransactionStatus,
  AuditAction,
  ActivityType,
  DocumentType,
  KycStatus,
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
  MpConnectStatus,
  PayoutStatus,
  TransactionType,
  TransactionStatus,
  AuditAction,
  ActivityType,
  DocumentType,
  KycStatus,
};

export enum RaffleSort {
  PRICE_ASC = 'PRICE_ASC',
  PRICE_DESC = 'PRICE_DESC',
  END_DATE_ASC = 'END_DATE_ASC',
  END_DATE_DESC = 'END_DATE_DESC',
  CREATED_ASC = 'CREATED_ASC',
  CREATED_DESC = 'CREATED_DESC',
}

registerEnumType(UserRole, { name: 'UserRole' });
registerEnumType(RaffleStatus, { name: 'RaffleStatus' });
registerEnumType(DeliveryStatus, { name: 'DeliveryStatus' });
registerEnumType(ProductCondition, { name: 'ProductCondition' });
registerEnumType(TicketStatus, { name: 'TicketStatus' });
registerEnumType(DisputeType, { name: 'DisputeType' });
registerEnumType(DisputeStatus, { name: 'DisputeStatus' });
registerEnumType(SellerLevel, { name: 'SellerLevel' });
registerEnumType(MpConnectStatus, { name: 'MpConnectStatus' });
registerEnumType(PayoutStatus, { name: 'PayoutStatus' });
registerEnumType(TransactionType, { name: 'TransactionType' });
registerEnumType(TransactionStatus, { name: 'TransactionStatus' });
registerEnumType(AuditAction, { name: 'AuditAction' });
registerEnumType(ActivityType, { name: 'ActivityType' });
registerEnumType(RaffleSort, { name: 'RaffleSort' });
registerEnumType(DocumentType, { name: 'DocumentType' });
registerEnumType(KycStatus, { name: 'KycStatus' });
