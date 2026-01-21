import { PrismaService } from '../../src/prisma/prisma.service';
import {
  UserRole,
  RaffleStatus,
  ProductCondition,
  TicketStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

let userCounter = 0;
let raffleCounter = 0;

/**
 * Create a test user with optional properties.
 */
export async function createTestUser(
  prisma: PrismaService,
  overrides: {
    email?: string;
    password?: string;
    nombre?: string;
    apellido?: string;
    role?: UserRole;
    mpConnectStatus?: 'NOT_CONNECTED' | 'PENDING' | 'CONNECTED';
    fechaNacimiento?: Date;
  } = {},
): Promise<{
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  role: UserRole;
}> {
  userCounter++;
  const email = overrides.email ?? `testuser${userCounter}@test.com`;
  const passwordHash = await bcrypt.hash(
    overrides.password ?? 'testpassword123',
    10,
  );

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      nombre: overrides.nombre ?? `Test${userCounter}`,
      apellido: overrides.apellido ?? 'User',
      role: overrides.role ?? UserRole.USER,
      mpConnectStatus: overrides.mpConnectStatus ?? 'NOT_CONNECTED',
      fechaNacimiento: overrides.fechaNacimiento ?? new Date('1990-01-01'),
      termsAcceptedAt: new Date(),
      termsVersion: '2026-01',
      reputation: {
        create: {},
      },
    },
  });

  return {
    id: user.id,
    email: user.email,
    nombre: user.nombre,
    apellido: user.apellido,
    role: user.role,
  };
}

/**
 * Create a test seller with MP Connect configured.
 */
export async function createTestSeller(
  prisma: PrismaService,
  overrides: {
    email?: string;
    nombre?: string;
    apellido?: string;
  } = {},
): Promise<{
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  role: UserRole;
}> {
  return createTestUser(prisma, {
    ...overrides,
    mpConnectStatus: 'CONNECTED',
  });
}

/**
 * Create a test raffle with product.
 */
export async function createTestRaffle(
  prisma: PrismaService,
  sellerId: string,
  overrides: {
    titulo?: string;
    descripcion?: string;
    totalTickets?: number;
    precioPorTicket?: number;
    fechaLimiteSorteo?: Date;
    estado?: RaffleStatus;
    productNombre?: string;
  } = {},
): Promise<{
  id: string;
  titulo: string;
  totalTickets: number;
  precioPorTicket: number;
  estado: RaffleStatus;
  sellerId: string;
}> {
  raffleCounter++;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const raffle = await prisma.raffle.create({
    data: {
      titulo: overrides.titulo ?? `Test Raffle ${raffleCounter}`,
      descripcion: overrides.descripcion ?? 'Test raffle description',
      sellerId,
      totalTickets: overrides.totalTickets ?? 100,
      precioPorTicket: overrides.precioPorTicket ?? 100,
      fechaLimiteSorteo: overrides.fechaLimiteSorteo ?? tomorrow,
      estado: overrides.estado ?? RaffleStatus.ACTIVA,
      product: {
        create: {
          nombre: overrides.productNombre ?? `Test Product ${raffleCounter}`,
          descripcionDetallada: 'Test product description',
          condicion: ProductCondition.NUEVO,
          imagenes: ['https://example.com/image.jpg'],
        },
      },
    },
    select: {
      id: true,
      titulo: true,
      totalTickets: true,
      precioPorTicket: true,
      estado: true,
      sellerId: true,
    },
  });

  return {
    id: raffle.id,
    titulo: raffle.titulo,
    totalTickets: raffle.totalTickets,
    precioPorTicket: Number(raffle.precioPorTicket),
    estado: raffle.estado,
    sellerId: raffle.sellerId,
  };
}

/**
 * Create test tickets for a raffle.
 */
export async function createTestTickets(
  prisma: PrismaService,
  raffleId: string,
  buyerId: string,
  count: number,
  overrides: {
    precioPagado?: number;
    estado?: TicketStatus;
    mpPaymentId?: string;
  } = {},
): Promise<Array<{ id: string; numeroTicket: number; estado: TicketStatus }>> {
  const tickets: Array<{
    id: string;
    numeroTicket: number;
    estado: TicketStatus;
  }> = [];

  // Get the next available ticket number
  const lastTicket = await prisma.ticket.findFirst({
    where: { raffleId },
    orderBy: { numeroTicket: 'desc' },
  });
  const startNumber = (lastTicket?.numeroTicket ?? 0) + 1;

  for (let i = 0; i < count; i++) {
    const ticket = await prisma.ticket.create({
      data: {
        raffleId,
        buyerId,
        numeroTicket: startNumber + i,
        precioPagado: overrides.precioPagado ?? 100,
        estado: overrides.estado ?? TicketStatus.PAGADO,
        mpPaymentId: overrides.mpPaymentId,
      },
      select: {
        id: true,
        numeroTicket: true,
        estado: true,
      },
    });
    tickets.push(ticket);
  }

  return tickets;
}

/**
 * Create a paid ticket purchase (includes transaction).
 */
export async function createPaidTicketPurchase(
  prisma: PrismaService,
  raffleId: string,
  buyerId: string,
  ticketCount: number,
  mpPaymentId: string,
): Promise<{
  tickets: Array<{ id: string; numeroTicket: number }>;
  transactionId: string;
}> {
  const tickets = await createTestTickets(
    prisma,
    raffleId,
    buyerId,
    ticketCount,
    {
      estado: TicketStatus.PAGADO,
      mpPaymentId,
    },
  );

  const transaction = await prisma.transaction.create({
    data: {
      tipo: 'COMPRA_TICKET',
      userId: buyerId,
      raffleId,
      monto: ticketCount * 100,
      mpPaymentId,
      estado: 'COMPLETADO',
    },
  });

  return {
    tickets,
    transactionId: transaction.id,
  };
}

/**
 * Fill a raffle with paid tickets to complete it.
 */
export async function fillRaffleWithTickets(
  prisma: PrismaService,
  raffleId: string,
  raffle: { totalTickets: number },
): Promise<{
  buyers: Array<{ id: string; email: string }>;
  tickets: Array<{ id: string; numeroTicket: number; buyerId: string }>;
}> {
  const buyers: Array<{ id: string; email: string }> = [];
  const tickets: Array<{ id: string; numeroTicket: number; buyerId: string }> =
    [];

  // Create buyers and tickets
  const ticketsPerBuyer = 10;
  const numBuyers = Math.ceil(raffle.totalTickets / ticketsPerBuyer);

  for (let i = 0; i < numBuyers; i++) {
    const buyer = await createTestUser(prisma);
    buyers.push({ id: buyer.id, email: buyer.email });

    const remainingTickets = raffle.totalTickets - tickets.length;
    const ticketCount = Math.min(ticketsPerBuyer, remainingTickets);

    if (ticketCount > 0) {
      const newTickets = await createTestTickets(
        prisma,
        raffleId,
        buyer.id,
        ticketCount,
        {
          estado: TicketStatus.PAGADO,
          mpPaymentId: `test-payment-${i}`,
        },
      );

      newTickets.forEach((t) => {
        tickets.push({ ...t, buyerId: buyer.id });
      });
    }
  }

  // Update raffle status to COMPLETADA
  await prisma.raffle.update({
    where: { id: raffleId },
    data: { estado: RaffleStatus.COMPLETADA },
  });

  return { buyers, tickets };
}
