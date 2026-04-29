import * as request from 'supertest';
import { App } from 'supertest/types';
import {
  cleanupTestApp,
  createTestApp,
  generateTestToken,
  TestContext,
} from './setup';
import {
  createTestRaffle,
  createTestSeller,
  createTestUser,
} from './factories';

interface GraphQLError {
  message: string;
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: GraphQLError[];
}

interface BuyTicketsData {
  buyTickets: {
    paidWithCredit: boolean;
    creditDebited: number;
    creditBalanceAfter: number;
    baseQuantity: number;
    bonusQuantity: number;
    grantedQuantity: number;
    packApplied: boolean;
    tickets: Array<{ id: string; numeroTicket: number; estado: string }>;
  };
}

describe('Ticket Purchase Flow (Integration)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  }, 60000);

  afterAll(async () => {
    await cleanupTestApp(ctx);
  }, 30000);

  it('buys tickets directly with Saldo LUK and applies the simple pack', async () => {
    const seller = await createTestSeller(ctx.prisma);
    const buyer = await createTestUser(ctx.prisma);
    const buyerToken = generateTestToken(ctx, buyer);
    const raffle = await createTestRaffle(ctx.prisma, seller.id, {
      totalTickets: 100,
      precioPorTicket: 150,
    });

    await ctx.prisma.shippingAddress.create({
      data: {
        userId: buyer.id,
        recipientName: 'Buyer QA',
        phone: '+541112345678',
        street: 'Av. Test',
        number: '123',
        city: 'CABA',
        province: 'CABA',
        postalCode: '1000',
      },
    });
    await ctx.prisma.walletAccount.create({
      data: { userId: buyer.id, creditBalance: 1000 },
    });

    const mutation = `
      mutation BuyTickets($raffleId: String!, $cantidad: Int!) {
        buyTickets(raffleId: $raffleId, cantidad: $cantidad) {
          paidWithCredit
          creditDebited
          creditBalanceAfter
          baseQuantity
          bonusQuantity
          grantedQuantity
          packApplied
          tickets {
            id
            numeroTicket
            estado
          }
        }
      }
    `;

    const response = await request(ctx.app.getHttpServer() as App)
      .post('/graphql')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        query: mutation,
        variables: { raffleId: raffle.id, cantidad: 5 },
      });

    expect(response.status).toBe(200);
    const result = response.body as GraphQLResponse<BuyTicketsData>;
    expect(result.errors).toBeUndefined();
    expect(result.data?.buyTickets).toMatchObject({
      paidWithCredit: true,
      creditDebited: 750,
      creditBalanceAfter: 250,
      baseQuantity: 5,
      bonusQuantity: 1,
      grantedQuantity: 6,
      packApplied: true,
    });
    expect(result.data?.buyTickets.tickets).toHaveLength(6);
  });

  it('fails before ticket emission when Saldo LUK is insufficient', async () => {
    const seller = await createTestSeller(ctx.prisma);
    const buyer = await createTestUser(ctx.prisma);
    const buyerToken = generateTestToken(ctx, buyer);
    const raffle = await createTestRaffle(ctx.prisma, seller.id, {
      totalTickets: 100,
      precioPorTicket: 150,
    });

    await ctx.prisma.shippingAddress.create({
      data: {
        userId: buyer.id,
        recipientName: 'Buyer QA',
        phone: '+541112345678',
        street: 'Av. Test',
        number: '123',
        city: 'CABA',
        province: 'CABA',
        postalCode: '1000',
      },
    });
    await ctx.prisma.walletAccount.create({
      data: { userId: buyer.id, creditBalance: 100 },
    });

    const mutation = `
      mutation BuyTickets($raffleId: String!, $cantidad: Int!) {
        buyTickets(raffleId: $raffleId, cantidad: $cantidad) {
          tickets { id }
        }
      }
    `;

    const response = await request(ctx.app.getHttpServer() as App)
      .post('/graphql')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        query: mutation,
        variables: { raffleId: raffle.id, cantidad: 5 },
      });

    expect(response.status).toBe(200);
    const result = response.body as GraphQLResponse<BuyTicketsData>;
    expect(result.errors?.[0]?.message).toContain('Saldo LUK insuficiente');

    const emittedTickets = await ctx.prisma.ticket.count({
      where: { raffleId: raffle.id, buyerId: buyer.id },
    });
    expect(emittedTickets).toBe(0);
  });
});
