/**
 * ConnectorCredentialCipher — P0.6 (Master Roadmap): encrypts
 * `inventory_connections.config` at rest. A real inventory connector
 * config (a future CSV/GENERIC_API/GENERIC_WEBHOOK connector's API key,
 * or even an iCal `feedUrl` with an embedded token) was previously
 * stored as plain JSON in the database — this is the fix.
 *
 * AES-256-GCM, key derived via SHA-256 from
 * `config.security.connectorConfigEncryptionKey` (any string works as
 * input; envalid guarantees that config always has *some* value, dev or
 * production — see config/index.js's own comment there). The stored
 * value is itself a JSON envelope (`{v, iv, tag, data}`), so it still
 * fits the column's existing `JSON` type with zero schema change.
 *
 * `decrypt()` treats anything that ISN'T a recognized envelope (no `v`
 * field, or a `v` this module doesn't know) as a legacy plaintext row —
 * pre-P0.6 rows (and this codebase's own fixture/demo seed data, which
 * writes `config` via raw SQL, not through this repository) keep
 * reading correctly with no forced migration; `scripts/
 * reencryptInventoryConnectorConfigs.js` re-encrypts them opportunistically.
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from 'node:crypto';
import config from '../../config/index.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12; // GCM's recommended/standard nonce length
const ENVELOPE_VERSION = 1;

function deriveKey() {
  return createHash('sha256')
    .update(config.security.connectorConfigEncryptionKey)
    .digest();
}

/** @param {object|null} plainConfig @returns {string|null} JSON-serialized encrypted envelope */
export function encryptConnectorConfig(plainConfig) {
  if (plainConfig === null || plainConfig === undefined) return null;
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, deriveKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(plainConfig), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return JSON.stringify({
    v: ENVELOPE_VERSION,
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: encrypted.toString('base64'),
  });
}

function isEncryptedEnvelope(parsed) {
  return (
    parsed &&
    typeof parsed === 'object' &&
    parsed.v === ENVELOPE_VERSION &&
    typeof parsed.iv === 'string' &&
    typeof parsed.tag === 'string' &&
    typeof parsed.data === 'string'
  );
}

/** @param {string|object|null} stored — the raw `config` column value @returns {object|null} */
export function decryptConnectorConfig(stored) {
  if (stored === null || stored === undefined) return null;
  const parsed = typeof stored === 'string' ? JSON.parse(stored) : stored;
  if (!isEncryptedEnvelope(parsed)) {
    // Legacy/seed plaintext row — not this module's problem to fix on
    // read; `reencryptInventoryConnectorConfigs.js` handles migration.
    return parsed;
  }
  const decipher = createDecipheriv(
    ALGORITHM,
    deriveKey(),
    Buffer.from(parsed.iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(parsed.tag, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(parsed.data, 'base64')),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString('utf8'));
}

export default { encryptConnectorConfig, decryptConnectorConfig };
