import { ForbiddenException } from '@nestjs/common';
import {
  DisputeStatus,
  DisputeType,
  RaffleStatus,
  UserRole,
} from '@prisma/client';
import { DisputesService } from '../../src/disputes/disputes.service';
import { PaymentsService } from '../../src/payments/payments.service';
import { cleanupTestApp, createTestApp, TestContext } from './setup';
import {
  createTestRaffle,
  createTestSeller,
  createTestTickets,
  createTestUser,
} from './factories';

describe('Dispute Resolution Flow (Integration)', () => {
  let ctx: TestContext;
  let disputesService: DisputesService;
  let paymentsService: PaymentsService;

  beforeAll(async () => {
    ctx = await createTestApp();
    disputesService = ctx.app.get<DisputesService>(DisputesService);
    paymentsService = ctx.app.get<PaymentsService>(PaymentsService);
  });

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await cleanupTestApp(ctx);
  });

  it('refunds only the disputing buyer and requested amount on partial resolution', async () => {
    const seller = await createTestSeller(ctx.prisma);
    const winner = await createTestUser(ctx.prisma);
    const otherBuyer = await createTestUser(ctx.prisma);
    const admin = await createTestUser(ctx.prisma, { role: UserRole.ADMIN });

    const raffle = await createTestRaffle(ctx.prisma, seller.id, {
      totalTickets: 20,
      precioPorTicket: 100,
      estado: RaffleStatus.SORTEADA,
    });

    await createTestTickets(ctx.prisma, raffle.id, winner.id, 1, {
      estado: 'PAGADO',
      precioPagado: 100,
      mpPaymentId: 'winner-pay-1',
    });
    await createTestTickets(ctx.prisma, raffle.id, winner.id, 1, {
      estado: 'PAGADO',
      precioPagado: 100,
      mpPaymentId: 'winner-pay-2',
    });
    await createTestTickets(ctx.prisma, raffle.id, otherBuyer.id, 2, {
      estado: 'PAGADO',
      precioPagado: 100,
      mpPaymentId: 'other-pay-1',
    });

    await ctx.prisma.raffle.update({
      where: { id: raffle.id },
      data: {
        winnerId: winner.id,
        fechaSorteoReal: new Date(),
      },
    });

    const dispute = await disputesService.openDispute(winner.id, {
      raffleId: raffle.id,
      tipo: DisputeType.NO_LLEGO,
      titulo: 'El producto nunca llegó al domicilio',
      descripcion:
        'Pasaron más de siete días desde que el vendedor indicó que enviaría el premio y no recibí ningún paquete ni respuesta clara.',
      evidencias: ['https://example.com/evidence-1.jpg'],
    });

    const refundSpy = jest
      .spyOn(paymentsService, 'refundPayment')
      .mockResolvedValue(true);

    const resolved = await disputesService.resolveDispute(
      admin.id,
      dispute.id,
      {
        decision: DisputeStatus.RESUELTA_PARCIAL,
        resolucion:
          'Se otorga reembolso parcial al comprador por incumplimiento parcial de entrega.',
        montoReembolsado: 100,
        montoPagadoVendedor: 100,
        adminNotes: 'Caso resuelto con devolución parcial',
      },
    );

    expect(resolved.estado).toBe(DisputeStatus.RESUELTA_PARCIAL);
    expect(refundSpy).toHaveBeenCalledTimes(1);
    expect(refundSpy).toHaveBeenCalledWith('winner-pay-1', undefined);

    const winnerTickets = await ctx.prisma.ticket.findMany({
      where: { raffleId: raffle.id, buyerId: winner.id },
      orderBy: { numeroTicket: 'asc' },
    });
    const otherBuyerTickets = await ctx.prisma.ticket.findMany({
      where: { raffleId: raffle.id, buyerId: otherBuyer.id },
    });

    expect(winnerTickets.map((t) => t.estado)).toEqual([
      'REEMBOLSADO',
      'PAGADO',
    ]);
    expect(otherBuyerTickets.every((t) => t.estado === 'PAGADO')).toBe(true);
  });

  it('blocks ID-based dispute access for unrelated users', async () => {
    const seller = await createTestSeller(ctx.prisma);
    const winner = await createTestUser(ctx.prisma);
    const stranger = await createTestUser(ctx.prisma);

    const raffle = await createTestRaffle(ctx.prisma, seller.id, {
      totalTickets: 10,
      precioPorTicket: 100,
      estado: RaffleStatus.SORTEADA,
    });

    await createTestTickets(ctx.prisma, raffle.id, winner.id, 1, {
      estado: 'PAGADO',
      precioPagado: 100,
      mpPaymentId: 'winner-only-pay',
    });

    await ctx.prisma.raffle.update({
      where: { id: raffle.id },
      data: {
        winnerId: winner.id,
        fechaSorteoReal: new Date(),
      },
    });

    const dispute = await disputesService.openDispute(winner.id, {
      raffleId: raffle.id,
      tipo: DisputeType.NO_LLEGO,
      titulo: 'Demora excesiva en la entrega',
      descripcion:
        'El vendedor no respondió durante varios días y no hay información verificable sobre el envío del premio.',
      evidencias: ['https://example.com/evidence-2.jpg'],
    });

    await expect(
      disputesService.findOneForUser(dispute.id, stranger.id, UserRole.USER),
    ).rejects.toThrow(ForbiddenException);
  });
});
