/**
 * HMAC Verification - Constant-time signature verification with TTL
 */

import crypto from 'crypto';

const TTL_SECONDS = 120;

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  timestamp: string,
  secret: string
) {
  const ageMs = Date.now() - parseInt(timestamp, 10) * 1000;
  
  if (ageMs > TTL_SECONDS * 1000 || ageMs < 0) {
    return { valid: false, error: 'expired' };
  }
  
  const expected = crypto
    .createHmac('sha256', secret)
    .update(timestamp + payload)
    .digest('hex');
  
  const a = Buffer.from(signature || '', 'hex');
  const b = Buffer.from(expected, 'hex');
  
  if (a.length !== b.length) {
    return { valid: false, error: 'length' };
  }
  
  return { valid: crypto.timingSafeEqual(a, b) };
}

