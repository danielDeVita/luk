import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { NotificationsService } from '../src/notifications/notifications.service';

async function bootstrap() {
  console.log('🚀 Initializing application context...');
  try {
    const app = await NestFactory.createApplicationContext(AppModule);
    const notificationsService = app.get(NotificationsService);

    const email = 'danielitodevita@gmail.com';
    console.log(`📧 Sending test email to ${email}...`);

    const result = await notificationsService.sendWelcomeEmail(email, { userName: 'Daniel' });

    if (result) {
      console.log('✅ Email service call returned success!');
    } else {
      console.log('❌ Email service call failed (check backend console logs).');
    }

    console.log('\n--- Troubleshooting Tips ---');
    console.log('1. Check if RESEND_API_KEY is set in backend/.env');
    console.log('2. If it says [MOCK] in the backend logs, the API key is missing or set to "mock".');
    console.log('3. If using onboarding@resend.dev, you can ONLY send to your own Resend account email.');
    console.log('4. Check your spam folder.');

    await app.close();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Error initializing app context:', message);
  }
}

bootstrap();
