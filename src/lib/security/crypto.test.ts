import { describe, expect, it } from 'vitest';
import { decrypt, encrypt } from './crypto';

describe('crypto', () => {
  it('round-trips and uses a fresh IV each time', () => {
    const a = encrypt('{"endpoint":"https://push.example/abc"}');
    const b = encrypt('{"endpoint":"https://push.example/abc"}');
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(decrypt(a.ciphertext)).toBe('{"endpoint":"https://push.example/abc"}');
  });
  it('detects tampering', () => {
    const a = encrypt('secret');
    const buf = Buffer.from(a.ciphertext, 'base64');
    buf[buf.length - 1]! ^= 1;
    expect(() => decrypt(buf.toString('base64'))).toThrow();
  });
});
