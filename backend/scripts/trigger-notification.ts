import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Finding user by email...');
  
  const targetEmail = 'danielitodevita@gmail.com';
  const user = await prisma.user.findUnique({
    where: { email: targetEmail },
  });

  if (!user) {
    console.error('❌ No users found in database. Please register first.');
    return;
  }

  console.log(`👤 Found user: ${user.email} (${user.nombre})`);

  // Create a notification
  const notification = await prisma.notification.create({
    data: {
      userId: user.id,
      type: 'WIN',
      title: '🎉 ¡Prueba de Notificación Exitoso!',
      message: `Hola ${user.nombre}, el sistema de notificaciones está funcionando correctamente. Hora: ${new Date().toLocaleTimeString()}`,
      read: false,
    },
  });

  console.log(`✅ Notification created! ID: ${notification.id}`);
  console.log('🔔 Please check the bell icon in the dashboard.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
