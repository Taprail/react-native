import * as Crypto from 'expo-crypto';

export interface SignatureParams {
  sessionId: string;
  businessId: string;
  amount: number;
  nonce: string;
  expiresAt: string;
  secret: string;
}

/**
 * Compute the HMAC-SHA256 signature for session verification.
 *
 * Reproduces the server-side payload format:
 *   "{session_id}|{business_id}|{amount}|{nonce}|{unix_timestamp}"
 */
export async function computeSessionSignature(
  params: SignatureParams,
): Promise<string> {
  const expiresAtTimestamp = Math.floor(
    new Date(params.expiresAt).getTime() / 1000,
  );

  const payload = [
    params.sessionId,
    params.businessId,
    params.amount,
    params.nonce,
    expiresAtTimestamp,
  ].join('|');

  return hmacSha256(payload, params.secret);
}

/**
 * HMAC-SHA256 implemented from SHA-256 primitives per RFC 2104.
 * Uses expo-crypto's digest() which works in Expo managed workflow.
 */
export async function hmacSha256(
  message: string,
  key: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const keyBytes = encoder.encode(key);
  const messageBytes = encoder.encode(message);

  const BLOCK_SIZE = 64;

  let keyBlock: Uint8Array;
  if (keyBytes.length > BLOCK_SIZE) {
    const hashed = await Crypto.digest(
      Crypto.CryptoDigestAlgorithm.SHA256,
      keyBytes,
    );
    keyBlock = new Uint8Array(hashed);
  } else {
    keyBlock = keyBytes;
  }

  const paddedKey = new Uint8Array(BLOCK_SIZE);
  paddedKey.set(keyBlock);

  const innerPad = new Uint8Array(BLOCK_SIZE);
  const outerPad = new Uint8Array(BLOCK_SIZE);
  for (let i = 0; i < BLOCK_SIZE; i++) {
    innerPad[i] = paddedKey[i]! ^ 0x36;
    outerPad[i] = paddedKey[i]! ^ 0x5c;
  }

  // Inner hash: SHA256(innerPad || message)
  const innerData = new Uint8Array(BLOCK_SIZE + messageBytes.length);
  innerData.set(innerPad);
  innerData.set(messageBytes, BLOCK_SIZE);

  const innerHash = await Crypto.digest(
    Crypto.CryptoDigestAlgorithm.SHA256,
    innerData,
  );
  const innerHashBytes = new Uint8Array(innerHash);

  // Outer hash: SHA256(outerPad || innerHash)
  const outerData = new Uint8Array(BLOCK_SIZE + innerHashBytes.length);
  outerData.set(outerPad);
  outerData.set(innerHashBytes, BLOCK_SIZE);

  const outerHash = await Crypto.digest(
    Crypto.CryptoDigestAlgorithm.SHA256,
    outerData,
  );

  return bytesToHex(new Uint8Array(outerHash));
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
