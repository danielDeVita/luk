import {
  PrismaClient,
  KycStatus,
  MpConnectStatus,
  UserRole,
  RaffleStatus,
  DeliveryStatus,
  ProductCondition,
  TicketStatus,
  DisputeType,
  DisputeStatus,
  DocumentType,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/**
 * Seed database with test data for E2E tests.
 *
 * Creates:
 * - 6 users (buyer, seller, admin, unverified, pending-kyc, rejected-kyc)
 * - 4 raffles with products, tickets, draw results (for dispute testing)
 * - 4 disputes in different states (ABIERTA, ESPERANDO_RESPUESTA, EN_MEDIACION, RESUELTA)
 */
async function main() {
  console.log('🌱 Seeding database...');

  const passwordHash = await bcrypt.hash('Password123!', 10);

  // ── Users ──────────────────────────────────────────────────────────

  const buyer = await prisma.user.upsert({
    where: { email: 'comprador@test.com' },
    update: {},
    create: {
      email: 'comprador@test.com',
      passwordHash,
      nombre: 'Comprador',
      apellido: 'Test',
      role: UserRole.USER,
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });
  console.log(`✅ Created buyer: ${buyer.email}`);

  const seller = await prisma.user.upsert({
    where: { email: 'vendedor@test.com' },
    update: {},
    create: {
      email: 'vendedor@test.com',
      passwordHash,
      nombre: 'Vendedor',
      apellido: 'Test',
      role: UserRole.USER,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      kycStatus: KycStatus.VERIFIED,
      kycVerifiedAt: new Date(),
      mpConnectStatus: MpConnectStatus.CONNECTED,
    },
  });
  console.log(`✅ Created seller: ${seller.email}`);

  const adminPasswordHash = await bcrypt.hash('Admin123!', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@test.com' },
    update: {},
    create: {
      email: 'admin@test.com',
      passwordHash: adminPasswordHash,
      nombre: 'Admin',
      apellido: 'Test',
      role: UserRole.ADMIN,
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });
  console.log(`✅ Created admin: ${admin.email}`);

  // Unverified seller (KYC NOT_SUBMITTED)
  await prisma.user.upsert({
    where: { email: 'unverified@test.com' },
    update: {},
    create: {
      email: 'unverified@test.com',
      passwordHash,
      nombre: 'Unverified',
      apellido: 'Seller',
      role: UserRole.USER,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      kycStatus: KycStatus.NOT_SUBMITTED,
    },
  });
  console.log(`✅ Created unverified seller: unverified@test.com`);

  // Pending KYC user (submitted, awaiting admin review)
  await prisma.user.upsert({
    where: { email: 'pending-kyc@test.com' },
    update: {},
    create: {
      email: 'pending-kyc@test.com',
      passwordHash,
      nombre: 'Pending',
      apellido: 'KYC',
      role: UserRole.USER,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      kycStatus: KycStatus.PENDING_REVIEW,
      kycSubmittedAt: new Date(),
      documentType: DocumentType.DNI,
      documentNumber: '33445566',
    },
  });
  console.log(`✅ Created pending KYC user: pending-kyc@test.com`);

  // Rejected KYC user (admin rejected, can resubmit)
  await prisma.user.upsert({
    where: { email: 'rejected-kyc@test.com' },
    update: {},
    create: {
      email: 'rejected-kyc@test.com',
      passwordHash,
      nombre: 'Rejected',
      apellido: 'KYC',
      role: UserRole.USER,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      kycStatus: KycStatus.REJECTED,
      kycSubmittedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      kycRejectedReason:
        'Documento ilegible. Por favor, volvé a subir las fotos con mejor iluminación.',
    },
  });
  console.log(`✅ Created rejected KYC user: rejected-kyc@test.com`);

  // ── Raffles + Products + Tickets + Draws + Disputes ────────────────

  const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

  // Helper to create a raffle with its full chain
  async function createRaffleChain(params: {
    titulo: string;
    productName: string;
    raffleStatus: RaffleStatus;
    deliveryStatus: DeliveryStatus;
    disputeType: DisputeType;
    disputeStatus: DisputeStatus;
    disputeTitulo: string;
    disputeDescripcion: string;
    withSellerResponse?: boolean;
    withResolution?: boolean;
  }) {
    const raffle = await prisma.raffle.create({
      data: {
        titulo: params.titulo,
        descripcion: `Rifa de ${params.productName} para testing de disputas E2E`,
        sellerId: seller.id,
        totalTickets: 10,
        precioPorTicket: 500,
        fechaLimiteSorteo: pastDate,
        estado: params.raffleStatus,
        winnerId: buyer.id,
        fechaSorteoReal: pastDate,
        deliveryStatus: params.deliveryStatus,
      },
    });

    await prisma.product.create({
      data: {
        raffleId: raffle.id,
        nombre: params.productName,
        descripcionDetallada: `${params.productName} para testing. Producto nuevo en caja sellada.`,
        condicion: ProductCondition.NUEVO,
        imagenes: ['https://picsum.photos/600/400'],
      },
    });

    // Create 3 tickets purchased by buyer
    for (let i = 1; i <= 3; i++) {
      await prisma.ticket.create({
        data: {
          raffleId: raffle.id,
          numeroTicket: i,
          buyerId: buyer.id,
          precioPagado: 500,
          mpPaymentId: `test-payment-${raffle.id}-${i}`,
          estado: TicketStatus.PAGADO,
        },
      });
    }

    // Draw result
    const firstTicket = await prisma.ticket.findFirst({
      where: { raffleId: raffle.id },
    });
    await prisma.drawResult.create({
      data: {
        raffleId: raffle.id,
        winningTicketId: firstTicket!.id,
        winnerId: buyer.id,
        totalParticipants: 1,
      },
    });

    // Dispute
    const disputeData: Parameters<typeof prisma.dispute.create>[0]['data'] = {
      raffleId: raffle.id,
      reporterId: buyer.id,
      tipo: params.disputeType,
      titulo: params.disputeTitulo,
      descripcion: params.disputeDescripcion,
      evidencias: ['https://picsum.photos/400/300'],
      estado: params.disputeStatus,
    };

    if (params.withSellerResponse) {
      disputeData.respuestaVendedor =
        'El producto fue enviado correctamente por correo certificado. Adjunto foto del comprobante de envío.';
      disputeData.evidenciasVendedor = [
        'https://picsum.photos/400/300',
      ];
      disputeData.fechaRespuestaVendedor = new Date(
        Date.now() - 2 * 24 * 60 * 60 * 1000,
      );
    }

    if (params.withResolution) {
      disputeData.resolucion =
        'Se verificó que el producto no fue entregado. Se procede al reembolso completo.';
      disputeData.adminNotes =
        'Vendedor no proporcionó tracking válido. Comprador tiene razón.';
      disputeData.montoReembolsado = 1500;
      disputeData.resolvedAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
    }

    await prisma.dispute.create({ data: disputeData });

    return raffle;
  }

  // Check if disputes already exist (idempotent seeding)
  const existingDisputes = await prisma.dispute.count();
  if (existingDisputes === 0) {
    // Dispute 1: ABIERTA — buyer just opened, waiting for action
    await createRaffleChain({
      titulo: 'PlayStation 5 Digital Edition - Rifa Test',
      productName: 'PlayStation 5 Digital Edition',
      raffleStatus: RaffleStatus.SORTEADA,
      deliveryStatus: DeliveryStatus.DISPUTED,
      disputeType: DisputeType.NO_LLEGO,
      disputeStatus: DisputeStatus.ABIERTA,
      disputeTitulo: 'No recibí el producto',
      disputeDescripcion:
        'Han pasado 15 días desde el sorteo y todavía no recibí el PlayStation 5. El vendedor no responde mis mensajes y no proporcionó número de seguimiento.',
    });
    console.log(`✅ Created dispute: ABIERTA (PlayStation 5)`);

    // Dispute 2: ESPERANDO_RESPUESTA_VENDEDOR — seller needs to respond
    await createRaffleChain({
      titulo: 'MacBook Air M2 - Rifa Test',
      productName: 'MacBook Air M2',
      raffleStatus: RaffleStatus.SORTEADA,
      deliveryStatus: DeliveryStatus.DISPUTED,
      disputeType: DisputeType.DANADO,
      disputeStatus: DisputeStatus.ESPERANDO_RESPUESTA_VENDEDOR,
      disputeTitulo: 'Producto llegó dañado',
      disputeDescripcion:
        'La MacBook Air llegó con la pantalla rota y la caja completamente destruida. Parece que fue mal embalada para el envío. Adjunto fotos del estado del producto.',
    });
    console.log(
      `✅ Created dispute: ESPERANDO_RESPUESTA_VENDEDOR (MacBook Air)`,
    );

    // Dispute 3: EN_MEDIACION — seller responded, admin needs to decide
    await createRaffleChain({
      titulo: 'Auriculares Sony WH-1000XM5 - Rifa Test',
      productName: 'Auriculares Sony WH-1000XM5',
      raffleStatus: RaffleStatus.SORTEADA,
      deliveryStatus: DeliveryStatus.DISPUTED,
      disputeType: DisputeType.DIFERENTE,
      disputeStatus: DisputeStatus.EN_MEDIACION,
      disputeTitulo: 'Producto no coincide con la descripción',
      disputeDescripcion:
        'La rifa decía Sony WH-1000XM5 pero recibí un modelo XM3 que es mucho más viejo. La caja dice XM5 pero el producto adentro claramente es otro modelo.',
      withSellerResponse: true,
    });
    console.log(`✅ Created dispute: EN_MEDIACION (Auriculares Sony)`);

    // Dispute 4: RESUELTA_COMPRADOR — admin resolved in buyer's favor
    await createRaffleChain({
      titulo: 'Nintendo Switch OLED - Rifa Test',
      productName: 'Nintendo Switch OLED',
      raffleStatus: RaffleStatus.FINALIZADA,
      deliveryStatus: DeliveryStatus.DISPUTED,
      disputeType: DisputeType.NO_LLEGO,
      disputeStatus: DisputeStatus.RESUELTA_COMPRADOR,
      disputeTitulo: 'Nunca recibí la Nintendo Switch',
      disputeDescripcion:
        'El vendedor dice que envió el producto pero nunca llegó. No tiene número de seguimiento ni comprobante de envío válido.',
      withSellerResponse: true,
      withResolution: true,
    });
    console.log(
      `✅ Created dispute: RESUELTA_COMPRADOR (Nintendo Switch)`,
    );
  } else {
    console.log(`⏭️ Disputes already exist (${existingDisputes}), skipping...`);
  }

  // Suppress unused variable warnings
  void admin;

  console.log('🌱 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
