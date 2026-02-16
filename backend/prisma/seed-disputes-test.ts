import {
  PrismaClient,
  KycStatus,
  RaffleStatus,
  DeliveryStatus,
  ProductCondition,
  TicketStatus,
  DisputeType,
  DisputeStatus,
  UserRole,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// ── Constants ──────────────────────────────────────────────────────────

const ARGENTINA_OFFSET_HOURS = -3; // UTC-3, no DST

const TEST_EMAILS = {
  seller1: 'nombretestdepruebaaver@gmail.com',
  seller2: 'nombretestdepruebaaver2@gmail.com',
  admin: 'danielitodevita@gmail.com',
};

const BUYER_ACCOUNTS = [
  { email: 'comprador-test-1@test.com', name: 'Comprador Test 1' },
  { email: 'comprador-test-2@test.com', name: 'Comprador Test 2' },
  { email: 'comprador-test-3@test.com', name: 'Comprador Test 3' },
];

const PRODUCT_IMAGES = {
  iphone: 'https://picsum.photos/seed/iphone15/800/600',
  macbook: 'https://picsum.photos/seed/macbook/800/600',
  ps5: 'https://picsum.photos/seed/ps5/800/600',
  samsung: 'https://picsum.photos/seed/samsung/800/600',
  switch: 'https://picsum.photos/seed/switch/800/600',
  dyson: 'https://picsum.photos/seed/dyson/800/600',
  bose: 'https://picsum.photos/seed/bose/800/600',
  dji: 'https://picsum.photos/seed/dji/800/600',
  garmin: 'https://picsum.photos/seed/garmin/800/600',
  jbl: 'https://picsum.photos/seed/jbl/800/600',
  tv: 'https://picsum.photos/seed/tv/800/600',
  camera: 'https://picsum.photos/seed/camera/800/600',
  keyboard: 'https://picsum.photos/seed/keyboard/800/600',
};

// ── Helpers ────────────────────────────────────────────────────────────

function createArgentinaDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number = 0,
): Date {
  // Argentina is UTC-3. To create 10:00 AM Argentina time, create 13:00 UTC
  const utcDate = new Date(
    Date.UTC(year, month - 1, day, hour + Math.abs(ARGENTINA_OFFSET_HOURS), minute, 0, 0),
  );
  return utcDate;
}

function addHours(date: Date, hours: number): Date {
  const result = new Date(date);
  result.setHours(result.getHours() + hours);
  return result;
}

// ── Verification ──────────────────────────────────────────────────────

async function verifyAndSetupUsers() {
  console.log('📋 Verifying test users...');

  const seller1 = await prisma.user.findUnique({
    where: { email: TEST_EMAILS.seller1 },
  });
  if (!seller1) {
    throw new Error(
      `❌ Seller 1 not found: ${TEST_EMAILS.seller1}. Create user first.`,
    );
  }
  if (seller1.kycStatus !== KycStatus.VERIFIED) {
    throw new Error(
      `❌ Seller 1 must have KYC verified. Current status: ${seller1.kycStatus}`,
    );
  }
  console.log(`✅ Seller 1 verified: ${TEST_EMAILS.seller1}`);

  const seller2 = await prisma.user.findUnique({
    where: { email: TEST_EMAILS.seller2 },
  });
  if (!seller2) {
    throw new Error(
      `❌ Seller 2 not found: ${TEST_EMAILS.seller2}. Create user first.`,
    );
  }
  if (seller2.kycStatus !== KycStatus.VERIFIED) {
    throw new Error(
      `❌ Seller 2 must have KYC verified. Current status: ${seller2.kycStatus}`,
    );
  }
  console.log(`✅ Seller 2 verified: ${TEST_EMAILS.seller2}`);

  const admin = await prisma.user.findUnique({
    where: { email: TEST_EMAILS.admin },
  });
  if (!admin) {
    throw new Error(
      `❌ Admin not found: ${TEST_EMAILS.admin}. Create user first.`,
    );
  }
  if (admin.role !== UserRole.ADMIN) {
    throw new Error(`❌ Admin role required. Current role: ${admin.role}`);
  }
  console.log(`✅ Admin verified: ${TEST_EMAILS.admin}`);

  // Create or verify buyer accounts
  const passwordHash = await bcrypt.hash('Password123!', 10);
  const buyers = [];

  for (const buyerData of BUYER_ACCOUNTS) {
    const buyer = await prisma.user.upsert({
      where: { email: buyerData.email },
      update: {},
      create: {
        email: buyerData.email,
        passwordHash,
        nombre: buyerData.name,
        apellido: 'Test',
        role: UserRole.USER,
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    });
    buyers.push(buyer);
    console.log(`✅ Buyer account ready: ${buyerData.email}`);
  }

  return {
    seller1,
    seller2,
    admin,
    buyers,
  };
}

// ── Cleanup ────────────────────────────────────────────────────────────

async function cleanupTestData() {
  console.log('🧹 Cleaning up existing test data...');

  // Delete disputes first (foreign key dependency)
  const raffles = await prisma.raffle.findMany({
    where: { titulo: { contains: '[DISPUTE-TEST]' } },
    select: { id: true },
  });

  const raffleIds = raffles.map((r) => r.id);

  if (raffleIds.length > 0) {
    const deletedDisputes = await prisma.dispute.deleteMany({
      where: { raffleId: { in: raffleIds } },
    });
    console.log(`✅ Deleted ${deletedDisputes.count} test disputes`);

    // Delete draw results
    const deletedDrawResults = await prisma.drawResult.deleteMany({
      where: { raffleId: { in: raffleIds } },
    });
    console.log(`✅ Deleted ${deletedDrawResults.count} test draw results`);

    // Now delete raffles
    const deletedRaffles = await prisma.raffle.deleteMany({
      where: { titulo: { contains: '[DISPUTE-TEST]' } },
    });
    console.log(`✅ Deleted ${deletedRaffles.count} test raffles`);
  } else {
    console.log('✅ No existing test data to clean');
  }
}

// ── Raffle Creation ────────────────────────────────────────────────────

interface CreateTestRaffleParams {
  titulo: string;
  productName: string;
  productDescription: string;
  productImages: string[];
  sellerId: string;
  totalTickets: number;
  precioPorTicket: number;
  fechaLimiteSorteo: Date;
  ticketsSold: number;
  winnerBuyerId?: string;
  raffleStatus: RaffleStatus;
  deliveryStatus: DeliveryStatus;
  dispute?: {
    reporterId: string;
    tipo: DisputeType;
    titulo: string;
    descripcion: string;
    evidencias: string[];
    estado: DisputeStatus;
    respuestaVendedor?: string;
    evidenciasVendedor?: string[];
    resolucion?: string;
    adminNotes?: string;
    montoReembolsado?: number;
    montoPagadoVendedor?: number;
  };
}

async function createTestRaffleWithDispute(params: CreateTestRaffleParams) {
  // Get the buyer ID - if not specified, use a default one
  const buyerIdForTickets = params.winnerBuyerId || (await prisma.user.findFirst({
    where: { email: BUYER_ACCOUNTS[0].email },
  }))?.id!;

  // Create raffle + product (without winner first)
  let raffle = await prisma.raffle.create({
    data: {
      titulo: params.titulo,
      descripcion: params.productDescription,
      sellerId: params.sellerId,
      totalTickets: params.totalTickets,
      precioPorTicket: new Decimal(params.precioPorTicket),
      fechaLimiteSorteo: params.fechaLimiteSorteo,
      estado: params.raffleStatus,
      deliveryStatus: params.deliveryStatus,
      winnerId: null, // Set later after tickets are created
      fechaSorteoReal:
        ([RaffleStatus.SORTEADA, RaffleStatus.FINALIZADA, RaffleStatus.EN_ENTREGA] as RaffleStatus[]).includes(params.raffleStatus)
          ? new Date(Date.now() - 2 * 60 * 60 * 1000)
          : null,
      product: {
        create: {
          nombre: params.productName,
          descripcionDetallada: params.productDescription,
          condicion: ProductCondition.NUEVO,
          imagenes: params.productImages,
        },
      },
    },
  });

  // Create tickets
  for (let i = 1; i <= params.ticketsSold; i++) {
    await prisma.ticket.create({
      data: {
        raffleId: raffle.id,
        numeroTicket: i,
        buyerId: buyerIdForTickets,
        precioPagado: new Decimal(params.precioPorTicket),
        mpPaymentId: `test-payment-${raffle.id}-${i}`,
        mpExternalReference: `test-ref-${raffle.id}-${i}`,
        estado: TicketStatus.PAGADO,
      },
    });
  }

  // Update raffle with winner and create draw result if drawn/finished
  if (
    ([RaffleStatus.SORTEADA, RaffleStatus.FINALIZADA, RaffleStatus.EN_ENTREGA] as RaffleStatus[]).includes(params.raffleStatus) &&
    params.winnerBuyerId
  ) {
    const winningTicket = await prisma.ticket.findFirst({
      where: { raffleId: raffle.id },
    });

    // Update raffle with winner
    raffle = await prisma.raffle.update({
      where: { id: raffle.id },
      data: { winnerId: params.winnerBuyerId },
    });

    await prisma.drawResult.create({
      data: {
        raffleId: raffle.id,
        winningTicketId: winningTicket!.id,
        winnerId: params.winnerBuyerId,
        method: 'RANDOM_INDEX',
        totalParticipants: params.ticketsSold,
      },
    });
  }

  // Create dispute if provided
  if (params.dispute) {
    await prisma.dispute.create({
      data: {
        raffleId: raffle.id,
        reporterId: params.dispute.reporterId,
        tipo: params.dispute.tipo,
        titulo: params.dispute.titulo,
        descripcion: params.dispute.descripcion,
        evidencias: params.dispute.evidencias,
        evidenciasVendedor: params.dispute.evidenciasVendedor || [],
        estado: params.dispute.estado,
        respuestaVendedor: params.dispute.respuestaVendedor,
        resolucion: params.dispute.resolucion,
        adminNotes: params.dispute.adminNotes,
        montoReembolsado: params.dispute.montoReembolsado
          ? new Decimal(params.dispute.montoReembolsado)
          : null,
        montoPagadoVendedor: params.dispute.montoPagadoVendedor
          ? new Decimal(params.dispute.montoPagadoVendedor)
          : null,
        fechaRespuestaVendedor: params.dispute.respuestaVendedor
          ? new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
          : null,
        resolvedAt: params.dispute.resolucion
          ? new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
          : null,
      },
    });
  }

  return raffle;
}

// ── Main ───────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🌱 Starting dispute test seed...\n');

  try {
    // Step 1: Verify users
    console.log('Step 1: Verifying test users...');
    const users = await verifyAndSetupUsers();
    console.log('✅ Users verified\n');

    // Step 2: Cleanup
    console.log('Step 2: Cleaning up old test data...');
    await cleanupTestData();
    console.log('✅ Cleanup complete\n');

    // Step 3: Create test raffles
    console.log('Step 3: Creating test raffles with disputes...\n');

    // Scenario 1: Expired & Drawn (10:00 AM today) - OPEN DISPUTE
    const raffle1 = await createTestRaffleWithDispute({
      titulo: '[DISPUTE-TEST] iPhone 15 Pro Max - Ganada (10AM)',
      productName: 'iPhone 15 Pro Max 256GB Azul Titanio',
      productDescription:
        'Nuevo en caja sellada. Garantía oficial Apple Argentina 1 año.',
      productImages: [PRODUCT_IMAGES.iphone],
      sellerId: users.seller1.id,
      totalTickets: 100,
      precioPorTicket: 1500,
      fechaLimiteSorteo: createArgentinaDate(2026, 2, 16, 10, 0),
      ticketsSold: 85,
      winnerBuyerId: users.buyers[0].id,
      raffleStatus: RaffleStatus.SORTEADA,
      deliveryStatus: DeliveryStatus.DISPUTED,
      dispute: {
        reporterId: users.buyers[0].id,
        tipo: DisputeType.NO_LLEGO,
        titulo: 'No recibí el iPhone después de 10 días',
        descripcion:
          'El vendedor marcó como "enviado" hace 10 días pero nunca llegó. No responde mis mensajes y no me dio número de seguimiento.',
        evidencias: [PRODUCT_IMAGES.iphone],
        estado: DisputeStatus.ABIERTA,
      },
    });
    console.log(`✅ Raffle 1 (SORTEADA, ABIERTA): ${raffle1.id}`);

    // Scenario 2: Active, will be drawn in 1h (80% sold)
    const raffle2 = await createTestRaffleWithDispute({
      titulo: '[DISPUTE-TEST] MacBook Air M3 - Será Sorteada (1h)',
      productName: 'MacBook Air M3 15" 16GB 512GB',
      productDescription: 'Nueva en caja sellada, color Gris Espacial.',
      productImages: [PRODUCT_IMAGES.macbook],
      sellerId: users.seller2.id,
      totalTickets: 150,
      precioPorTicket: 2000,
      fechaLimiteSorteo: addHours(new Date(), 1),
      ticketsSold: 120,
      winnerBuyerId: undefined,
      raffleStatus: RaffleStatus.ACTIVA,
      deliveryStatus: DeliveryStatus.PENDING,
    });
    console.log(`✅ Raffle 2 (ACTIVA, será sorteada): ${raffle2.id}`);

    // Scenario 3: Active, will be cancelled in 1h (30% sold)
    const raffle3 = await createTestRaffleWithDispute({
      titulo: '[DISPUTE-TEST] PlayStation 5 - Será Cancelada (1h)',
      productName: 'PlayStation 5 Edición Estándar',
      productDescription: 'Nueva sellada, incluye 1 joystick DualSense.',
      productImages: [PRODUCT_IMAGES.ps5],
      sellerId: users.seller1.id,
      totalTickets: 200,
      precioPorTicket: 800,
      fechaLimiteSorteo: addHours(new Date(), 1),
      ticketsSold: 60,
      winnerBuyerId: undefined,
      raffleStatus: RaffleStatus.ACTIVA,
      deliveryStatus: DeliveryStatus.PENDING,
    });
    console.log(`✅ Raffle 3 (ACTIVA, será cancelada): ${raffle3.id}`);

    // Scenario 4: Drawn with seller response, will be drawn in 3h (83% sold)
    const raffle4 = await createTestRaffleWithDispute({
      titulo: '[DISPUTE-TEST] Samsung Galaxy S24 Ultra - En Mediación (3h)',
      productName: 'Samsung Galaxy S24 Ultra 512GB Negro Titanio',
      productDescription: 'Nuevo en caja sellada, garantía Samsung oficial.',
      productImages: [PRODUCT_IMAGES.samsung],
      sellerId: users.seller2.id,
      totalTickets: 120,
      precioPorTicket: 1800,
      fechaLimiteSorteo: addHours(new Date(), 3),
      ticketsSold: 100,
      winnerBuyerId: users.buyers[1].id,
      raffleStatus: RaffleStatus.SORTEADA,
      deliveryStatus: DeliveryStatus.DISPUTED,
      dispute: {
        reporterId: users.buyers[1].id,
        tipo: DisputeType.DANADO,
        titulo: 'Producto llegó con la pantalla rota',
        descripcion:
          'El celular llegó con la pantalla completamente destruida. Claramente mal embalado.',
        evidencias: [PRODUCT_IMAGES.samsung],
        estado: DisputeStatus.EN_MEDIACION,
        respuestaVendedor:
          'Envié el producto perfectamente embalado con triple protección de burbujas. Adjunto fotos del empaque.',
        evidenciasVendedor: [PRODUCT_IMAGES.samsung],
      },
    });
    console.log(`✅ Raffle 4 (SORTEADA, EN_MEDIACION): ${raffle4.id}`);

    // Scenario 5: Resolved dispute (5 days ago) - BUYER WON
    const raffle5 = await createTestRaffleWithDispute({
      titulo: '[DISPUTE-TEST] Nintendo Switch OLED - Resuelta',
      productName: 'Nintendo Switch OLED Blanca',
      productDescription: 'Nueva en caja sellada, versión OLED.',
      productImages: [PRODUCT_IMAGES.switch],
      sellerId: users.seller1.id,
      totalTickets: 80,
      precioPorTicket: 1200,
      fechaLimiteSorteo: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      ticketsSold: 70,
      winnerBuyerId: users.buyers[0].id,
      raffleStatus: RaffleStatus.FINALIZADA,
      deliveryStatus: DeliveryStatus.DISPUTED,
      dispute: {
        reporterId: users.buyers[0].id,
        tipo: DisputeType.NO_LLEGO,
        titulo: 'Producto nunca llegó',
        descripcion:
          'Han pasado 20 días, el vendedor no proporcionó tracking válido.',
        evidencias: [PRODUCT_IMAGES.switch],
        estado: DisputeStatus.RESUELTA_COMPRADOR,
        respuestaVendedor:
          'Dice que lo envié pero no tengo comprobante de envío.',
        evidenciasVendedor: [],
        resolucion:
          'Se verificó que el vendedor no tiene prueba de envío. Reembolso total al comprador.',
        adminNotes:
          'Vendedor sin tracking válido, comprador tiene razón. Disputa resuelta a favor del comprador.',
        montoReembolsado: 1200,
      },
    });
    console.log(`✅ Raffle 5 (FINALIZADA, RESUELTA_COMPRADOR): ${raffle5.id}`);

    // ── Escenarios Adicionales de Mediación ──────────────────────────────────

    // Escenario 6: Disputa ABIERTA con evidencia clara de comprador (fácil resolver)
    const raffle6 = await createTestRaffleWithDispute({
      titulo: '[DISPUTE-TEST] AirPods Pro Max - Evidente Producto Incorrecto',
      productName: 'AirPods Pro Max Dorados',
      productDescription: 'Auriculares profesionales inalámbricos de Apple.',
      productImages: [PRODUCT_IMAGES.iphone],
      sellerId: users.seller2.id,
      totalTickets: 90,
      precioPorTicket: 1600,
      fechaLimiteSorteo: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      ticketsSold: 75,
      winnerBuyerId: users.buyers[0].id,
      raffleStatus: RaffleStatus.SORTEADA,
      deliveryStatus: DeliveryStatus.DISPUTED,
      dispute: {
        reporterId: users.buyers[0].id,
        tipo: DisputeType.DIFERENTE,
        titulo: 'Recibí AirPods falsificados, no originales',
        descripcion:
          'El producto que recibí es claramente una falsificación. El empaque está mal hecho, los auriculares pesan menos, no conectan correctamente. Adjunto fotos comparativas con producto original.',
        evidencias: [PRODUCT_IMAGES.samsung],
        estado: DisputeStatus.ABIERTA,
      },
    });
    console.log(`✅ Raffle 6 (SORTEADA, ABIERTA - Evidente): ${raffle6.id}`);

    // Escenario 7: Disputa con respuesta del vendedor DÉBIL (comprador probablemente gana)
    const raffle7 = await createTestRaffleWithDispute({
      titulo: '[DISPUTE-TEST] iPad Air - Respuesta Vendedor Débil',
      productName: 'iPad Air 11" 256GB Purple',
      productDescription: 'Tablet profesional de Apple última generación.',
      productImages: [PRODUCT_IMAGES.macbook],
      sellerId: users.seller1.id,
      totalTickets: 110,
      precioPorTicket: 2500,
      fechaLimiteSorteo: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      ticketsSold: 85,
      winnerBuyerId: users.buyers[1].id,
      raffleStatus: RaffleStatus.SORTEADA,
      deliveryStatus: DeliveryStatus.DISPUTED,
      dispute: {
        reporterId: users.buyers[1].id,
        tipo: DisputeType.DANADO,
        titulo: 'iPad llegó con pantalla dañada y no enciende',
        descripcion:
          'El dispositivo llegó en perfectas condiciones de empaque pero la pantalla tiene líneas coloridas y no responde. El botón de encendido está atascado. Claramente un defecto de manufactura.',
        evidencias: [PRODUCT_IMAGES.samsung],
        estado: DisputeStatus.EN_MEDIACION,
        respuestaVendedor:
          'Es probable que lo haya dañado en la instalación. Yo lo envié perfecto.',
        evidenciasVendedor: [],
      },
    });
    console.log(`✅ Raffle 7 (SORTEADA, EN_MEDIACION - Respuesta Débil): ${raffle7.id}`);

    // Escenario 8: Disputa con respuesta del vendedor FUERTE (podría ganar vendedor)
    const raffle8 = await createTestRaffleWithDispute({
      titulo: '[DISPUTE-TEST] Apple Watch Ultra - Respuesta Vendedor Fuerte',
      productName: 'Apple Watch Ultra Titanio',
      productDescription: 'Reloj inteligente deportivo de Apple.',
      productImages: [PRODUCT_IMAGES.iphone],
      sellerId: users.seller2.id,
      totalTickets: 80,
      precioPorTicket: 1400,
      fechaLimiteSorteo: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      ticketsSold: 65,
      winnerBuyerId: users.buyers[0].id,
      raffleStatus: RaffleStatus.SORTEADA,
      deliveryStatus: DeliveryStatus.DISPUTED,
      dispute: {
        reporterId: users.buyers[0].id,
        tipo: DisputeType.NO_LLEGO,
        titulo: 'Según el tracking está entregado pero nunca llegó',
        descripcion:
          'El tracking marca como "Entregado" hace 5 días pero nunca recibí el paquete. No hay nadie más en mi casa.',
        evidencias: [PRODUCT_IMAGES.switch],
        estado: DisputeStatus.EN_MEDIACION,
        respuestaVendedor:
          'Envié el paquete con tracking certificado. El transportista confirma entrega en domicilio. Adjunto comprobante de envío y confirmación del transporte. No es responsabilidad del vendedor si el comprador no estaba disponible.',
        evidenciasVendedor: [PRODUCT_IMAGES.iphone, PRODUCT_IMAGES.macbook],
      },
    });
    console.log(
      `✅ Raffle 8 (SORTEADA, EN_MEDIACION - Respuesta Fuerte): ${raffle8.id}`,
    );

    // Escenario 9: Disputa resuelta a favor del VENDEDOR
    const raffle9 = await createTestRaffleWithDispute({
      titulo: '[DISPUTE-TEST] Kindle Paperwhite - Resuelta Vendedor',
      productName: 'Kindle Paperwhite 11ª Generación',
      productDescription: 'E-reader de Amazon con pantalla mejorada.',
      productImages: [PRODUCT_IMAGES.ps5],
      sellerId: users.seller1.id,
      totalTickets: 70,
      precioPorTicket: 900,
      fechaLimiteSorteo: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      ticketsSold: 60,
      winnerBuyerId: users.buyers[1].id,
      raffleStatus: RaffleStatus.FINALIZADA,
      deliveryStatus: DeliveryStatus.CONFIRMED,
      dispute: {
        reporterId: users.buyers[1].id,
        tipo: DisputeType.DANADO,
        titulo: 'Pantalla con píxeles muertos',
        descripcion:
          'El Kindle tiene algunos píxeles muertos en la pantalla. Es defectuoso.',
        evidencias: [PRODUCT_IMAGES.switch],
        estado: DisputeStatus.RESUELTA_VENDEDOR,
        respuestaVendedor:
          'Los píxeles muertos ocasionales son normales en e-readers. He vendido cientos de unidades sin problemas. El dispositivo funciona perfectamente.',
        evidenciasVendedor: [PRODUCT_IMAGES.ps5],
        resolucion:
          'Se verificó que los píxeles muertos alegados son dentro de los límites aceptables de manufactura. Vendedor tiene razón.',
        adminNotes:
          'Comprador intentaba devolver un producto funcionante por defectos cosméticos menores. Caso rechazado.',
        montoPagadoVendedor: 900,
      },
    });
    console.log(`✅ Raffle 9 (FINALIZADA, RESUELTA_VENDEDOR): ${raffle9.id}`);

    // Escenario 10: Disputa resuelta PARCIALMENTE
    const raffle10 = await createTestRaffleWithDispute({
      titulo: '[DISPUTE-TEST] Sony WH-1000XM5 - Resuelta Parcial',
      productName: 'Sony WH-1000XM5 Auriculares',
      productDescription: 'Auriculares de cancelación de ruido premium.',
      productImages: [PRODUCT_IMAGES.samsung],
      sellerId: users.seller2.id,
      totalTickets: 85,
      precioPorTicket: 1100,
      fechaLimiteSorteo: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      ticketsSold: 72,
      winnerBuyerId: users.buyers[0].id,
      raffleStatus: RaffleStatus.FINALIZADA,
      deliveryStatus: DeliveryStatus.DISPUTED,
      dispute: {
        reporterId: users.buyers[0].id,
        tipo: DisputeType.DANADO,
        titulo: 'Un auricular no funciona completamente',
        descripcion:
          'El auricular derecho tiene volumen muy bajo y cortes intermitentes. El izquierdo funciona perfecto. Falla clara de manufactura.',
        evidencias: [PRODUCT_IMAGES.iphone],
        estado: DisputeStatus.RESUELTA_PARCIAL,
        respuestaVendedor:
          'Posiblemente hubo un problema durante el envío. Habría aceptado devolución si lo reportaban antes.',
        evidenciasVendedor: [],
        resolucion:
          'Se confirma defecto en uno de los auriculares. Se acuerda reembolso del 50% ya que la unidad parcialmente funciona.',
        adminNotes:
          'Vendedor podría haber facilitado cambio. Ambos culpables parcialmente. Arreglo justo: 50% reembolso.',
        montoReembolsado: 550,
        montoPagadoVendedor: 550,
      },
    });
    console.log(`✅ Raffle 10 (FINALIZADA, RESUELTA_PARCIAL): ${raffle10.id}`);

    // Escenario 11: Disputa MUY ANTIGUA sin resolver (testear auto-resolución de 15 días)
    const raffle11 = await createTestRaffleWithDispute({
      titulo: '[DISPUTE-TEST] GoPro Hero 11 - Antigua Sin Resolver',
      productName: 'GoPro Hero 11 Black',
      productDescription: 'Cámara de acción 4K profesional.',
      productImages: [PRODUCT_IMAGES.ps5],
      sellerId: users.seller1.id,
      totalTickets: 95,
      precioPorTicket: 1300,
      fechaLimiteSorteo: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 días atrás
      ticketsSold: 80,
      winnerBuyerId: users.buyers[1].id,
      raffleStatus: RaffleStatus.SORTEADA,
      deliveryStatus: DeliveryStatus.DISPUTED,
      dispute: {
        reporterId: users.buyers[1].id,
        tipo: DisputeType.NO_LLEGO,
        titulo: 'Paquete perdido sin respuesta de vendedor',
        descripcion:
          'Pasaron 20 días desde que abrí la disputa. El vendedor nunca respondió. El paquete se perdió en tránsito.',
        evidencias: [PRODUCT_IMAGES.macbook],
        estado: DisputeStatus.EN_MEDIACION,
        // Vendedor nunca respondió, pasaron más de 15 días
      },
    });
    console.log(
      `✅ Raffle 11 (SORTEADA, EN_MEDIACION - Antigua): ${raffle11.id}`,
    );

    // Escenario 12: Disputa en estado ABIERTA pero en transición (casi 48h sin respuesta)
    const raffle12 = await createTestRaffleWithDispute({
      titulo: '[DISPUTE-TEST] Oculus Quest 3 - Casi Escalar',
      productName: 'Meta Quest 3 512GB',
      productDescription: 'Headset de realidad virtual de Meta.',
      productImages: [PRODUCT_IMAGES.switch],
      sellerId: users.seller2.id,
      totalTickets: 100,
      precioPorTicket: 1700,
      fechaLimiteSorteo: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 - 1 * 60 * 60 * 1000), // 2 días y 1 hora atrás
      ticketsSold: 78,
      winnerBuyerId: users.buyers[0].id,
      raffleStatus: RaffleStatus.SORTEADA,
      deliveryStatus: DeliveryStatus.DISPUTED,
      dispute: {
        reporterId: users.buyers[0].id,
        tipo: DisputeType.VENDEDOR_NO_RESPONDE,
        titulo: 'Vendedor no responde mis mensajes',
        descripcion:
          'Abrí la disputa hace casi 48 horas porque el producto no llegó. El vendedor no ha respondido. Está incomunicado.',
        evidencias: [PRODUCT_IMAGES.samsung],
        estado: DisputeStatus.ABIERTA,
        // Sin respuesta del vendedor, está casi llegando a 48h para escalada
      },
    });
    console.log(`✅ Raffle 12 (SORTEADA, ABIERTA - Casi Escalar): ${raffle12.id}`);

    // ── 5 Nuevas Disputas ──────────────────────────────────────────────────

    // Escenario 13: Disputa tipo OTRO - caso ambiguo
    const raffle13 = await createTestRaffleWithDispute({
      titulo: '[DISPUTE-TEST] Dyson V15 - Disputa Tipo Otro',
      productName: 'Dyson V15 Detect Aspiradora',
      productDescription: 'Aspiradora inalámbrica con láser detector de polvo.',
      productImages: [PRODUCT_IMAGES.dyson],
      sellerId: users.seller1.id,
      totalTickets: 90,
      precioPorTicket: 2200,
      fechaLimiteSorteo: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
      ticketsSold: 78,
      winnerBuyerId: users.buyers[0].id,
      raffleStatus: RaffleStatus.SORTEADA,
      deliveryStatus: DeliveryStatus.DISPUTED,
      dispute: {
        reporterId: users.buyers[0].id,
        tipo: DisputeType.OTRO,
        titulo: 'Producto recibido sin accesorios prometidos',
        descripcion:
          'La aspiradora llegó pero falta el cabezal láser y 3 de los 5 accesorios que se mostraban en las fotos de la rifa. El vendedor dice que esos accesorios se venden por separado pero las fotos mostraban todo incluido.',
        evidencias: [PRODUCT_IMAGES.dyson],
        estado: DisputeStatus.ESPERANDO_RESPUESTA_VENDEDOR,
      },
    });
    console.log(`✅ Raffle 13 (SORTEADA, ESPERANDO_RESPUESTA): ${raffle13.id}`);

    // Escenario 14: Disputa DIFERENTE con fotos claras - producto usado vendido como nuevo
    const raffle14 = await createTestRaffleWithDispute({
      titulo: '[DISPUTE-TEST] Bose QC Ultra - Vendido Usado Como Nuevo',
      productName: 'Bose QuietComfort Ultra Headphones',
      productDescription: 'Auriculares premium noise cancelling, NUEVO en caja.',
      productImages: [PRODUCT_IMAGES.bose],
      sellerId: users.seller2.id,
      totalTickets: 75,
      precioPorTicket: 1300,
      fechaLimiteSorteo: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      ticketsSold: 68,
      winnerBuyerId: users.buyers[1].id,
      raffleStatus: RaffleStatus.SORTEADA,
      deliveryStatus: DeliveryStatus.DISPUTED,
      dispute: {
        reporterId: users.buyers[1].id,
        tipo: DisputeType.DIFERENTE,
        titulo: 'Producto usado vendido como nuevo - caja abierta y rayones',
        descripcion:
          'La rifa decía "NUEVO en caja sellada" pero el producto llegó con la caja abierta, los auriculares tienen rayones visibles en las bisagras, y las almohadillas tienen marcas de uso. Claramente son usados.',
        evidencias: [PRODUCT_IMAGES.bose, PRODUCT_IMAGES.samsung],
        estado: DisputeStatus.ABIERTA,
      },
    });
    console.log(`✅ Raffle 14 (SORTEADA, ABIERTA - Usado como nuevo): ${raffle14.id}`);

    // Escenario 15: Disputa EN_MEDIACION - ambas partes tienen algo de razón
    const raffle15 = await createTestRaffleWithDispute({
      titulo: '[DISPUTE-TEST] DJI Mini 4 Pro - Caso Complejo',
      productName: 'DJI Mini 4 Pro Fly More Combo',
      productDescription: 'Drone profesional con 3 baterías y accesorios.',
      productImages: [PRODUCT_IMAGES.dji],
      sellerId: users.seller1.id,
      totalTickets: 130,
      precioPorTicket: 2800,
      fechaLimiteSorteo: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      ticketsSold: 110,
      winnerBuyerId: users.buyers[2].id,
      raffleStatus: RaffleStatus.SORTEADA,
      deliveryStatus: DeliveryStatus.DISPUTED,
      dispute: {
        reporterId: users.buyers[2].id,
        tipo: DisputeType.DANADO,
        titulo: 'Drone funciona pero 2 de 3 baterías no cargan',
        descripcion:
          'El drone en sí funciona perfecto. Sin embargo, de las 3 baterías del combo Fly More, solo 1 carga correctamente. Las otras 2 no toman carga. Esto reduce significativamente el valor del producto.',
        evidencias: [PRODUCT_IMAGES.dji, PRODUCT_IMAGES.macbook],
        estado: DisputeStatus.EN_MEDIACION,
        respuestaVendedor:
          'Probé las 3 baterías antes de enviar y todas funcionaban. Es posible que se hayan dañado en el transporte. Puedo enviar un video de las baterías funcionando grabado el día del envío. Ofrezco reemplazar las 2 baterías defectuosas.',
        evidenciasVendedor: [PRODUCT_IMAGES.dji],
      },
    });
    console.log(`✅ Raffle 15 (SORTEADA, EN_MEDIACION - Caso complejo): ${raffle15.id}`);

    // Escenario 16: Disputa NO_LLEGO con tracking que muestra entregado en dirección incorrecta
    const raffle16 = await createTestRaffleWithDispute({
      titulo: '[DISPUTE-TEST] Garmin Fenix 7X - Dirección Incorrecta',
      productName: 'Garmin Fenix 7X Solar Sapphire',
      productDescription: 'Reloj GPS multideporte premium con carga solar.',
      productImages: [PRODUCT_IMAGES.garmin],
      sellerId: users.seller2.id,
      totalTickets: 60,
      precioPorTicket: 3500,
      fechaLimiteSorteo: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      ticketsSold: 55,
      winnerBuyerId: users.buyers[0].id,
      raffleStatus: RaffleStatus.SORTEADA,
      deliveryStatus: DeliveryStatus.DISPUTED,
      dispute: {
        reporterId: users.buyers[0].id,
        tipo: DisputeType.NO_LLEGO,
        titulo: 'Paquete entregado en dirección equivocada',
        descripcion:
          'El tracking muestra "Entregado" pero en una dirección completamente diferente a la mía. Parece que el vendedor puso mal el código postal. Contacté al correo y confirman que fue entregado en otra localidad.',
        evidencias: [PRODUCT_IMAGES.garmin],
        estado: DisputeStatus.EN_MEDIACION,
        respuestaVendedor:
          'Copié la dirección exacta que figuraba en el sistema. Si hubo un error en la dirección registrada, no es mi responsabilidad. Puedo mostrar captura de la etiqueta de envío con la dirección del sistema.',
        evidenciasVendedor: [PRODUCT_IMAGES.garmin, PRODUCT_IMAGES.iphone],
      },
    });
    console.log(`✅ Raffle 16 (SORTEADA, EN_MEDIACION - Dirección incorrecta): ${raffle16.id}`);

    // Escenario 17: Disputa VENDEDOR_NO_RESPONDE - escalada automática ya aplicada
    const raffle17 = await createTestRaffleWithDispute({
      titulo: '[DISPUTE-TEST] JBL PartyBox 710 - Vendedor Fantasma',
      productName: 'JBL PartyBox 710 Parlante',
      productDescription: 'Parlante de fiesta 800W con luces LED.',
      productImages: [PRODUCT_IMAGES.jbl],
      sellerId: users.seller1.id,
      totalTickets: 140,
      precioPorTicket: 950,
      fechaLimiteSorteo: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
      ticketsSold: 115,
      winnerBuyerId: users.buyers[2].id,
      raffleStatus: RaffleStatus.SORTEADA,
      deliveryStatus: DeliveryStatus.DISPUTED,
      dispute: {
        reporterId: users.buyers[2].id,
        tipo: DisputeType.VENDEDOR_NO_RESPONDE,
        titulo: 'Vendedor desaparecido - 12 días sin respuesta',
        descripcion:
          'Gané la rifa hace 12 días. El vendedor nunca me contactó, nunca envió el producto, no responde mensajes. Su perfil sigue activo pero me ignora completamente.',
        evidencias: [PRODUCT_IMAGES.jbl],
        estado: DisputeStatus.EN_MEDIACION,
        adminNotes: 'Escalada automáticamente por falta de respuesta después de 48h. Vendedor notificado 3 veces sin éxito.',
      },
    });
    console.log(`✅ Raffle 17 (SORTEADA, EN_MEDIACION - Vendedor fantasma): ${raffle17.id}`);

    // ── Rifas Ganadas/Terminadas SIN Disputa (para testing manual) ──────────

    console.log('\n📦 Creando rifas ganadas sin disputas (para testing manual)...\n');

    // Rifa ganada reciente - entrega pendiente (el ganador puede abrir disputa)
    const raffleWon1 = await createTestRaffleWithDispute({
      titulo: '[DISPUTE-TEST] Smart TV Samsung 65" - Ganada Sin Disputa',
      productName: 'Samsung Smart TV 65" 4K Neo QLED',
      productDescription: 'Televisor 65 pulgadas 4K con HDR10+ y Gaming Hub.',
      productImages: [PRODUCT_IMAGES.tv],
      sellerId: users.seller1.id,
      totalTickets: 200,
      precioPorTicket: 500,
      fechaLimiteSorteo: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      ticketsSold: 170,
      winnerBuyerId: users.buyers[0].id,
      raffleStatus: RaffleStatus.SORTEADA,
      deliveryStatus: DeliveryStatus.PENDING,
    });
    console.log(`✅ Rifa Ganada 1 (SORTEADA, PENDING - para abrir disputa): ${raffleWon1.id}`);

    // Rifa ganada - ya enviada (el ganador puede reclamar daño o que no llegó)
    const raffleWon2 = await createTestRaffleWithDispute({
      titulo: '[DISPUTE-TEST] Canon EOS R6 II - Enviada Sin Disputa',
      productName: 'Canon EOS R6 Mark II Body',
      productDescription: 'Cámara mirrorless full frame profesional.',
      productImages: [PRODUCT_IMAGES.camera],
      sellerId: users.seller2.id,
      totalTickets: 100,
      precioPorTicket: 3000,
      fechaLimiteSorteo: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      ticketsSold: 88,
      winnerBuyerId: users.buyers[1].id,
      raffleStatus: RaffleStatus.SORTEADA,
      deliveryStatus: DeliveryStatus.SHIPPED,
    });
    console.log(`✅ Rifa Ganada 2 (SORTEADA, SHIPPED - para reclamar): ${raffleWon2.id}`);

    // Rifa ganada - ya entregada (el ganador puede confirmar o disputar)
    const raffleWon3 = await createTestRaffleWithDispute({
      titulo: '[DISPUTE-TEST] Keychron Q1 Pro - Entregada Sin Disputa',
      productName: 'Keychron Q1 Pro QMK Mechanical Keyboard',
      productDescription: 'Teclado mecánico inalámbrico 75% con knob y hot-swap.',
      productImages: [PRODUCT_IMAGES.keyboard],
      sellerId: users.seller1.id,
      totalTickets: 50,
      precioPorTicket: 800,
      fechaLimiteSorteo: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      ticketsSold: 45,
      winnerBuyerId: users.buyers[2].id,
      raffleStatus: RaffleStatus.SORTEADA,
      deliveryStatus: DeliveryStatus.DELIVERED,
    });
    console.log(`✅ Rifa Ganada 3 (SORTEADA, DELIVERED - para confirmar o disputar): ${raffleWon3.id}`);

    // Rifa finalizada exitosamente (caso de referencia)
    const raffleWon4 = await createTestRaffleWithDispute({
      titulo: '[DISPUTE-TEST] AirPods Pro 2 - Finalizada Exitosa',
      productName: 'Apple AirPods Pro 2da Gen USB-C',
      productDescription: 'Auriculares inalámbricos con cancelación de ruido adaptativa.',
      productImages: [PRODUCT_IMAGES.iphone],
      sellerId: users.seller2.id,
      totalTickets: 80,
      precioPorTicket: 600,
      fechaLimiteSorteo: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      ticketsSold: 72,
      winnerBuyerId: users.buyers[0].id,
      raffleStatus: RaffleStatus.FINALIZADA,
      deliveryStatus: DeliveryStatus.CONFIRMED,
    });
    console.log(`✅ Rifa Ganada 4 (FINALIZADA, CONFIRMED - referencia exitosa): ${raffleWon4.id}`);

    // ── Rifas donde las cuentas REALES son ganadoras (para emails reales) ──────

    console.log('\n📧 Creando rifas donde cuentas reales son ganadoras (notificaciones reales)...\n');

    // seller1 gana rifa de seller2 - entrega pendiente (puede abrir disputa)
    const raffleReal1 = await createTestRaffleWithDispute({
      titulo: '[DISPUTE-TEST] Xbox Series X - Ganada por Seller1',
      productName: 'Xbox Series X 1TB',
      productDescription: 'Consola de última generación Microsoft, nueva sellada.',
      productImages: [PRODUCT_IMAGES.ps5],
      sellerId: users.seller2.id,
      totalTickets: 100,
      precioPorTicket: 700,
      fechaLimiteSorteo: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      ticketsSold: 85,
      winnerBuyerId: users.seller1.id, // seller1 es el GANADOR
      raffleStatus: RaffleStatus.SORTEADA,
      deliveryStatus: DeliveryStatus.PENDING,
    });
    console.log(`✅ Real 1 - ${TEST_EMAILS.seller1} ganó rifa de seller2 (PENDING): ${raffleReal1.id}`);

    // seller1 gana rifa de seller2 - ya enviada
    const raffleReal2 = await createTestRaffleWithDispute({
      titulo: '[DISPUTE-TEST] Monitor LG 4K - Ganada por Seller1 (Enviada)',
      productName: 'LG UltraFine 27" 4K IPS',
      productDescription: 'Monitor profesional 4K con USB-C y HDR400.',
      productImages: [PRODUCT_IMAGES.tv],
      sellerId: users.seller2.id,
      totalTickets: 80,
      precioPorTicket: 1200,
      fechaLimiteSorteo: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      ticketsSold: 72,
      winnerBuyerId: users.seller1.id,
      raffleStatus: RaffleStatus.SORTEADA,
      deliveryStatus: DeliveryStatus.SHIPPED,
    });
    console.log(`✅ Real 2 - ${TEST_EMAILS.seller1} ganó rifa de seller2 (SHIPPED): ${raffleReal2.id}`);

    // seller1 gana rifa de seller2 - con disputa ABIERTA (recibirá notificaciones de disputa)
    const raffleReal3 = await createTestRaffleWithDispute({
      titulo: '[DISPUTE-TEST] iPad Pro M4 - Disputa Seller1 como Comprador',
      productName: 'iPad Pro 13" M4 256GB',
      productDescription: 'Tablet profesional Apple con chip M4.',
      productImages: [PRODUCT_IMAGES.macbook],
      sellerId: users.seller2.id,
      totalTickets: 110,
      precioPorTicket: 2500,
      fechaLimiteSorteo: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      ticketsSold: 95,
      winnerBuyerId: users.seller1.id,
      raffleStatus: RaffleStatus.SORTEADA,
      deliveryStatus: DeliveryStatus.DISPUTED,
      dispute: {
        reporterId: users.seller1.id, // seller1 ABRE la disputa como comprador
        tipo: DisputeType.DANADO,
        titulo: 'iPad llegó con pantalla rajada',
        descripcion:
          'El iPad llegó con una rajadura visible en la pantalla. El embalaje estaba en perfecto estado así que no fue daño de transporte. Adjunto fotos.',
        evidencias: [PRODUCT_IMAGES.macbook],
        estado: DisputeStatus.ABIERTA,
      },
    });
    console.log(`✅ Real 3 - ${TEST_EMAILS.seller1} abrió disputa como comprador (ABIERTA): ${raffleReal3.id}`);

    // seller2 gana rifa de seller1 - entrega pendiente
    const raffleReal4 = await createTestRaffleWithDispute({
      titulo: '[DISPUTE-TEST] Dyson Airwrap - Ganada por Seller2',
      productName: 'Dyson Airwrap Complete Long',
      productDescription: 'Estilizador de cabello multifunción Dyson.',
      productImages: [PRODUCT_IMAGES.dyson],
      sellerId: users.seller1.id,
      totalTickets: 70,
      precioPorTicket: 1500,
      fechaLimiteSorteo: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      ticketsSold: 62,
      winnerBuyerId: users.seller2.id, // seller2 es el GANADOR
      raffleStatus: RaffleStatus.SORTEADA,
      deliveryStatus: DeliveryStatus.PENDING,
    });
    console.log(`✅ Real 4 - ${TEST_EMAILS.seller2} ganó rifa de seller1 (PENDING): ${raffleReal4.id}`);

    // seller2 gana rifa de seller1 - ya entregada
    const raffleReal5 = await createTestRaffleWithDispute({
      titulo: '[DISPUTE-TEST] Logitech MX Master 3S - Ganada por Seller2 (Entregada)',
      productName: 'Logitech MX Master 3S Mouse',
      productDescription: 'Mouse ergonómico premium inalámbrico.',
      productImages: [PRODUCT_IMAGES.keyboard],
      sellerId: users.seller1.id,
      totalTickets: 40,
      precioPorTicket: 500,
      fechaLimiteSorteo: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      ticketsSold: 38,
      winnerBuyerId: users.seller2.id,
      raffleStatus: RaffleStatus.SORTEADA,
      deliveryStatus: DeliveryStatus.DELIVERED,
    });
    console.log(`✅ Real 5 - ${TEST_EMAILS.seller2} ganó rifa de seller1 (DELIVERED): ${raffleReal5.id}`);

    // seller2 gana rifa de seller1 - con disputa EN_MEDIACION (recibirá notificaciones)
    const raffleReal6 = await createTestRaffleWithDispute({
      titulo: '[DISPUTE-TEST] Marshall Stanmore III - Disputa Seller2 como Comprador',
      productName: 'Marshall Stanmore III Parlante Bluetooth',
      productDescription: 'Parlante premium vintage con sonido excepcional.',
      productImages: [PRODUCT_IMAGES.jbl],
      sellerId: users.seller1.id,
      totalTickets: 60,
      precioPorTicket: 1800,
      fechaLimiteSorteo: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
      ticketsSold: 52,
      winnerBuyerId: users.seller2.id,
      raffleStatus: RaffleStatus.SORTEADA,
      deliveryStatus: DeliveryStatus.DISPUTED,
      dispute: {
        reporterId: users.seller2.id, // seller2 ABRE la disputa como comprador
        tipo: DisputeType.DIFERENTE,
        titulo: 'Recibí modelo anterior (Stanmore II en vez de III)',
        descripcion:
          'La rifa era por un Marshall Stanmore III pero recibí un Stanmore II. Se nota por el diseño del panel superior y la falta de Bluetooth 5.2. Adjunto comparación.',
        evidencias: [PRODUCT_IMAGES.jbl, PRODUCT_IMAGES.bose],
        estado: DisputeStatus.EN_MEDIACION,
        respuestaVendedor:
          'Es el Stanmore III, quizás el comprador no conoce las diferencias entre modelos. El número de serie confirma que es la versión más reciente.',
        evidenciasVendedor: [PRODUCT_IMAGES.jbl],
      },
    });
    console.log(`✅ Real 6 - ${TEST_EMAILS.seller2} abrió disputa como comprador (EN_MEDIACION): ${raffleReal6.id}`);

    console.log('\n✅ Dispute test seed completed successfully!\n');
    console.log('📊 Summary:');
    console.log(`  - 27 test raffles created`);
    console.log('  - 17 con disputas (compradores test)');
    console.log('  - 4 rifas ganadas sin disputa (compradores test)');
    console.log(`  - 6 rifas con cuentas REALES como ganadoras (emails reales)`);
    console.log('');
    console.log('  Cuentas reales como GANADORAS:');
    console.log(`    ${TEST_EMAILS.seller1}:`);
    console.log('      ✓ Xbox Series X (PENDING - puede abrir disputa)');
    console.log('      ✓ Monitor LG 4K (SHIPPED - puede reclamar)');
    console.log('      ✓ iPad Pro M4 (DISPUTED - disputa ABIERTA, recibirá emails)');
    console.log(`    ${TEST_EMAILS.seller2}:`);
    console.log('      ✓ Dyson Airwrap (PENDING - puede abrir disputa)');
    console.log('      ✓ Logitech MX Master (DELIVERED - puede confirmar o disputar)');
    console.log('      ✓ Marshall Stanmore III (DISPUTED - EN_MEDIACION, recibirá emails)\n');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
