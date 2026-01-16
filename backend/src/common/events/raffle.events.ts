/**
 * Domain events for the Raffle platform.
 *
 * Events are emitted by services and can be handled by listeners
 * for cross-cutting concerns like logging, notifications, and analytics.
 */

/**
 * Emitted when a raffle receives all its tickets and is ready for draw.
 */
export class RaffleCompletedEvent {
  constructor(
    public readonly raffleId: string,
    public readonly sellerId: string,
    public readonly ticketCount: number,
    public readonly totalAmount: number,
  ) {}
}

/**
 * Emitted when a raffle winner is drawn.
 */
export class RaffleDrawnEvent {
  constructor(
    public readonly raffleId: string,
    public readonly winnerId: string,
    public readonly winningTicketNumber: number,
    public readonly sellerId: string,
  ) {}
}

/**
 * Emitted when tickets are purchased.
 */
export class TicketsPurchasedEvent {
  constructor(
    public readonly raffleId: string,
    public readonly buyerId: string,
    public readonly ticketCount: number,
    public readonly totalAmount: number,
    public readonly mpPaymentId: string | null,
  ) {}
}

/**
 * Emitted when tickets are refunded.
 */
export class TicketsRefundedEvent {
  constructor(
    public readonly raffleId: string,
    public readonly buyerId: string,
    public readonly ticketCount: number,
    public readonly refundAmount: number,
  ) {}
}

/**
 * Emitted when a dispute is opened.
 */
export class DisputeOpenedEvent {
  constructor(
    public readonly disputeId: string,
    public readonly raffleId: string,
    public readonly reporterId: string,
    public readonly sellerId: string,
    public readonly disputeType: string,
  ) {}
}

/**
 * Emitted when a dispute is resolved.
 */
export class DisputeResolvedEvent {
  constructor(
    public readonly disputeId: string,
    public readonly raffleId: string,
    public readonly resolution: string,
    public readonly buyerAmount: number,
    public readonly sellerAmount: number,
  ) {}
}

/**
 * Emitted when a raffle is cancelled and all tickets are refunded.
 */
export class RaffleCancelledEvent {
  constructor(
    public readonly raffleId: string,
    public readonly sellerId: string,
    public readonly reason: string,
    public readonly refundCount: number,
  ) {}
}

/**
 * Emitted when delivery is confirmed and payment is released.
 */
export class DeliveryConfirmedEvent {
  constructor(
    public readonly raffleId: string,
    public readonly winnerId: string,
    public readonly sellerId: string,
  ) {}
}

/**
 * Event names enum for type safety.
 */
export const RaffleEvents = {
  COMPLETED: 'raffle.completed',
  DRAWN: 'raffle.drawn',
  CANCELLED: 'raffle.cancelled',
  TICKETS_PURCHASED: 'raffle.tickets.purchased',
  TICKETS_REFUNDED: 'raffle.tickets.refunded',
  DISPUTE_OPENED: 'raffle.dispute.opened',
  DISPUTE_RESOLVED: 'raffle.dispute.resolved',
  DELIVERY_CONFIRMED: 'raffle.delivery.confirmed',
} as const;
