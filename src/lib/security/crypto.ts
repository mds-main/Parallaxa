/**
 * Application-level AES-256-GCM encryption (PRD 9.3) for push subscriptions, preferences and
 * political self-placement. Keys come from DATA_ENCRYPTION_KEY (32 bytes, base64); the key id is stored
 * with each ciphertext so keys can be rotated.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

function key(): { id: string; key: Buffer } {
  const raw = process.env.DATA_ENCRYPTION_KEY;
  if (raw) {
    const k = Buffer.from(raw, 'base64');
    if (k.length !== 32) throw new Error('DATA_ENCRYPTION_KEY must be 32 bytes (base64).');
    return { id: createHash('sha256').update(k).digest('hex').slice(0, 8), key: k };
  }
  if (process.env.NODE_ENV === 'production' && process.env.DATABASE_URL) throw new Error('DATA_ENCRYPTION_KEY is required in production.');
  const dev = createHash('sha256').update('parallaxa-dev-only-key').digest();
  return { id: 'dev', key: dev };
}

export function encrypt(plaintext: string): { ciphertext: string; keyId: string } {
  const { id, key: k } = key();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', k, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return { ciphertext: Buffer.concat([iv, cipher.getAuthTag(), enc]).toString('base64'), keyId: id };
}

export function decrypt(ciphertext: string): string {
  const { key: k } = key();
  const buf = Buffer.from(ciphertext, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', k, buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString('utf8');
}
