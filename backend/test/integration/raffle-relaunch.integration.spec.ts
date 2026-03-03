import { ForbiddenException } from '@nestjs/common';
import { RaffleStatus } from '@prisma/client';
import { RafflesService } from '../../src/raffles/raffles.service';
import { cleanupTestApp, createTestApp, TestContext } from './setup';
import { createTestRaffle, createTestSeller } from './factories';

describe('Raffle Relaunch Flow (Integration)', () => {
  let ctx: TestContext;
  let rafflesService: RafflesService;

  beforeAll(async () => {
    ctx = await createTestApp();
    rafflesService = ctx.app.get<RafflesService>(RafflesService);
  });

  afterAll(async () => {
    await cleanupTestApp(ctx);
  });

  it('relaunches a cancelled raffle using suggested price and marks suggestion accepted', async () => {
    const seller = await createTestSeller(ctx.prisma);

    const originalRaffle = await createTestRaffle(ctx.prisma, seller.id, {
      titulo: 'Original Raffle',
      descripcion: 'Descripcion de prueba para relanzamiento',
      totalTickets: 100,
      precioPorTicket: 100,
      estado: RaffleStatus.CANCELADA,
    });

    const reduction = await ctx.prisma.priceReduction.create({
      data: {
        raffleId: originalRaffle.id,
        precioAnterior: 100,
        precioSugerido: 80,
        porcentajeReduccion: 20,
        ticketsVendidosAlMomento: 30,
      },
    });

    const relaunched = await rafflesService.relaunchWithSuggestedPrice(seller.id, {
      originalRaffleId: originalRaffle.id,
      priceReductionId: reduction.id,
    });

    expect(relaunched.id).not.toBe(originalRaffle.id);
    expect(relaunched.sellerId).toBe(seller.id);
    expect(relaunched.estado).toBe(RaffleStatus.ACTIVA);
    expect(Number(relaunched.precioPorTicket)).toBe(80);

    const updatedReduction = await ctx.prisma.priceReduction.findUnique({
      where: { id: reduction.id },
    });
    expect(updatedReduction?.aceptada).toBe(true);
    expect(updatedReduction?.fechaRespuesta).toBeDefined();
  });

  it('blocks relaunch for users that do not own the original raffle', async () => {
    const seller = await createTestSeller(ctx.prisma);
    const otherSeller = await createTestSeller(ctx.prisma);

    const originalRaffle = await createTestRaffle(ctx.prisma, seller.id, {
      totalTickets: 100,
      precioPorTicket: 100,
      estado: RaffleStatus.CANCELADA,
    });

    const reduction = await ctx.prisma.priceReduction.create({
      data: {
        raffleId: originalRaffle.id,
        precioAnterior: 100,
        precioSugerido: 85,
        porcentajeReduccion: 15,
        ticketsVendidosAlMomento: 40,
      },
    });

    await expect(
      rafflesService.relaunchWithSuggestedPrice(otherSeller.id, {
        originalRaffleId: originalRaffle.id,
        priceReductionId: reduction.id,
      }),
    ).rejects.toThrow(ForbiddenException);
  });
});
