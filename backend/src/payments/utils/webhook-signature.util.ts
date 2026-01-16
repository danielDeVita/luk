import * as crypto from 'crypto';

export interface WebhookSignatureParams {
  xSignature: string | undefined;
  xRequestId: string | undefined;
  dataId: string;
  secret: string;
}

export interface SignatureVerificationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Verifies Mercado Pago webhook signature.
 *
 * MP sends x-signature header in format: ts=<timestamp>,v1=<hash>
 * The hash is HMAC-SHA256 of: id:<dataId>;request-id:<xRequestId>;ts:<timestamp>;
 *
 * @see https://www.mercadopago.com/developers/en/docs/your-integrations/notifications/webhooks
 */
export function verifyWebhookSignature(
  params: WebhookSignatureParams,
): SignatureVerificationResult {
  const { xSignature, xRequestId, dataId, secret } = params;

  if (!xSignature) {
    return { valid: false, reason: 'Missing x-signature header' };
  }

  if (!xRequestId) {
    return { valid: false, reason: 'Missing x-request-id header' };
  }

  if (!secret) {
    return { valid: false, reason: 'Missing webhook secret configuration' };
  }

  // Parse x-signature header: ts=<timestamp>,v1=<hash>
  const parts = xSignature.split(',');
  let ts: string | undefined;
  let hash: string | undefined;

  for (const part of parts) {
    const [key, value] = part.split('=');
    if (key === 'ts') {
      ts = value;
    } else if (key === 'v1') {
      hash = value;
    }
  }

  if (!ts || !hash) {
    return { valid: false, reason: 'Invalid x-signature format' };
  }

  // Build the manifest string
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;

  // Compute HMAC-SHA256
  const computedHash = crypto
    .createHmac('sha256', secret)
    .update(manifest)
    .digest('hex');

  // Compare signatures (constant-time comparison to prevent timing attacks)
  const isValid = crypto.timingSafeEqual(
    Buffer.from(computedHash, 'hex'),
    Buffer.from(hash, 'hex'),
  );

  if (!isValid) {
    return { valid: false, reason: 'Signature mismatch' };
  }

  // Optional: Check timestamp freshness (prevent replay attacks)
  const timestamp = parseInt(ts, 10);
  const now = Math.floor(Date.now() / 1000);
  const fiveMinutes = 5 * 60;

  if (Math.abs(now - timestamp) > fiveMinutes) {
    return {
      valid: false,
      reason: 'Timestamp too old (possible replay attack)',
    };
  }

  return { valid: true };
}
