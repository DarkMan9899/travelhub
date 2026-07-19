-- Refresh token store (Sprint 6). BACKEND_ARCHITECTURE.md §12 / API_SPECIFICATION.md
-- §7: refresh tokens are persisted server-side (hashed, never plaintext),
-- support strict single-use rotation, and reuse-detection revokes the
-- entire token family. token_hash is SHA-256 (node:crypto), not Argon2 —
-- Argon2's slow-hash property exists to resist brute-forcing a *low-entropy*
-- secret (a human password); a refresh token is already a high-entropy
-- signed JWT, so a fast cryptographic hash is the correct, sufficient
-- choice here (and avoids needless CPU cost on every refresh).
--
-- No `updated_at` — a row is created, then exactly once revoked (rotation
-- or logout), never otherwise modified. Same ephemeral-table rationale as
-- `reservation_holds` (migration 0007).

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  family_id CHAR(36) NOT NULL COMMENT 'Shared across a full rotation chain from one login',
  token_hash CHAR(64) NOT NULL COMMENT 'SHA-256 hex digest of the signed refresh JWT',
  device_label VARCHAR(255) NULL COMMENT 'From X-Client header / User-Agent, informational only',
  replaced_by_token_id BIGINT UNSIGNED NULL,
  revoked_at DATETIME(3) NULL,
  expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_refresh_tokens_token_hash UNIQUE (token_hash),
  CONSTRAINT fk_refresh_tokens_user_id FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_refresh_tokens_replaced_by_token_id FOREIGN KEY (replaced_by_token_id) REFERENCES refresh_tokens (id),
  KEY idx_refresh_tokens_user_id (user_id),
  KEY idx_refresh_tokens_family_id (family_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
