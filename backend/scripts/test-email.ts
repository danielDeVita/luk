import * as nodemailer from 'nodemailer';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env from root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function testEmail() {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = parseInt(process.env.SMTP_PORT || '465');
  const smtpSecure = process.env.SMTP_SECURE === 'true';
  const emailFrom = process.env.EMAIL_FROM || smtpUser;

  console.log('=== Email Configuration ===');
  console.log('SMTP_HOST:', smtpHost);
  console.log('SMTP_PORT:', smtpPort);
  console.log('SMTP_SECURE:', smtpSecure);
  console.log('SMTP_USER:', smtpUser);
  console.log('SMTP_PASS:', smtpPass ? `${smtpPass.substring(0, 4)}****` : 'NOT SET');
  console.log('EMAIL_FROM:', emailFrom);
  console.log('');

  if (!smtpUser || !smtpPass) {
    console.error('ERROR: SMTP_USER or SMTP_PASS not set');
    process.exit(1);
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  console.log('=== Testing SMTP Connection ===');
  try {
    await transporter.verify();
    console.log('✅ SMTP connection successful!');
  } catch (error) {
    console.error('❌ SMTP connection failed:', error);
    process.exit(1);
  }

  // Send test email
  console.log('\n=== Sending Test Email ===');
  try {
    const info = await transporter.sendMail({
      from: `"Test" <${emailFrom}>`,
      to: smtpUser, // Send to self
      subject: 'Test Email from Raffle Platform',
      html: '<h1>Test Email</h1><p>If you see this, nodemailer is working!</p>',
    });
    console.log('✅ Email sent! Message ID:', info.messageId);
  } catch (error) {
    console.error('❌ Email send failed:', error);
    process.exit(1);
  }
}

testEmail();
