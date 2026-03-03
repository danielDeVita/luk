import { RaffleStatus, TicketStatus } from '@prisma/client';
import { PaymentsService } from '../../src/payments/payments.service';
import { RaffleTasksService } from '../../src/tasks/raffle-tasks.service';
import { cleanupTestApp, createTestApp, TestContext } from './setup';
import {
  createTestRaffle,
  createTestSeller,
  createTestTickets,
  createTestUser,
} from './factories';

describe('Refund and Cancellation Flow (Integration)', () => {
  let ctx: TestContext;
  let raffleTasksService: RaffleTasksService;
  let paymentsService: PaymentsService;

  beforeAll(async () => {
    ctx = await createTestApp();
    raffleTasksService = ctx.app.get<RaffleTasksService>(RaffleTasksService);
    paymentsService = ctx.app.get<PaymentsService>(PaymentsService);
  });

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await cleanupTestApp(ctx);
  });

  it('cancels expired raffle and marks all tickets refunded only when all refunds succeed', async () => {
    const seller = await createTestSeller(ctx.prisma);
    const buyer1 = await createTestUser(ctx.prisma);
    const buyer2 = await createTestUser(ctx.prisma);

    const pastDeadline = new Date();
    pastDeadline.setHours(pastDeadline.getHours() - 2);

    const raffle = await createTestRaffle(ctx.prisma, seller.id, {
      totalTickets: 10,
      precioPorTicket: 100,
      fechaLimiteSorteo: pastDeadline,
      estado: RaffleStatus.ACTIVA,
    });

    await createTestTickets(ctx.prisma, raffle.id, buyer1.id, 2, {
      estado: TicketStatus.PAGADO,
      precioPagado: 100,
      mpPaymentId: 'ok-pay-1',
    });
    await createTestTickets(ctx.prisma, raffle.id, buyer2.id, 2, {
      estado: TicketStatus.PAGADO,
      precioPagado: 100,
      mpPaymentId: 'ok-pay-2',
    });

    jest.spyOn(paymentsService, 'refundPayment').mockResolvedValue(true);

    await raffleTasksService.processExpiredRaffles();

    const updatedRaffle = await ctx.prisma.raffle.findUnique({
      where: { id: raffle.id },
    });
    const tickets = await ctx.prisma.ticket.findMany({
      where: { raffleId: raffle.id },
    });

    expect(updatedRaffle?.estado).toBe(RaffleStatus.CANCELADA);
    expect(tickets.every((t) => t.estado === TicketStatus.REEMBOLSADO)).toBe(
      true,
    );
  });

  it('does not mark unpaid-refund tickets as refunded or cancel raffle when any refund fails', async () => {
    const seller = await createTestSeller(ctx.prisma);
    const buyer = await createTestUser(ctx.prisma);

    const pastDeadline = new Date();
    pastDeadline.setHours(pastDeadline.getHours() - 2);

    const raffle = await createTestRaffle(ctx.prisma, seller.id, {
      totalTickets: 10,
      precioPorTicket: 100,
      fechaLimiteSorteo: pastDeadline,
      estado: RaffleStatus.ACTIVA,
    });

    const okTicket = await createTestTickets(ctx.prisma, raffle.id, buyer.id, 1, {
      estado: TicketStatus.PAGADO,
      precioPagado: 100,
      mpPaymentId: 'ok-pay',
    });
    const failTicket = await createTestTickets(
      ctx.prisma,
      raffle.id,
      buyer.id,
      1,
      {
        estado: TicketStatus.PAGADO,
        precioPagado: 100,
        mpPaymentId: 'fail-pay',
      },
    );

    jest
      .spyOn(paymentsService, 'refundPayment')
      .mockImplementation(async (mpPaymentId: string) => mpPaymentId !== 'fail-pay');

    await raffleTasksService.processExpiredRaffles();

    const updatedRaffle = await ctx.prisma.raffle.findUnique({
      where: { id: raffle.id },
    });
    const refreshedOkTicket = await ctx.prisma.ticket.findUnique({
      where: { id: okTicket[0].id },
    });
    const refreshedFailTicket = await ctx.prisma.ticket.findUnique({
      where: { id: failTicket[0].id },
    });

    expect(updatedRaffle?.estado).toBe(RaffleStatus.ACTIVA);
    expect(refreshedOkTicket?.estado).toBe(TicketStatus.REEMBOLSADO);
    expect(refreshedFailTicket?.estado).toBe(TicketStatus.PAGADO);
  });
});
