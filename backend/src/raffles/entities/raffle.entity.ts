import { ObjectType, Field, ID, Float, Int } from '@nestjs/graphql';
import { RaffleStatus, DeliveryStatus } from '../../common/enums';
import { User } from '../../users/entities/user.entity';
import { Product } from './product.entity';

import { Ticket } from '../../tickets/entities/ticket.entity';

@ObjectType()
export class Raffle {
  @Field(() => [Ticket], { nullable: true })
  tickets?: Ticket[];
  @Field(() => ID)
  id!: string;

  @Field()
  titulo!: string;

  @Field()
  descripcion!: string;

  @Field()
  sellerId!: string;

  @Field(() => User, { nullable: true })
  seller?: User;

  @Field(() => Int)
  totalTickets!: number;

  @Field(() => Float)
  precioPorTicket!: number;

  @Field()
  fechaInicio!: Date;

  @Field()
  fechaLimiteSorteo!: Date;

  @Field(() => RaffleStatus)
  estado!: RaffleStatus;

  @Field(() => String, { nullable: true })
  winnerId?: string;

  @Field(() => User, { nullable: true })
  winner?: User;

  @Field(() => Date, { nullable: true })
  fechaSorteoReal?: Date;

  @Field(() => Int, { nullable: true })
  winningTicketNumber?: number | null;

  @Field(() => DeliveryStatus)
  deliveryStatus!: DeliveryStatus;

  @Field(() => String, { nullable: true })
  trackingNumber?: string;

  @Field(() => Date, { nullable: true })
  shippedAt?: Date;

  @Field(() => Date, { nullable: true })
  confirmedAt?: Date;

  @Field(() => Date, { nullable: true })
  paymentReleasedAt?: Date;

  @Field(() => Product, { nullable: true })
  product?: Product;

  @Field(() => Int)
  ticketsVendidos?: number;

  @Field(() => Int)
  ticketsDisponibles?: number;

  @Field(() => Int)
  maxTicketsPorUsuario?: number;

  @Field(() => Float)
  precioTotal?: number;

  @Field(() => Int)
  viewCount?: number;

  @Field(() => Date, { nullable: true })
  lastPriceDropAt?: Date;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

// Seller Dashboard Types
@ObjectType()
export class MonthlyRevenue {
  @Field(() => Int)
  year!: number;

  @Field(() => Int)
  month!: number;

  @Field(() => Float)
  revenue!: number;

  @Field(() => Int)
  ticketsSold!: number;

  @Field(() => Int)
  rafflesCompleted!: number;
}

@ObjectType()
export class SellerDashboardStats {
  @Field(() => Float)
  totalRevenue!: number;

  @Field(() => Int)
  totalTicketsSold!: number;

  @Field(() => Int)
  activeRaffles!: number;

  @Field(() => Int)
  completedRaffles!: number;

  @Field(() => Int)
  totalViews!: number;

  @Field(() => Float)
  conversionRate!: number;

  @Field(() => [MonthlyRevenue])
  monthlyRevenue!: MonthlyRevenue[];
}

@ObjectType()
export class BulkActionResult {
  @Field(() => Int)
  successCount!: number;

  @Field(() => Int)
  failedCount!: number;

  @Field(() => [String])
  failedIds!: string[];

  @Field(() => [String])
  errors!: string[];
}

// Buyer Experience Types
@ObjectType()
export class BuyerStats {
  @Field(() => Int)
  totalTicketsPurchased!: number;

  @Field(() => Int)
  totalRafflesWon!: number;

  @Field(() => Float)
  winRate!: number;

  @Field(() => Float)
  totalSpent!: number;

  @Field(() => Int)
  activeTickets!: number;

  @Field(() => Int)
  favoritesCount!: number;
}

@ObjectType()
export class PaginationMeta {
  @Field(() => Int)
  total!: number;

  @Field(() => Int)
  page!: number;

  @Field(() => Int)
  limit!: number;

  @Field(() => Int)
  totalPages!: number;

  @Field(() => Boolean)
  hasNext!: boolean;

  @Field(() => Boolean)
  hasPrev!: boolean;
}

@ObjectType()
export class PaginatedRaffles {
  @Field(() => [Raffle])
  items!: Raffle[];

  @Field(() => PaginationMeta)
  meta!: PaginationMeta;
}
