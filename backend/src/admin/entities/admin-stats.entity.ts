import { ObjectType, Field, Int, Float, ID } from '@nestjs/graphql';
import { UserRole, MpConnectStatus } from '../../common/enums';

// ==================== User Management Entities ====================

@ObjectType()
export class AdminUser {
  @Field(() => ID)
  id!: string;

  @Field()
  email!: string;

  @Field()
  nombre!: string;

  @Field()
  apellido!: string;

  @Field(() => UserRole)
  role!: UserRole;

  @Field(() => MpConnectStatus)
  mpConnectStatus!: MpConnectStatus;

  @Field(() => String, { nullable: true })
  kycStatus?: string;

  @Field()
  createdAt!: Date;

  @Field()
  isDeleted!: boolean;

  @Field(() => Int)
  rafflesCreated!: number;

  @Field(() => Int)
  ticketsPurchased!: number;

  @Field(() => Int)
  rafflesWon!: number;
}

@ObjectType()
export class AdminUserList {
  @Field(() => [AdminUser])
  users!: AdminUser[];

  @Field(() => Int)
  total!: number;
}

@ObjectType()
export class UserActivity {
  @Field(() => ID)
  id!: string;

  @Field()
  action!: string;

  @Field(() => String, { nullable: true })
  targetType?: string;

  @Field(() => String, { nullable: true })
  targetId?: string;

  @Field(() => String, { nullable: true })
  metadata?: string;

  @Field(() => String, { nullable: true })
  ipAddress?: string;

  @Field()
  createdAt!: Date;
}

@ObjectType()
export class BulkResolveResult {
  @Field(() => Int)
  successCount!: number;

  @Field(() => Int)
  failedCount!: number;

  @Field(() => [String])
  failedIds!: string[];

  @Field(() => [String])
  errors!: string[];
}

// ==================== Admin Stats ====================

@ObjectType()
export class AdminStats {
  @Field(() => Int)
  totalUsers!: number;

  @Field(() => Int)
  totalRaffles!: number;

  @Field(() => Int)
  activeRaffles!: number;

  @Field(() => Int)
  completedRaffles!: number;

  @Field(() => Int)
  totalTransactions!: number;

  @Field(() => Float)
  totalRevenue!: number;

  @Field(() => Int)
  totalTicketsSold!: number;

  @Field(() => Int)
  totalDisputes!: number;

  @Field(() => Int)
  pendingDisputes!: number;

  @Field(() => Int)
  recentMpEvents!: number;

  @Field(() => Int)
  newUsersToday!: number;

  @Field(() => Int)
  newRafflesToday!: number;
}

@ObjectType()
export class TicketDebugInfo {
  @Field()
  id!: string;

  @Field(() => Int)
  numeroTicket!: number;

  @Field()
  estado!: string;

  @Field(() => Float)
  precioPagado!: number;
}

@ObjectType()
export class RaffleMinimal {
  @Field()
  id!: string;

  @Field()
  titulo!: string;

  @Field({ nullable: true })
  sellerId?: string;
}

@ObjectType()
export class UserMinimal {
  @Field()
  id!: string;

  @Field()
  email!: string;

  @Field()
  nombre!: string;
}

@ObjectType()
export class PaymentDebugInfo {
  @Field()
  mpPaymentId!: string;

  @Field()
  webhookReceived!: boolean;

  @Field({ nullable: true })
  webhookProcessedAt?: Date;

  @Field({ nullable: true })
  webhookEventType?: string;

  @Field()
  transactionCreated!: boolean;

  @Field({ nullable: true })
  transactionId?: string;

  @Field({ nullable: true })
  transactionStatus?: string;

  @Field(() => Float, { nullable: true })
  transactionAmount?: number;

  @Field(() => Int)
  ticketsCount!: number;

  @Field(() => [TicketDebugInfo])
  tickets!: TicketDebugInfo[];

  @Field(() => RaffleMinimal, { nullable: true })
  raffle?: RaffleMinimal;

  @Field(() => UserMinimal, { nullable: true })
  buyer?: UserMinimal;
}

// ==================== KYC Entities ====================

@ObjectType()
export class KycSubmission {
  @Field(() => ID)
  userId!: string;

  @Field()
  email!: string;

  @Field()
  nombre!: string;

  @Field()
  apellido!: string;

  @Field(() => String)
  kycStatus!: string;

  @Field({ nullable: true })
  documentType?: string;

  @Field({ nullable: true })
  documentNumber?: string;

  @Field({ nullable: true })
  street?: string;

  @Field({ nullable: true })
  streetNumber?: string;

  @Field({ nullable: true })
  apartment?: string;

  @Field({ nullable: true })
  city?: string;

  @Field({ nullable: true })
  province?: string;

  @Field({ nullable: true })
  postalCode?: string;

  @Field({ nullable: true })
  phone?: string;

  @Field({ nullable: true })
  cuitCuil?: string;

  @Field({ nullable: true })
  kycSubmittedAt?: Date;

  @Field({ nullable: true })
  kycVerifiedAt?: Date;

  @Field({ nullable: true })
  kycRejectedReason?: string;

  @Field()
  createdAt!: Date;
}

@ObjectType()
export class KycSubmissionList {
  @Field(() => [KycSubmission])
  submissions!: KycSubmission[];

  @Field(() => Int)
  total!: number;
}

@ObjectType()
export class KycApprovalResult {
  @Field(() => ID)
  userId!: string;

  @Field()
  kycStatus!: string;

  @Field()
  success!: boolean;

  @Field({ nullable: true })
  message?: string;
}
