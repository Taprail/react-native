import { hmacSha256 } from './hmac';

export interface WebhookVerifyOptions {
  /** The raw request body as a string (JSON). */
  body: string;
  /** The X-Symble-Signature header value. */
  signature: string;
  /** Your webhook secret. */
  webhookSecret: string;
}

/**
 * Verify that an incoming webhook request was sent by Taprail.
 *
 * The server signs payloads as HMAC-SHA256(JSON body, webhook_secret).
 * The signature is sent in the X-Symble-Signature header.
 */
export async function verifyWebhookSignature(
  options: WebhookVerifyOptions,
): Promise<boolean> {
  const expected = await hmacSha256(options.body, options.webhookSecret);
  return timingSafeEqual(expected, options.signature);
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
