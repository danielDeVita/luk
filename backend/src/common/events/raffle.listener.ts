import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  RaffleEvents,
  RaffleCompletedEvent,
  RaffleDrawnEvent,
  TicketsPurchasedEvent,
  DisputeOpenedEvent,
  DisputeResolvedEvent,
  DeliveryConfirmedEvent,
} from './raffle.events';

/**
 * Event listener for raffle-related events.
 *
 * Handles cross-cutting concerns like logging and metrics.
 * Notifications are handled separately by NotificationsService.
 */
@Injectable()
export class RaffleEventListener {
  private readonly logger = new Logger(RaffleEventListener.name);

  @OnEvent(RaffleEvents.COMPLETED)
  handleRaffleCompleted(event: RaffleCompletedEvent): void {
    this.logger.log(
      `Raffle completed: ${event.raffleId} - ${event.ticketCount} tickets sold for $${event.totalAmount}`,
    );
  }

  @OnEvent(RaffleEvents.DRAWN)
  handleRaffleDrawn(event: RaffleDrawnEvent): void {
    this.logger.log(
      `Raffle drawn: ${event.raffleId} - Winner: ${event.winnerId} (ticket #${event.winningTicketNumber})`,
    );
  }

  @OnEvent(RaffleEvents.TICKETS_PURCHASED)
  handleTicketsPurchased(event: TicketsPurchasedEvent): void {
    this.logger.log(
      `Tickets purchased: ${event.ticketCount} tickets for raffle ${event.raffleId} by user ${event.buyerId}`,
    );
  }

  @OnEvent(RaffleEvents.DISPUTE_OPENED)
  handleDisputeOpened(event: DisputeOpenedEvent): void {
    this.logger.warn(
      `Dispute opened: ${event.disputeId} for raffle ${event.raffleId} - Type: ${event.disputeType}`,
    );
  }

  @OnEvent(RaffleEvents.DISPUTE_RESOLVED)
  handleDisputeResolved(event: DisputeResolvedEvent): void {
    this.logger.log(
      `Dispute resolved: ${event.disputeId} for raffle ${event.raffleId} - Resolution: ${event.resolution}`,
    );
  }

  @OnEvent(RaffleEvents.DELIVERY_CONFIRMED)
  handleDeliveryConfirmed(event: DeliveryConfirmedEvent): void {
    this.logger.log(
      `Delivery confirmed: Raffle ${event.raffleId} - Winner: ${event.winnerId}, Seller: ${event.sellerId}`,
    );
  }
}
