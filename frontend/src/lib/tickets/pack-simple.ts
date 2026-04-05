export type PackIneligibilityReason = 'INSUFFICIENT_STOCK' | 'BUYER_LIMIT';

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

export function evaluateSimpleRandomPack(params: {
  requestedQuantity: number;
  availableTickets: number;
  remainingAllowed: number;
}): SimplePackEvaluation {
  const { requestedQuantity, availableTickets, remainingAllowed } = params;
  const packBonusQuantity = SIMPLE_RANDOM_PACK_BONUSES[requestedQuantity] ?? 0;

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
      packIneligibilityReason: 'INSUFFICIENT_STOCK',
    };
  }

  if (grantedQuantity > remainingAllowed) {
    return {
      baseQuantity: requestedQuantity,
      bonusQuantity: 0,
      grantedQuantity: requestedQuantity,
      packApplied: false,
      packIneligibilityReason: 'BUYER_LIMIT',
    };
  }

  return {
    baseQuantity: requestedQuantity,
    bonusQuantity: packBonusQuantity,
    grantedQuantity,
    packApplied: true,
  };
}
