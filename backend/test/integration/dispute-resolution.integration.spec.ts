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
import { DisputesService } from '../../src/disputes/disputes.service';
import { NotificationsService } from '../../src/notifications/notifications.service';
import {
  RaffleStatus,
  DisputeStatus,
  DisputeType,
  TicketStatus,
  UserRole,
} from '@prisma/client';

/**
 * Integration tests for dispute resolution flow.
 * Tests the complete dispute lifecycle from opening to resolution.
 */
describe('Dispute Resolution Flow (Integration)', () => {
  let ctx: TestContext;
  let disputesService: DisputesService;
  let notificationsService: NotificationsService;

  // Mock notifications to avoid sending real emails
  const mockSendNotification = jest.fn();

  beforeAll(async () => {
    ctx = await createTestApp();
    disputesService = ctx.app.get<DisputesService>(DisputesService);
    notificationsService =
      ctx.app.get<NotificationsService>(NotificationsService);

    // Mock notification sending
    jest
      .spyOn(notificationsService, 'sendDisputeOpened')
      .mockImplementation(mockSendNotification);
    jest
      .spyOn(notificationsService, 'sendDisputeResolved')
      .mockImplementation(mockSendNotification);
    jest
      .spyOn(notificationsService, 'sendDisputeResponseRequired')
      .mockImplementation(mockSendNotification);
  });

  afterAll(async () => {
    await cleanupTestApp(ctx);
  });

  beforeEach(async () => {
    mockSendNotification.mockClear();
  });

  describe('Winner opens dispute for non-delivery', () => {
    it('should create dispute and freeze payout', async () => {
      // Setup: Create seller, winner, and completed raffle
      const seller = await createTestSeller(ctx.prisma);
      const winner = await createTestUser(ctx.prisma);

      const raffle = await createTestRaffle(ctx.prisma, seller.id, {
        totalTickets: 10,
        precioPorTicket: 100,
        estado: RaffleStatus.FINALIZADA,
      });

      // Create winning ticket
      await createTestTickets(ctx.prisma, raffle.id, winner.id, 1, {
        estado: TicketStatus.PAGADO,
      });

      // Set winner
      await ctx.prisma.raffle.update({
        where: { id: raffle.id },
        data: {
          winnerId: winner.id,
          estado: RaffleStatus.SORTEADA,
          fechaSorteoReal: new Date(),
        },
      });

      // Winner opens dispute
      const dispute = await disputesService.create(
        {
          raffleId: raffle.id,
          type: DisputeType.NO_RECIBI_PRODUCTO,
          description: 'Never received the prize',
        },
        winner.id,
      );

      // Verify dispute created
      expect(dispute).toBeDefined();
      expect(dispute.type).toBe(DisputeType.NO_RECIBI_PRODUCTO);
      expect(dispute.status).toBe(DisputeStatus.ABIERTA);
      expect(dispute.reporterId).toBe(winner.id);
      expect(dispute.raffleId).toBe(raffle.id);

      // Verify payout is frozen
      const updatedRaffle = await ctx.prisma.raffle.findUnique({
        where: { id: raffle.id },
      });
      expect(updatedRaffle?.payoutFrozen).toBe(true);

      // Verify notification sent to seller
      expect(mockSendNotification).toHaveBeenCalled();
    });

    it('should allow seller to respond to dispute', async () => {
      const seller = await createTestSeller(ctx.prisma);
      const winner = await createTestUser(ctx.prisma);

      const raffle = await createTestRaffle(ctx.prisma, seller.id, {
        totalTickets: 10,
        precioPorTicket: 100,
      });

      await createTestTickets(ctx.prisma, raffle.id, winner.id, 1, {
        estado: TicketStatus.PAGADO,
      });

      await ctx.prisma.raffle.update({
        where: { id: raffle.id },
        data: {
          winnerId: winner.id,
          estado: RaffleStatus.SORTEADA,
        },
      });

      const dispute = await disputesService.create(
        {
          raffleId: raffle.id,
          type: DisputeType.NO_RECIBI_PRODUCTO,
          description: 'Never received the prize',
        },
        winner.id,
      );

      // Seller responds
      const respondedDispute = await disputesService.addSellerResponse(
        dispute.id,
        seller.id,
        'I shipped it last week, tracking number ABC123',
      );

      expect(respondedDispute.sellerResponse).toBe(
        'I shipped it last week, tracking number ABC123',
      );
      expect(respondedDispute.sellerRespondedAt).toBeDefined();
      expect(respondedDispute.status).toBe(DisputeStatus.EN_NEGOCIACION);
    });
  });

  describe('Admin resolves dispute in favor of buyer', () => {
    it('should refund tickets and release dispute', async () => {
      const seller = await createTestSeller(ctx.prisma);
      const winner = await createTestUser(ctx.prisma);
      const admin = await createTestUser(ctx.prisma, { role: UserRole.ADMIN });

      const raffle = await createTestRaffle(ctx.prisma, seller.id, {
        totalTickets: 10,
        precioPorTicket: 100,
      });

      await createTestTickets(ctx.prisma, raffle.id, winner.id, 1, {
        estado: TicketStatus.PAGADO,
      });

      await ctx.prisma.raffle.update({
        where: { id: raffle.id },
        data: {
          winnerId: winner.id,
          estado: RaffleStatus.SORTEADA,
        },
      });

      const dispute = await disputesService.create(
        {
          raffleId: raffle.id,
          type: DisputeType.NO_RECIBI_PRODUCTO,
          description: 'Never received the prize',
        },
        winner.id,
      );

      // Admin resolves in favor of buyer
      const resolved = await disputesService.resolve(
        dispute.id,
        DisputeStatus.RESUELTA_FAVOR_COMPRADOR,
        'Seller did not provide tracking proof',
        admin.id,
      );

      expect(resolved.status).toBe(DisputeStatus.RESUELTA_FAVOR_COMPRADOR);
      expect(resolved.resolvedById).toBe(admin.id);
      expect(resolved.resolvedAt).toBeDefined();

      // Verify tickets marked as refunded
      const tickets = await ctx.prisma.ticket.findMany({
        where: { raffleId: raffle.id, buyerId: winner.id },
      });
      expect(tickets.every((t) => t.estado === TicketStatus.REEMBOLSADO)).toBe(
        true,
      );

      // Verify notification sent
      expect(mockSendNotification).toHaveBeenCalled();
    });
  });

  describe('Admin resolves dispute in favor of seller', () => {
    it('should release payout and close dispute', async () => {
      const seller = await createTestSeller(ctx.prisma);
      const winner = await createTestUser(ctx.prisma);
      const admin = await createTestUser(ctx.prisma, { role: UserRole.ADMIN });

      const raffle = await createTestRaffle(ctx.prisma, seller.id, {
        totalTickets: 10,
        precioPorTicket: 100,
      });

      await createTestTickets(ctx.prisma, raffle.id, winner.id, 1, {
        estado: TicketStatus.PAGADO,
      });

      await ctx.prisma.raffle.update({
        where: { id: raffle.id },
        data: {
          winnerId: winner.id,
          estado: RaffleStatus.SORTEADA,
        },
      });

      const dispute = await disputesService.create(
        {
          raffleId: raffle.id,
          type: DisputeType.NO_RECIBI_PRODUCTO,
          description: 'Never received the prize',
        },
        winner.id,
      );

      // Seller provides proof
      await disputesService.addSellerResponse(
        dispute.id,
        seller.id,
        'Tracking: ABC123, delivered on 2024-01-15',
      );

      // Admin resolves in favor of seller
      const resolved = await disputesService.resolve(
        dispute.id,
        DisputeStatus.RESUELTA_FAVOR_VENDEDOR,
        'Seller provided valid tracking proof',
        admin.id,
      );

      expect(resolved.status).toBe(DisputeStatus.RESUELTA_FAVOR_VENDEDOR);

      // Verify payout unfrozen
      const updatedRaffle = await ctx.prisma.raffle.findUnique({
        where: { id: raffle.id },
      });
      expect(updatedRaffle?.payoutFrozen).toBe(false);
    });
  });

  describe('Dispute escalation timeline', () => {
    it('should auto-escalate after 48 hours without seller response', async () => {
      const seller = await createTestSeller(ctx.prisma);
      const winner = await createTestUser(ctx.prisma);

      const raffle = await createTestRaffle(ctx.prisma, seller.id, {
        totalTickets: 10,
        precioPorTicket: 100,
      });

      await createTestTickets(ctx.prisma, raffle.id, winner.id, 1, {
        estado: TicketStatus.PAGADO,
      });

      await ctx.prisma.raffle.update({
        where: { id: raffle.id },
        data: {
          winnerId: winner.id,
          estado: RaffleStatus.SORTEADA,
        },
      });

      const dispute = await disputesService.create(
        {
          raffleId: raffle.id,
          type: DisputeType.NO_RECIBI_PRODUCTO,
          description: 'Never received the prize',
        },
        winner.id,
      );

      // Simulate time passing (in real scenario, cron job would handle this)
      await ctx.prisma.dispute.update({
        where: { id: dispute.id },
        data: {
          createdAt: new Date(Date.now() - 49 * 60 * 60 * 1000), // 49 hours ago
        },
      });

      // Run escalation check
      await disputesService.checkAndEscalateDisputes();

      const updatedDispute = await ctx.prisma.dispute.findUnique({
        where: { id: dispute.id },
      });

      expect(updatedDispute?.status).toBe(DisputeStatus.ESCALADA_ADMIN);
      expect(updatedDispute?.escalatedAt).toBeDefined();
    });
  });
});
