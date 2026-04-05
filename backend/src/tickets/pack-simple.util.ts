import { TicketPurchaseMode, PackIneligibilityReason } from '../common/enums';

export interface SimplePackEvaluation {
  baseQuantity: number;
  bonusQuantity: number;
  grantedQuantity: number;
  packApplied: boolean;
  packIneligibilityReason?: PackIneligibilityReason;
}

const SIMPLE_RANDOM_PACK_BONUSES: Record<number, number> = {
  5: 1,
  10: 2,
};

/**
 * Evaluates whether the global random-ticket pack can be applied as-is.
 * If not, the purchase falls back to the paid base quantity without blocking checkout.
 */
export function evaluateSimpleRandomPack(params: {
  purchaseMode: TicketPurchaseMode;
  requestedQuantity: number;
  availableTickets: number;
  remainingAllowed: number;
}): SimplePackEvaluation {
  const {
    purchaseMode,
    requestedQuantity,
    availableTickets,
    remainingAllowed,
  } = params;

  const packBonusQuantity =
    purchaseMode === TicketPurchaseMode.RANDOM
      ? (SIMPLE_RANDOM_PACK_BONUSES[requestedQuantity] ?? 0)
      : 0;

  if (packBonusQuantity === 0) {
    return {
      baseQuantity: requestedQuantity,
      bonusQuantity: 0,
      grantedQuantity: requestedQuantity,
      packApplied: false,
    };
  }

  const grantedQuantity = requestedQuantity + packBonusQuantity;

  if (grantedQuantity > availableTickets) {
    return {
      baseQuantity: requestedQuantity,
      bonusQuantity: 0,
      grantedQuantity: requestedQuantity,
      packApplied: false,
      packIneligibilityReason: PackIneligibilityReason.INSUFFICIENT_STOCK,
    };
  }

  if (grantedQuantity > remainingAllowed) {
    return {
      baseQuantity: requestedQuantity,
      bonusQuantity: 0,
      grantedQuantity: requestedQuantity,
      packApplied: false,
      packIneligibilityReason: PackIneligibilityReason.BUYER_LIMIT,
    };
  }

  return {
    baseQuantity: requestedQuantity,
    bonusQuantity: packBonusQuantity,
    grantedQuantity,
    packApplied: true,
  };
}
