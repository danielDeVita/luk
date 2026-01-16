import { PrismaClient, UserRole, RaffleStatus, DeliveryStatus, ProductCondition, TicketStatus, KycStatus, DocumentType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // Clean database first
  console.log('Cleaning database...');
  await prisma.raffleAnswer.deleteMany();
  await prisma.raffleQuestion.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.report.deleteMany();
  await prisma.drawResult.deleteMany();
  await prisma.dispute.deleteMany();
  await prisma.payout.deleteMany();
  await prisma.priceReduction.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.product.deleteMany();
  await prisma.review.deleteMany();
  await prisma.raffle.deleteMany();
  await prisma.userReputation.deleteMany();
  await prisma.shippingAddress.deleteMany();
  await prisma.user.deleteMany();
  await prisma.category.deleteMany();
  await prisma.mpEvent.deleteMany();

  const passwordHash = await bcrypt.hash('Password123!', 10);

  // Create admin
  console.log('Creating admin...');
  const admin = await prisma.user.create({
    data: {
      email: 'admin@rifas.com',
      passwordHash,
      nombre: 'Admin',
      apellido: 'Sistema',
      role: UserRole.ADMIN,
      mpConnectStatus: 'CONNECTED',
      mpUserId: 'admin_mp_123',
      fechaNacimiento: new Date('1985-05-15'),
      termsAcceptedAt: new Date(),
      termsVersion: '2026-01',
      kycStatus: KycStatus.VERIFIED,
      documentType: DocumentType.DNI,
      documentNumber: '20123456',
      street: 'Av. 9 de Julio',
      streetNumber: '1000',
      city: 'Buenos Aires',
      province: 'CABA',
      postalCode: 'C1043',
      phone: '+54 11 1234-5678',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin',
      reputation: {
        create: {},
      },
    },
  });

  // Create 2 regular users
  console.log('Creating users...');
  const seller = await prisma.user.create({
    data: {
      email: 'vendedor@test.com',
      passwordHash,
      nombre: 'Juan',
      apellido: 'Vendedor',
      role: UserRole.USER,
      mpConnectStatus: 'CONNECTED',
      mpUserId: 'seller_mp_456',
      fechaNacimiento: new Date('1990-03-20'),
      termsAcceptedAt: new Date(),
      termsVersion: '2026-01',
      kycStatus: KycStatus.VERIFIED,
      documentType: DocumentType.DNI,
      documentNumber: '30456789',
      street: 'Av. Corrientes',
      streetNumber: '1234',
      city: 'Buenos Aires',
      province: 'CABA',
      postalCode: 'C1043',
      phone: '+54 11 2345-6789',
      cuitCuil: '20-30456789-5',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=seller',
      reputation: {
        create: {
          totalVentasCompletadas: 15,
          ratingPromedioVendedor: 4.8,
          nivelVendedor: 'PLATA',
        },
      },
      shippingAddresses: {
        create: {
          label: 'Casa',
          recipientName: 'Juan Vendedor',
          street: 'Av. Corrientes',
          number: '1234',
          city: 'Buenos Aires',
          province: 'CABA',
          postalCode: '1043',
          isDefault: true,
        },
      },
    },
  });

  const buyer = await prisma.user.create({
    data: {
      email: 'comprador@test.com',
      passwordHash,
      nombre: 'Maria',
      apellido: 'Compradora',
      role: UserRole.USER,
      mpConnectStatus: 'NOT_CONNECTED',
      fechaNacimiento: new Date('1995-08-10'),
      termsAcceptedAt: new Date(),
      termsVersion: '2026-01',
      kycStatus: KycStatus.NOT_SUBMITTED,
      reputation: {
        create: {
          totalComprasCompletadas: 5,
          totalTicketsComprados: 27,
        },
      },
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=buyer',
      shippingAddresses: {
        create: {
          label: 'Trabajo',
          recipientName: 'Maria Compradora',
          street: 'Av. Santa Fe',
          number: '5678',
          city: 'Buenos Aires',
          province: 'CABA',
          postalCode: '1425',
          isDefault: true,
        },
      },
    },
  });

  // Create categories
  console.log('Creating categories...');
  const categories = await Promise.all([
    prisma.category.create({ data: { nombre: 'Electrónica', orden: 1 } }),
    prisma.category.create({ data: { nombre: 'Gaming', orden: 2 } }),
    prisma.category.create({ data: { nombre: 'Hogar', orden: 3 } }),
  ]);

  // Create 5 raffles with different states
  console.log('Creating raffles...');

  // Raffle 1: Active, 20% sold
  const raffle1 = await prisma.raffle.create({
    data: {
      titulo: 'iPhone 15 Pro Max',
      descripcion: 'iPhone 15 Pro Max 256GB, nuevo en caja sellada.',
      sellerId: seller.id,
      totalTickets: 20,
      precioPorTicket: 500,
      fechaLimiteSorteo: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      estado: RaffleStatus.ACTIVA,
      categoryId: categories[0].id,
      product: {
        create: {
          nombre: 'iPhone 15 Pro Max 256GB',
          descripcionDetallada: 'Smartphone Apple iPhone 15 Pro Max con 256GB de almacenamiento. Color Titanio Natural. Nuevo, sellado.',
          categoria: 'Electrónica',
          condicion: ProductCondition.NUEVO,
          imagenes: ['https://picsum.photos/800/600?random=1'],
        },
      },
    },
  });

  // 4 tickets sold for raffle1
  for (let i = 1; i <= 4; i++) {
    await prisma.ticket.create({
      data: {
        raffleId: raffle1.id,
        numeroTicket: i,
        buyerId: buyer.id,
        precioPagado: 500,
        estado: TicketStatus.PAGADO,
        mpPaymentId: `mock_payment_${i}`,
      },
    });
  }

  // Raffle 2: Active, 80% sold (close to completion)
  const raffle2 = await prisma.raffle.create({
    data: {
      titulo: 'PlayStation 5',
      descripcion: 'PS5 Digital Edition con 2 controles.',
      sellerId: seller.id,
      totalTickets: 10,
      precioPorTicket: 300,
      fechaLimiteSorteo: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      estado: RaffleStatus.ACTIVA,
      categoryId: categories[1].id,
      product: {
        create: {
          nombre: 'PlayStation 5 Digital Edition',
          descripcionDetallada: 'Consola PS5 Digital Edition con 2 DualSense. Poco uso, como nueva.',
          categoria: 'Gaming',
          condicion: ProductCondition.USADO_COMO_NUEVO,
          imagenes: ['https://picsum.photos/800/600?random=2'],
        },
      },
    },
  });

  // 8 tickets sold for raffle2
  for (let i = 1; i <= 8; i++) {
    await prisma.ticket.create({
      data: {
        raffleId: raffle2.id,
        numeroTicket: i,
        buyerId: buyer.id,
        precioPagado: 300,
        estado: TicketStatus.PAGADO,
        mpPaymentId: `mock_payment_ps5_${i}`,
      },
    });
  }

  // Raffle 3: Completed (100% sold, waiting for draw)
  const raffle3 = await prisma.raffle.create({
    data: {
      titulo: 'Smart TV 55"',
      descripcion: 'Samsung Smart TV 55 pulgadas 4K.',
      sellerId: seller.id,
      totalTickets: 10,
      precioPorTicket: 200,
      fechaLimiteSorteo: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      estado: RaffleStatus.COMPLETADA,
      categoryId: categories[2].id,
      product: {
        create: {
          nombre: 'Samsung Smart TV 55" 4K',
          descripcionDetallada: 'TV Samsung 55 pulgadas, resolución 4K UHD, Smart TV con Tizen.',
          categoria: 'Hogar',
          condicion: ProductCondition.NUEVO,
          imagenes: ['https://picsum.photos/800/600?random=3'],
        },
      },
    },
  });

  // 10 tickets sold for raffle3
  for (let i = 1; i <= 10; i++) {
    await prisma.ticket.create({
      data: {
        raffleId: raffle3.id,
        numeroTicket: i,
        buyerId: buyer.id,
        precioPagado: 200,
        estado: TicketStatus.PAGADO,
        mpPaymentId: `mock_payment_tv_${i}`,
      },
    });
  }

  // Raffle 4: Drawn, with winner
  const raffle4 = await prisma.raffle.create({
    data: {
      titulo: 'AirPods Pro 2',
      descripcion: 'Apple AirPods Pro 2da generación.',
      sellerId: seller.id,
      totalTickets: 5,
      precioPorTicket: 150,
      fechaLimiteSorteo: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      estado: RaffleStatus.SORTEADA,
      winnerId: buyer.id,
      fechaSorteoReal: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      deliveryStatus: DeliveryStatus.PENDING,
      categoryId: categories[0].id,
      product: {
        create: {
          nombre: 'Apple AirPods Pro 2',
          descripcionDetallada: 'AirPods Pro 2da generación con estuche MagSafe. Nuevos.',
          categoria: 'Electrónica',
          condicion: ProductCondition.NUEVO,
          imagenes: ['https://picsum.photos/800/600?random=4'],
        },
      },
    },
  });

  // 5 tickets for raffle4
  for (let i = 1; i <= 5; i++) {
    await prisma.ticket.create({
      data: {
        raffleId: raffle4.id,
        numeroTicket: i,
        buyerId: buyer.id,
        precioPagado: 150,
        estado: TicketStatus.PAGADO,
        mpPaymentId: `mock_payment_airpods_${i}`,
      },
    });
  }

  // Raffle 5: Active, no tickets yet
  await prisma.raffle.create({
    data: {
      titulo: 'Nintendo Switch OLED',
      descripcion: 'Nintendo Switch modelo OLED, nueva.',
      sellerId: seller.id,
      totalTickets: 15,
      precioPorTicket: 250,
      fechaLimiteSorteo: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      estado: RaffleStatus.ACTIVA,
      categoryId: categories[1].id,
      product: {
        create: {
          nombre: 'Nintendo Switch OLED',
          descripcionDetallada: 'Consola Nintendo Switch modelo OLED. Nueva, sellada.',
          categoria: 'Gaming',
          condicion: ProductCondition.NUEVO,
          imagenes: ['https://picsum.photos/800/600?random=5'],
        },
      },
    },
  });

  console.log('\nSeed completed!');
  console.log('\nCredentials:');
  console.log('  Admin: admin@rifas.com / Password123!');
  console.log('  Seller: vendedor@test.com / Password123!');
  console.log('  Buyer: comprador@test.com / Password123!');
  console.log('\nData created:');
  console.log('  - 3 users (1 admin, 1 seller, 1 buyer)');
  console.log('  - 5 raffles');
  console.log('  - 27 tickets');
  console.log('  - 3 categories');

  // Create sample questions and answers
  console.log('Creating sample questions and answers...');
  
  // Question 1 with answer on iPhone raffle
  const question1 = await prisma.raffleQuestion.create({
    data: {
      raffleId: raffle1.id,
      askerId: buyer.id,
      content: '¿El iPhone viene con cargador y cable incluido en la caja?',
    },
  });
  await prisma.raffleAnswer.create({
    data: {
      questionId: question1.id,
      sellerId: seller.id,
      content: 'Sí, viene con cable USB-C. El cargador no está incluido porque Apple no lo incluye desde hace varias generaciones.',
    },
  });

  // Question 2 with answer on iPhone raffle  
  const question2 = await prisma.raffleQuestion.create({
    data: {
      raffleId: raffle1.id,
      askerId: buyer.id,
      content: '¿Tiene garantía oficial de Apple Argentina?',
    },
  });
  await prisma.raffleAnswer.create({
    data: {
      questionId: question2.id,
      sellerId: seller.id,
      content: 'Sí, cuenta con garantía oficial de 1 año por Apple Argentina.',
    },
  });

  // Question 3 without answer (pending) on iPhone raffle
  await prisma.raffleQuestion.create({
    data: {
      raffleId: raffle1.id,
      askerId: buyer.id,
      content: '¿Aceptan envío al interior del país?',
    },
  });

  // Question on PS5 raffle with answer
  const question4 = await prisma.raffleQuestion.create({
    data: {
      raffleId: raffle2.id,
      askerId: buyer.id,
      content: '¿Los controles DualSense son originales de Sony?',
    },
  });
  await prisma.raffleAnswer.create({
    data: {
      questionId: question4.id,
      sellerId: seller.id,
      content: 'Sí, ambos controles son DualSense originales de Sony.',
    },
  });

  console.log('  - 4 questions (3 answered, 1 pending)');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
