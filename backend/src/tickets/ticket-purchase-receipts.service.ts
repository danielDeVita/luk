import { Injectable, NotFoundException } from '@nestjs/common';
import {
  TicketReceiptAcceptanceSource,
  TicketPurchaseReceipt,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TicketPurchaseReceiptsService {
  constructor(private readonly prisma: PrismaService) {}

  async getReceipt(buyerId: string, purchaseReference: string) {
    const receipt = await this.prisma.ticketPurchaseReceipt.findUnique({
      where: { purchaseReference },
    });

    if (!receipt || receipt.buyerId !== buyerId) {
      throw new NotFoundException('Comprobante de compra no encontrado');
    }

    return this.toReceiptEntity(receipt);
  }

  async listReceipts(buyerId: string, take = 20, pendingOnly = false) {
    const receipts = await this.prisma.ticketPurchaseReceipt.findMany({
      where: {
        buyerId,
        ...(pendingOnly ? { buyerAcceptedAt: null } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(take, 1), 50),
    });

    return receipts.map((receipt) => this.toReceiptSummaryEntity(receipt));
  }

  async acknowledgeReceipt(
    buyerId: string,
    purchaseReference: string,
    source: TicketReceiptAcceptanceSource,
  ) {
    const receipt = await this.prisma.ticketPurchaseReceipt.findUnique({
      where: { purchaseReference },
    });

    if (!receipt || receipt.buyerId !== buyerId) {
      throw new NotFoundException('Comprobante de compra no encontrado');
    }

    const resolvedReceipt = receipt.buyerAcceptedAt
      ? receipt
      : await this.prisma.ticketPurchaseReceipt.update({
          where: { purchaseReference },
          data: {
            buyerAcceptedAt: new Date(),
            acceptanceSource: source,
          },
        });

    return this.toReceiptEntity(resolvedReceipt);
  }

  private toReceiptSummaryEntity(receipt: TicketPurchaseReceipt) {
    return {
      id: receipt.id,
      purchaseReference: receipt.purchaseReference,
      raffleId: receipt.raffleId,
      raffleTitleSnapshot: receipt.raffleTitleSnapshot,
      ticketNumbers: receipt.ticketNumbers,
      currencyCode: receipt.currencyCode,
      chargedAmount: Number(receipt.chargedAmount),
      baseQuantity: receipt.baseQuantity,
      bonusQuantity: receipt.bonusQuantity,
      grantedQuantity: receipt.grantedQuantity,
      buyerAcceptedAt: receipt.buyerAcceptedAt,
      acceptancePending: receipt.buyerAcceptedAt === null,
      createdAt: receipt.createdAt,
    };
  }

  private toReceiptEntity(receipt: TicketPurchaseReceipt) {
    return {
      id: receipt.id,
      purchaseReference: receipt.purchaseReference,
      raffleId: receipt.raffleId,
      raffleTitleSnapshot: receipt.raffleTitleSnapshot,
      receiptVersion: receipt.receiptVersion,
      currencyCode: receipt.currencyCode,
      ticketNumbers: receipt.ticketNumbers,
      grossSubtotal: Number(receipt.grossSubtotal),
      packDiscountAmount: Number(receipt.packDiscountAmount),
      promotionDiscountAmount: Number(receipt.promotionDiscountAmount),
      selectionPremiumPercent: Number(receipt.selectionPremiumPercent),
      selectionPremiumAmount: Number(receipt.selectionPremiumAmount),
      chargedAmount: Number(receipt.chargedAmount),
      baseQuantity: receipt.baseQuantity,
      bonusQuantity: receipt.bonusQuantity,
      grantedQuantity: receipt.grantedQuantity,
      packApplied: receipt.packApplied,
      purchaseMode: receipt.purchaseMode,
      buyerAcceptedAt: receipt.buyerAcceptedAt,
      acceptanceSource: receipt.acceptanceSource,
      acceptancePending: receipt.buyerAcceptedAt === null,
      createdAt: receipt.createdAt,
      updatedAt: receipt.updatedAt,
    };
  }
}
