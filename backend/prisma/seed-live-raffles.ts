import {
  PrismaClient,
  RaffleStatus,
  DeliveryStatus,
  ProductCondition,
  TicketStatus,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

// ── Config ──────────────────────────────────────────────────────────────

const TEST_EMAILS = {
  user1: 'nombretestdepruebaaver@gmail.com',
  user2: 'nombretestdepruebaaver2@gmail.com',
};

const TAG = '[LIVE-TEST]';

// 10 raffles: user1 sells 5, user2 sells 5
// The other user buys tickets in each
const RAFFLES = [
  // user1 sells → user2 buys
  {
    titulo: `${TAG} iPhone 16 Pro Max 256GB`,
    productName: 'iPhone 16 Pro Max',
    desc: 'iPhone 16 Pro Max 256GB Titanio Negro. Sellado en caja. Garantía oficial Apple Argentina.',
    image: 'https://picsum.photos/seed/iphone16/800/600',
    totalTickets: 10,
    ticketsSold: 8,
    precio: 5000,
    sellerKey: 'user1' as const,
  },
  {
    titulo: `${TAG} MacBook Air M3 15"`,
    productName: 'MacBook Air M3 15 pulgadas',
    desc: 'MacBook Air M3 15" 16GB RAM 512GB SSD. Color Medianoche. Sin uso, factura.',
    image: 'https://picsum.photos/seed/macbookm3/800/600',
    totalTickets: 20,
    ticketsSold: 15,
    precio: 3500,
    sellerKey: 'user1' as const,
  },
  {
    titulo: `${TAG} PlayStation 5 Slim Digital`,
    productName: 'PS5 Slim Digital Edition',
    desc: 'PlayStation 5 Slim Digital Edition. Incluye 2 joysticks DualSense y juego Astro Bot.',
    image: 'https://picsum.photos/seed/ps5slim/800/600',
    totalTickets: 15,
    ticketsSold: 12,
    precio: 2000,
    sellerKey: 'user1' as const,
  },
  {
    titulo: `${TAG} AirPods Pro 2 USB-C`,
    productName: 'AirPods Pro 2',
    desc: 'Apple AirPods Pro 2da gen con estuche USB-C. Cancelación de ruido activa. Nuevos.',
    image: 'https://picsum.photos/seed/airpodspro/800/600',
    totalTickets: 10,
    ticketsSold: 8,
    precio: 1500,
    sellerKey: 'user1' as const,
  },
  {
    titulo: `${TAG} Nintendo Switch OLED Edición Zelda`,
    productName: 'Nintendo Switch OLED Zelda Edition',
    desc: 'Nintendo Switch OLED edición especial Tears of the Kingdom. Incluye juego descargable.',
    image: 'https://picsum.photos/seed/switchzelda/800/600',
    totalTickets: 10,
    ticketsSold: 9,
    precio: 2500,
    sellerKey: 'user1' as const,
  },
  // user2 sells → user1 buys
  {
    titulo: `${TAG} Samsung Galaxy S24 Ultra`,
    productName: 'Samsung Galaxy S24 Ultra 512GB',
    desc: 'Samsung Galaxy S24 Ultra 512GB Titanium Gray. Libre de fábrica. Con S-Pen.',
    image: 'https://picsum.photos/seed/s24ultra/800/600',
    totalTickets: 10,
    ticketsSold: 7,
    precio: 4500,
    sellerKey: 'user2' as const,
  },
  {
    titulo: `${TAG} DJI Mini 4 Pro Fly More Combo`,
    productName: 'DJI Mini 4 Pro',
    desc: 'Drone DJI Mini 4 Pro Fly More Combo. 3 baterías, control RC2, estuche. Nuevo.',
    image: 'https://picsum.photos/seed/djimini4/800/600',
    totalTickets: 15,
    ticketsSold: 11,
    precio: 3000,
    sellerKey: 'user2' as const,
  },
  {
    titulo: `${TAG} Sony WH-1000XM5 Auriculares`,
    productName: 'Sony WH-1000XM5',
    desc: 'Auriculares Sony WH-1000XM5 con cancelación de ruido. Color negro. Sellados.',
    image: 'https://picsum.photos/seed/sonyxm5/800/600',
    totalTickets: 10,
    ticketsSold: 8,
    precio: 1800,
    sellerKey: 'user2' as const,
  },
  {
    titulo: `${TAG} iPad Air M2 11"`,
    productName: 'iPad Air M2 11 pulgadas',
    desc: 'Apple iPad Air M2 11" 256GB WiFi. Color Starlight. Con Apple Pencil Pro.',
    image: 'https://picsum.photos/seed/ipadair/800/600',
    totalTickets: 10,
    ticketsSold: 8,
    precio: 4000,
    sellerKey: 'user2' as const,
  },
  {
    titulo: `${TAG} Garmin Fenix 8 Solar`,
    productName: 'Garmin Fenix 8 Solar',
    desc: 'Reloj Garmin Fenix 8 Solar 47mm. GPS multibanda, mapas, música. Nuevo en caja.',
    image: 'https://picsum.photos/seed/garminfenix/800/600',
    totalTickets: 10,
    ticketsSold: 7,
    precio: 5500,
    sellerKey: 'user2' as const,
  },
];

// ── Main ────────────────────────────────────────────────────────────────

async function main() {
  console.log('🎰 Creating live test raffles...\n');

  // 1. Verify users exist
  const user1 = await prisma.user.findUnique({
    where: { email: TEST_EMAILS.user1 },
  });
  if (!user1) throw new Error(`❌ User not found: ${TEST_EMAILS.user1}`);
  console.log(`✅ User 1: ${user1.nombre} (${user1.email})`);

  const user2 = await prisma.user.findUnique({
    where: { email: TEST_EMAILS.user2 },
  });
  if (!user2) throw new Error(`❌ User not found: ${TEST_EMAILS.user2}`);
  console.log(`✅ User 2: ${user2.nombre} (${user2.email})`);

  // 2. Cleanup previous live test data
  console.log('\n🧹 Cleaning up previous live test data...');
  const existing = await prisma.raffle.findMany({
    where: { titulo: { contains: TAG } },
    select: { id: true },
  });

  if (existing.length > 0) {
    const ids = existing.map((r) => r.id);
    await prisma.dispute.deleteMany({ where: { raffleId: { in: ids } } });
    await prisma.drawResult.deleteMany({ where: { raffleId: { in: ids } } });
    await prisma.payout.deleteMany({ where: { raffleId: { in: ids } } });
    await prisma.ticket.deleteMany({ where: { raffleId: { in: ids } } });
    await prisma.conversation.deleteMany({ where: { raffleId: { in: ids } } });
    await prisma.product.deleteMany({ where: { raffleId: { in: ids } } });
    await prisma.raffle.deleteMany({ where: { id: { in: ids } } });
    console.log(`✅ Cleaned ${existing.length} previous raffles`);
  }

  // 3. Draw deadline: ~15 minutes from now
  const drawDate = new Date(Date.now() + 15 * 60 * 1000);
  console.log(`\n⏰ Draw deadline: ${drawDate.toISOString()}`);
  console.log(`   (local: ${drawDate.toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })})\n`);

  // 4. Create raffles
  const users = { user1, user2 };

  for (let i = 0; i < RAFFLES.length; i++) {
    const r = RAFFLES[i];
    const seller = users[r.sellerKey];
    const buyer = r.sellerKey === 'user1' ? user2 : user1;

    const raffle = await prisma.raffle.create({
      data: {
        titulo: r.titulo,
        descripcion: r.desc,
        sellerId: seller.id,
        totalTickets: r.totalTickets,
        precioPorTicket: new Decimal(r.precio),
        fechaLimiteSorteo: drawDate,
        estado: RaffleStatus.ACTIVA,
        deliveryStatus: DeliveryStatus.PENDING,
        product: {
          create: {
            nombre: r.productName,
            descripcionDetallada: r.desc,
            condicion: ProductCondition.NUEVO,
            imagenes: [r.image],
          },
        },
      },
    });

    // Create paid tickets from the buyer
    for (let t = 1; t <= r.ticketsSold; t++) {
      await prisma.ticket.create({
        data: {
          raffleId: raffle.id,
          numeroTicket: t,
          buyerId: buyer.id,
          precioPagado: new Decimal(r.precio),
          mpPaymentId: `live-test-pay-${raffle.id}-${t}`,
          mpExternalReference: `live-test-ref-${raffle.id}-${t}`,
          estado: TicketStatus.PAGADO,
        },
      });
    }

    const pct = Math.round((r.ticketsSold / r.totalTickets) * 100);
    console.log(
      `✅ #${i + 1} "${r.titulo}" — ${seller.nombre} vende, ${buyer.nombre} compra — ${r.ticketsSold}/${r.totalTickets} tickets (${pct}%) — $${r.precio}/ticket`,
    );
  }

  console.log('\n🎉 Done! 10 raffles created.');
  console.log('📌 All raffles are ACTIVA with ≥70% tickets sold.');
  console.log(`⏰ They will be drawn automatically at ~${drawDate.toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}`);
  console.log('🔔 Both users will receive winner/seller notifications (email + in-app).');
  console.log('💡 After draw, you can manually open disputes from the winner\'s account.\n');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
