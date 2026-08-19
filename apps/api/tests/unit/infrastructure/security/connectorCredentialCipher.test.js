import { describe, test, expect } from '@jest/globals';
import {
  encryptConnectorConfig,
  decryptConnectorConfig,
} from '../../../../src/infrastructure/security/connectorCredentialCipher.js';

describe('connectorCredentialCipher (P0.6)', () => {
  test('round-trips an object through encrypt then decrypt', () => {
    const original = {
      feedUrl: 'https://example.com/cal.ics?token=secret-abc',
    };
    const encrypted = encryptConnectorConfig(original);
    expect(typeof encrypted).toBe('string');
    expect(encrypted).not.toContain('secret-abc');
    expect(decryptConnectorConfig(encrypted)).toEqual(original);
  });

  test('null/undefined pass through as null on both sides', () => {
    expect(encryptConnectorConfig(null)).toBeNull();
    expect(encryptConnectorConfig(undefined)).toBeNull();
    expect(decryptConnectorConfig(null)).toBeNull();
    expect(decryptConnectorConfig(undefined)).toBeNull();
  });

  test('the stored ciphertext is a JSON envelope, valid for a JSON column, with no plaintext key material', () => {
    const encrypted = encryptConnectorConfig({ apiKey: 'super-secret-key' });
    const envelope = JSON.parse(encrypted);
    expect(envelope).toEqual(
      expect.objectContaining({
        v: 1,
        iv: expect.any(String),
        tag: expect.any(String),
        data: expect.any(String),
      }),
    );
    expect(JSON.stringify(envelope)).not.toContain('super-secret-key');
  });

  test('decrypt treats a legacy plaintext row (pre-P0.6 or raw-SQL seed data) as already-plain, not as ciphertext', () => {
    const legacyPlaintext = JSON.stringify({
      fixtureIcs: 'BEGIN:VCALENDAR...',
    });
    expect(decryptConnectorConfig(legacyPlaintext)).toEqual({
      fixtureIcs: 'BEGIN:VCALENDAR...',
    });
  });

  test('decrypt accepts an already-parsed plain object the same way (mysql2 may return JSON columns pre-parsed)', () => {
    const alreadyParsed = { fixtureIcs: 'BEGIN:VCALENDAR...' };
    expect(decryptConnectorConfig(alreadyParsed)).toEqual(alreadyParsed);
  });

  test('two encryptions of the same plaintext produce different ciphertext (random IV per call)', () => {
    const a = encryptConnectorConfig({ apiKey: 'same-value' });
    const b = encryptConnectorConfig({ apiKey: 'same-value' });
    expect(a).not.toBe(b);
    expect(decryptConnectorConfig(a)).toEqual(decryptConnectorConfig(b));
  });

  test('a tampered ciphertext fails GCM authentication instead of silently decrypting to garbage', () => {
    const encrypted = encryptConnectorConfig({ apiKey: 'value' });
    const envelope = JSON.parse(encrypted);
    envelope.data = Buffer.from('tampered-ciphertext-bytes').toString('base64');
    expect(() => decryptConnectorConfig(JSON.stringify(envelope))).toThrow();
  });
});
