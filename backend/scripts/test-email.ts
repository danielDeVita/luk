/* import * as Brevo from '@getbrevo/brevo';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env from root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function testEmail() {
  const brevoApiKey = process.env.BREVO_API_KEY;
  const emailFrom = process.env.EMAIL_FROM || 'noreply@rifas.app';
  const emailFromName = process.env.EMAIL_FROM_NAME || 'Plataforma de Rifas';
  const testRecipient = process.argv[2] || process.env.TEST_EMAIL;

  console.log('=== Brevo Email Configuration ===');
  console.log('BREVO_API_KEY:', brevoApiKey ? `${brevoApiKey.substring(0, 15)}****` : 'NOT SET');
  console.log('EMAIL_FROM:', emailFrom);
  console.log('EMAIL_FROM_NAME:', emailFromName);
  console.log('');

  if (!brevoApiKey) {
    console.error('ERROR: BREVO_API_KEY not set');
    console.log('\nTo get your API key:');
    console.log('1. Sign up at https://www.brevo.com');
    console.log('2. Go to Settings → SMTP & API → API Keys');
    console.log('3. Create a new API key and add it to your .env file');
    process.exit(1);
  }

  if (!testRecipient) {
    console.error('ERROR: No recipient specified');
    console.log('\nUsage: npx ts-node scripts/test-email.ts your-email@example.com');
    process.exit(1);
  }

  const brevoApi = new Brevo.TransactionalEmailsApi();
  brevoApi.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, brevoApiKey);

  console.log('=== Sending Test Email ===');
  console.log(`To: ${testRecipient}`);

  try {
    const sendSmtpEmail = new Brevo.SendSmtpEmail();
    sendSmtpEmail.sender = { name: emailFromName, email: emailFrom };
    sendSmtpEmail.to = [{ email: testRecipient }];
    sendSmtpEmail.subject = 'Test Email from Raffle Platform (Brevo)';
    sendSmtpEmail.htmlContent = `
      <h1>Test Email</h1>
      <p>If you see this, Brevo is working correctly!</p>
      <p>Sent from: ${emailFromName} &lt;${emailFrom}&gt;</p>
    `;

    const result = await brevoApi.sendTransacEmail(sendSmtpEmail);
    console.log('✅ Email sent! Message ID:', result.body.messageId);
  } catch (error) {
    console.error('❌ Email send failed:', error);
    process.exit(1);
  }
}

testEmail();
 */