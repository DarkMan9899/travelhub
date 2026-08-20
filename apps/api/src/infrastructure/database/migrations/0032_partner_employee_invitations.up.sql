CREATE TABLE IF NOT EXISTS partner_employee_invitations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  partner_id BIGINT UNSIGNED NOT NULL,
  email VARCHAR(255) NOT NULL COMMENT 'Invited address as typed, for display',
  normalized_email VARCHAR(255) NOT NULL COMMENT 'lower(email); matched against the accepting users normalized_email at accept time',
  role_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL COMMENT 'SHA-256 hex of the raw invite token; the raw token itself is never stored, same idiom as refresh_tokens.token_hash',
  invited_by BIGINT UNSIGNED NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  accepted_at DATETIME(3) NULL,
  accepted_by BIGINT UNSIGNED NULL,
  revoked_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  pending_partner_email VARCHAR(298)
    GENERATED ALWAYS AS (IF(accepted_at IS NULL AND revoked_at IS NULL, CONCAT(partner_id, ':', normalized_email), NULL)) STORED
    COMMENT 'Soft-delete-safe uniqueness, same generated-column trick as partner_employees.active_partner_user: only one PENDING invite per partner+email at a time, but a resolved (accepted/revoked) one never blocks a fresh re-invite',
  PRIMARY KEY (id),
  CONSTRAINT uq_partner_employee_invitations_pending UNIQUE (pending_partner_email),
  CONSTRAINT uq_partner_employee_invitations_token_hash UNIQUE (token_hash),
  CONSTRAINT fk_partner_employee_invitations_partner_id FOREIGN KEY (partner_id) REFERENCES partners (id),
  CONSTRAINT fk_partner_employee_invitations_role_id FOREIGN KEY (role_id) REFERENCES partner_employee_roles (id),
  CONSTRAINT fk_partner_employee_invitations_invited_by FOREIGN KEY (invited_by) REFERENCES users (id),
  CONSTRAINT fk_partner_employee_invitations_accepted_by FOREIGN KEY (accepted_by) REFERENCES users (id),
  KEY idx_partner_employee_invitations_partner_id (partner_id),
  KEY idx_partner_employee_invitations_normalized_email (normalized_email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
