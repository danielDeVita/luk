import { ObjectType, Field, Int, Float, ID } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';
import { UserRole, MpConnectStatus } from '../../common/enums';
import { AdminSellerReview } from '../../users/entities/review.entity';

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

  @Field(() => Int)
  totalTicketsComprados!: number;

  @Field(() => Int)
  totalRifasGanadas!: number;

  @Field(() => Int)
  totalComprasCompletadas!: number;

  @Field(() => Int)
  disputasComoCompradorAbiertas!: number;

  @Field(() => [String])
  buyerRiskFlags!: string[];
}

@ObjectType()
export class AdminUserList {
  @Field(() => [AdminUser])
  users!: AdminUser[];

  @Field(() => Int)
  total!: number;
}

@ObjectType()
export class AdminReviewList {
  @Field(() => [AdminSellerReview])
  reviews!: AdminSellerReview[];

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
export class AdminTransactionUser {
  @Field()
  id!: string;

  @Field()
  email!: string;

  @Field()
  nombre!: string;

  @Field(() => String, { nullable: true })
  apellido?: string;
}

@ObjectType()
export class AdminTransaction {
  @Field(() => ID)
  id!: string;

  @Field()
  tipo!: string;

  @Field(() => Float)
  monto!: number;

  @Field(() => Float, { nullable: true })
  grossAmount?: number;

  @Field(() => Float, { nullable: true })
  promotionDiscountAmount?: number;

  @Field(() => Float, { nullable: true })
  cashChargedAmount?: number;

  @Field(() => String, { nullable: true })
  estado?: string;

  @Field(() => String, { nullable: true })
  mpPaymentId?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  metadata?: Record<string, unknown>;

  @Field()
  createdAt!: Date;

  @Field(() => AdminTransactionUser, { nullable: true })
  user?: AdminTransactionUser;

  @Field(() => RaffleMinimal, { nullable: true })
  raffle?: RaffleMinimal;
}

@ObjectType()
export class AdminTransactionList {
  @Field(() => [AdminTransaction])
  transactions!: AdminTransaction[];

  @Field(() => Int)
  total!: number;
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

  @Field(() => String, { nullable: true })
  kycStatus?: string;

  @Field(() => String, { nullable: true })
  documentType?: string | null;

  @Field(() => String, { nullable: true })
  documentNumber?: string | null;

  @Field(() => String, { nullable: true })
  street?: string | null;

  @Field(() => String, { nullable: true })
  streetNumber?: string | null;

  @Field(() => String, { nullable: true })
  apartment?: string | null;

  @Field(() => String, { nullable: true })
  city?: string | null;

  @Field(() => String, { nullable: true })
  province?: string | null;

  @Field(() => String, { nullable: true })
  postalCode?: string | null;

  @Field(() => String, { nullable: true })
  phone?: string | null;

  @Field(() => String, { nullable: true })
  cuitCuil?: string | null;

  @Field(() => Date, { nullable: true })
  kycSubmittedAt?: Date | null;

  @Field(() => Date, { nullable: true })
  kycVerifiedAt?: Date | null;

  @Field(() => String, { nullable: true })
  kycRejectedReason?: string | null;

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
