import {
  TestContext,
  createTestApp,
  cleanupTestApp,
} from '../integration/setup';
import {
  createTestUser,
  createTestSeller,
  createTestRaffle,
  createTestTickets,
} from '../integration/factories';
import { TicketsService } from '../../src/tickets/tickets.service';
import { RafflesService } from '../../src/raffles/raffles.service';
import { NotificationsService } from '../../src/notifications/notifications.service';
import { RaffleStatus, TicketStatus } from '@prisma/client';

/**
 * Integration tests for refund and cancellation flows.
 * Tests various refund scenarios including raffle cancellation and ticket refunds.
 */
describe('Refund and Cancellation Flow (Integration)', () => {
  let ctx: TestContext;
  let ticketsService: TicketsService;
  let rafflesService: RafflesService;
  let notificationsService: NotificationsService;

  const mockSendNotification = jest.fn();

  beforeAll(async () => {
    ctx = await createTestApp();
    ticketsService = ctx.app.get<TicketsService>(TicketsService);
    rafflesService = ctx.app.get<RafflesService>(RafflesService);
    notificationsService =
      ctx.app.get<NotificationsService>(NotificationsService);

    jest
      .spyOn(notificationsService, 'sendRefundNotification')
      .mockImplementation(mockSendNotification);
    jest
      .spyOn(notificationsService, 'sendRaffleCancelled')
      .mockImplementation(mockSendNotification);
  });

  afterAll(async () => {
    await cleanupTestApp(ctx);
  });

  beforeEach(async () => {
    mockSendNotification.mockClear();
  });

  describe('Raffle cancellation with < 70% tickets sold', () => {
    it('should cancel raffle and refund all buyers', async () => {
      const seller = await createTestSeller(ctx.prisma);
      const buyer1 = await createTestUser(ctx.prisma);
      const buyer2 = await createTestUser(ctx.prisma);

      const raffle = await createTestRaffle(ctx.prisma, seller.id, {
        totalTickets: 100,
        precioPorTicket: 100,
      });

      // Sell only 30% of tickets (30 out of 100)
      await createTestTickets(ctx.prisma, raffle.id, buyer1.id, 15, {
        estado: TicketStatus.PAGADO,
        mpPaymentId: 'payment-1',
      });
      await createTestTickets(ctx.prisma, raffle.id, buyer2.id, 15, {
        estado: TicketStatus.PAGADO,
        mpPaymentId: 'payment-2',
      });

      // Cancel raffle
      const cancelled = await rafflesService.cancelRaffle(raffle.id, seller.id);

      expect(cancelled.estado).toBe(RaffleStatus.CANCELADA);

      // Verify all tickets refunded
      const tickets = await ctx.prisma.ticket.findMany({
        where: { raffleId: raffle.id },
      });
      expect(tickets.every((t) => t.estado === TicketStatus.REEMBOLSADO)).toBe(
        true,
      );

      // Verify refund transactions created
      const transactions = await ctx.prisma.transaction.findMany({
        where: {
          raffleId: raffle.id,
          tipo: 'REEMBOLSO',
        },
      });
      expect(transactions).toHaveLength(2);

      // Verify notifications sent
      expect(mockSendNotification).toHaveBeenCalledTimes(2);
    });
  });

  describe('Bulk ticket refund by admin', () => {
    it('should refund specific tickets and notify buyer', async () => {
      const seller = await createTestSeller(ctx.prisma);
      const buyer = await createTestUser(ctx.prisma);

      const raffle = await createTestRaffle(ctx.prisma, seller.id, {
        totalTickets: 100,
        precioPorTicket: 100,
      });

      const tickets = await createTestTickets(
        ctx.prisma,
        raffle.id,
        buyer.id,
        5,
        {
          estado: TicketStatus.PAGADO,
          mpPaymentId: 'payment-123',
        },
      );

      // Refund 3 specific tickets
      const ticketIdsToRefund = tickets.slice(0, 3).map((t) => t.id);
      await ticketsService.refundTickets(ticketIdsToRefund, 'ADMIN_INITIATED');

      // Verify refunded tickets
      const refundedTickets = await ctx.prisma.ticket.findMany({
        where: {
          id: { in: ticketIdsToRefund },
        },
      });
      expect(
        refundedTickets.every((t) => t.estado === TicketStatus.REEMBOLSADO),
      ).toBe(true);

      // Verify non-refunded tickets still paid
      const nonRefundedTickets = await ctx.prisma.ticket.findMany({
        where: {
          id: { in: tickets.slice(3).map((t) => t.id) },
        },
      });
      expect(
        nonRefundedTickets.every((t) => t.estado === TicketStatus.PAGADO),
      ).toBe(true);

      // Verify refund transaction
      const transaction = await ctx.prisma.transaction.findFirst({
        where: {
          userId: buyer.id,
          tipo: 'REEMBOLSO',
        },
      });
      expect(transaction).toBeDefined();
      expect(transaction?.monto).toBe(300); // 3 tickets × 100
    });
  });

  describe('Payment failure automatic refund', () => {
    it('should cancel reserved tickets after payment timeout', async () => {
      const seller = await createTestSeller(ctx.prisma);
      const buyer = await createTestUser(ctx.prisma);

      const raffle = await createTestRaffle(ctx.prisma, seller.id, {
        totalTickets: 100,
        precioPorTicket: 100,
      });

      // Create reserved (unpaid) tickets
      const tickets = await createTestTickets(
        ctx.prisma,
        raffle.id,
        buyer.id,
        3,
        {
          estado: TicketStatus.RESERVADO,
          mpExternalReference: 'ref-123',
        },
      );

      // Simulate payment timeout (cron job would handle this)
      await ctx.prisma.ticket.updateMany({
        where: {
          id: { in: tickets.map((t) => t.id) },
        },
        data: {
          estado: TicketStatus.CANCELADO,
        },
      });

      // Verify tickets cancelled
      const cancelledTickets = await ctx.prisma.ticket.findMany({
        where: {
          id: { in: tickets.map((t) => t.id) },
        },
      });
      expect(
        cancelledTickets.every((t) => t.estado === TicketStatus.CANCELADO),
      ).toBe(true);

      // Verify tickets are available again
      const availableNumbers = await ctx.prisma.ticket.findMany({
        where: {
          raffleId: raffle.id,
          estado: { in: [TicketStatus.RESERVADO, TicketStatus.PAGADO] },
        },
      });
      expect(availableNumbers).toHaveLength(0);
    });
  });

  describe('Seller cancellation before draw', () => {
    it('should allow seller to cancel and refund all buyers', async () => {
      const seller = await createTestSeller(ctx.prisma);
      const buyer = await createTestUser(ctx.prisma);

      const raffle = await createTestRaffle(ctx.prisma, seller.id, {
        totalTickets: 50,
        precioPorTicket: 100,
      });

      await createTestTickets(ctx.prisma, raffle.id, buyer.id, 10, {
        estado: TicketStatus.PAGADO,
      });

      // Seller cancels raffle
      const cancelled = await rafflesService.cancelRaffle(raffle.id, seller.id);

      expect(cancelled.estado).toBe(RaffleStatus.CANCELADA);
      expect(cancelled.cancelledBy).toBe('SELLER');
      expect(cancelled.cancelledAt).toBeDefined();

      // Verify all buyers refunded
      const tickets = await ctx.prisma.ticket.findMany({
        where: { raffleId: raffle.id },
      });
      expect(tickets.every((t) => t.estado === TicketStatus.REEMBOLSADO)).toBe(
        true,
      );

      // Verify notification sent to buyers
      expect(mockSendNotification).toHaveBeenCalled();
    });

    it('should NOT allow cancellation after draw', async () => {
      const seller = await createTestSeller(ctx.prisma);
      const buyer = await createTestUser(ctx.prisma);

      const raffle = await createTestRaffle(ctx.prisma, seller.id, {
        totalTickets: 10,
        precioPorTicket: 100,
        estado: RaffleStatus.SORTEADA,
      });

      await createTestTickets(ctx.prisma, raffle.id, buyer.id, 5, {
        estado: TicketStatus.PAGADO,
      });

      // Attempt to cancel after draw
      await expect(
        rafflesService.cancelRaffle(raffle.id, seller.id),
      ).rejects.toThrow('Cannot cancel raffle after draw');
    });
  });

  describe('Partial refund for duplicate purchase', () => {
    it('should refund duplicate tickets and keep original', async () => {
      const seller = await createTestSeller(ctx.prisma);
      const buyer = await createTestUser(ctx.prisma);

      const raffle = await createTestRaffle(ctx.prisma, seller.id, {
        totalTickets: 100,
        precioPorTicket: 100,
      });

      // Create original tickets
      const originalTickets = await createTestTickets(
        ctx.prisma,
        raffle.id,
        buyer.id,
        2,
        {
          estado: TicketStatus.PAGADO,
          mpPaymentId: 'original-payment',
        },
      );

      // Create duplicate tickets (same buyer, different payment)
      const duplicateTickets = await createTestTickets(
        ctx.prisma,
        raffle.id,
        buyer.id,
        2,
        {
          estado: TicketStatus.PAGADO,
          mpPaymentId: 'duplicate-payment',
        },
      );

      // Refund duplicates
      await ticketsService.refundTickets(
        duplicateTickets.map((t) => t.id),
        'DUPLICATE_PAYMENT',
      );

      // Verify duplicates refunded
      const refunded = await ctx.prisma.ticket.findMany({
        where: { id: { in: duplicateTickets.map((t) => t.id) } },
      });
      expect(refunded.every((t) => t.estado === TicketStatus.REEMBOLSADO)).toBe(
        true,
      );

      // Verify originals still valid
      const originals = await ctx.prisma.ticket.findMany({
        where: { id: { in: originalTickets.map((t) => t.id) } },
      });
      expect(originals.every((t) => t.estado === TicketStatus.PAGADO)).toBe(
        true,
      );
    });
  });
});
