import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SellerLevel } from '@prisma/client';

@Injectable()
export class ReputationService {
  private readonly logger = new Logger(ReputationService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Recalculate reputation for a seller after a completed sale
   */
  async recalculateSellerReputation(sellerId: string) {
    // Get all completed raffles for this seller
    const completedRaffles = await this.prisma.raffle.count({
      where: {
        sellerId,
        estado: 'FINALIZADA',
        isDeleted: false,
      },
    });

    // Get all reviews for this seller
    const reviews = await this.prisma.review.findMany({
      where: { sellerId },
      select: { rating: true },
    });

    // Calculate average rating
    const avgRating =
      reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : null;

    // Get dispute stats
    const disputesWon = await this.prisma.dispute.count({
      where: {
        raffle: { sellerId },
        estado: 'RESUELTA_VENDEDOR',
      },
    });

    const disputesLost = await this.prisma.dispute.count({
      where: {
        raffle: { sellerId },
        estado: 'RESUELTA_COMPRADOR',
      },
    });

    // Determine seller level based on completed sales
    const level = this.calculateSellerLevel(
      completedRaffles,
      avgRating,
      disputesWon,
      disputesLost,
    );

    // Calculate max simultaneous raffles based on level
    const maxRaffles = this.getMaxRafflesForLevel(level);

    // Update or create reputation record
    await this.prisma.userReputation.upsert({
      where: { userId: sellerId },
      create: {
        userId: sellerId,
        totalVentasCompletadas: completedRaffles,
        ratingPromedioVendedor: avgRating,
        nivelVendedor: level,
        maxRifasSimultaneas: maxRaffles,
        disputasComoVendedorGanadas: disputesWon,
        disputasComoVendedorPerdidas: disputesLost,
      },
      update: {
        totalVentasCompletadas: completedRaffles,
        ratingPromedioVendedor: avgRating,
        nivelVendedor: level,
        maxRifasSimultaneas: maxRaffles,
        disputasComoVendedorGanadas: disputesWon,
        disputasComoVendedorPerdidas: disputesLost,
      },
    });

    this.logger.log(
      `Reputation updated for seller ${sellerId}: Level ${level}, ${completedRaffles} sales`,
    );
  }

  /**
   * Recalculate reputation for a buyer
   */
  async recalculateBuyerReputation(buyerId: string) {
    const [completedPurchases, rafflesWon, ticketsPurchased, disputesOpened] =
      await Promise.all([
        this.prisma.raffle.count({
          where: {
            winnerId: buyerId,
            estado: 'FINALIZADA',
            deliveryStatus: 'CONFIRMED',
          },
        }),
        this.prisma.raffle.count({
          where: {
            winnerId: buyerId,
          },
        }),
        this.prisma.ticket.count({
          where: {
            buyerId,
            estado: 'PAGADO',
          },
        }),
        this.prisma.dispute.count({
          where: { reporterId: buyerId },
        }),
      ]);

    await this.prisma.userReputation.upsert({
      where: { userId: buyerId },
      create: {
        userId: buyerId,
        totalComprasCompletadas: completedPurchases,
        totalRifasGanadas: rafflesWon,
        totalTicketsComprados: ticketsPurchased,
        disputasComoCompradorAbiertas: disputesOpened,
      },
      update: {
        totalComprasCompletadas: completedPurchases,
        totalRifasGanadas: rafflesWon,
        totalTicketsComprados: ticketsPurchased,
        disputasComoCompradorAbiertas: disputesOpened,
      },
    });

    this.logger.log(
      `Reputation updated for buyer ${buyerId}: ${completedPurchases} purchases`,
    );
  }

  /**
   * Calculate seller level based on metrics
   */
  private calculateSellerLevel(
    completedSales: number,
    avgRating: number | null,
    disputesWon: number,
    disputesLost: number,
  ): SellerLevel {
    // Calculate dispute ratio
    const totalDisputes = disputesWon + disputesLost;
    const disputeLostRatio =
      totalDisputes > 0 ? disputesLost / totalDisputes : 0;

    // Penalize if too many disputes lost
    if (disputeLostRatio > 0.5 && totalDisputes >= 3) {
      return SellerLevel.NUEVO; // Demote to lowest
    }

    // Rating requirement: at least 3.5 to advance
    const hasGoodRating = avgRating === null || avgRating >= 3.5;

    if (completedSales >= 50 && hasGoodRating && disputeLostRatio < 0.2) {
      return SellerLevel.ORO;
    }

    if (completedSales >= 20 && hasGoodRating && disputeLostRatio < 0.3) {
      return SellerLevel.PLATA;
    }

    if (completedSales >= 5 && hasGoodRating) {
      return SellerLevel.BRONCE;
    }

    return SellerLevel.NUEVO;
  }

  /**
   * Get max simultaneous raffles based on seller level
   */
  private getMaxRafflesForLevel(level: SellerLevel): number {
    switch (level) {
      case SellerLevel.ORO:
        return 10;
      case SellerLevel.PLATA:
        return 7;
      case SellerLevel.BRONCE:
        return 5;
      case SellerLevel.NUEVO:
      default:
        return 3;
    }
  }

  /**
   * Get reputation summary for a user
   */
  async getReputationSummary(userId: string) {
    const reputation = await this.prisma.userReputation.findUnique({
      where: { userId },
    });

    if (!reputation) {
      return {
        nivel: SellerLevel.NUEVO,
        totalVentas: 0,
        totalCompras: 0,
        rating: null,
        disputasGanadas: 0,
        disputasPerdidas: 0,
        maxRifasSimultaneas: 3,
      };
    }

    return {
      nivel: reputation.nivelVendedor,
      totalVentas: reputation.totalVentasCompletadas,
      totalCompras: reputation.totalComprasCompletadas,
      rating: reputation.ratingPromedioVendedor
        ? Number(reputation.ratingPromedioVendedor)
        : null,
      disputasGanadas: reputation.disputasComoVendedorGanadas,
      disputasPerdidas: reputation.disputasComoVendedorPerdidas,
      maxRifasSimultaneas: reputation.maxRifasSimultaneas,
    };
  }

  /**
   * Check if seller can create more raffles
   */
  async canSellerCreateRaffle(
    sellerId: string,
  ): Promise<{ allowed: boolean; reason?: string }> {
    const reputation = await this.prisma.userReputation.findUnique({
      where: { userId: sellerId },
    });

    const maxRaffles = reputation?.maxRifasSimultaneas ?? 3;

    const activeRaffles = await this.prisma.raffle.count({
      where: {
        sellerId,
        estado: 'ACTIVA',
        isDeleted: false,
      },
    });

    if (activeRaffles >= maxRaffles) {
      return {
        allowed: false,
        reason: `Has alcanzado el limite de ${maxRaffles} rifas activas. Completa algunas antes de crear nuevas.`,
      };
    }

    return { allowed: true };
  }
}
