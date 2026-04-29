import { RaffleStatus, TicketStatus } from '@prisma/client';
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

  beforeAll(async () => {
    ctx = await createTestApp();
    raffleTasksService = ctx.app.get<RaffleTasksService>(RaffleTasksService);
  });

  afterAll(async () => {
    await cleanupTestApp(ctx);
  });

  it('cancels expired raffles and refunds tickets to Saldo LUK', async () => {
    const seller = await createTestSeller(ctx.prisma);
    const buyer = await createTestUser(ctx.prisma);

    await ctx.prisma.walletAccount.create({
      data: {
        userId: seller.id,
        sellerPayableBalance: 400,
      },
    });
    await ctx.prisma.walletAccount.create({
      data: { userId: buyer.id, creditBalance: 0 },
    });

    const pastDeadline = new Date();
    pastDeadline.setHours(pastDeadline.getHours() - 2);

    const raffle = await createTestRaffle(ctx.prisma, seller.id, {
      totalTickets: 10,
      precioPorTicket: 100,
      fechaLimiteSorteo: pastDeadline,
      estado: RaffleStatus.ACTIVA,
    });

    await createTestTickets(ctx.prisma, raffle.id, buyer.id, 4, {
      estado: TicketStatus.PAGADO,
      precioPagado: 100,
      purchaseReference: 'cancel-refund-purchase',
    });

    await raffleTasksService.processExpiredRaffles();

    const updatedRaffle = await ctx.prisma.raffle.findUnique({
      where: { id: raffle.id },
    });
    const tickets = await ctx.prisma.ticket.findMany({
      where: { raffleId: raffle.id },
    });
    const buyerWallet = await ctx.prisma.walletAccount.findUnique({
      where: { userId: buyer.id },
    });

    expect(updatedRaffle?.estado).toBe(RaffleStatus.CANCELADA);
    expect(
      tickets.every((ticket) => ticket.estado === TicketStatus.REEMBOLSADO),
    ).toBe(true);
    expect(Number(buyerWallet?.creditBalance ?? 0)).toBe(400);
  });
});
