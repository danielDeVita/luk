import {
  PrismaClient,
  KycStatus,
  MpConnectStatus,
  UserRole,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/**
 * Seed database with test users for E2E tests
 */
async function main() {
  console.log('🌱 Seeding database...');

  const passwordHash = await bcrypt.hash('Password123!', 10);

  // Create test buyer
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

  // Create test seller (verified KYC)
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

  // Create test admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@test.com' },
    update: {},
    create: {
      email: 'admin@test.com',
      passwordHash,
      nombre: 'Admin',
      apellido: 'Test',
      role: UserRole.ADMIN,
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });
  console.log(`✅ Created admin: ${admin.email}`);

  // Create unverified seller (for KYC tests)
  const unverifiedSeller = await prisma.user.upsert({
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
  console.log(`✅ Created unverified seller: ${unverifiedSeller.email}`);

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
