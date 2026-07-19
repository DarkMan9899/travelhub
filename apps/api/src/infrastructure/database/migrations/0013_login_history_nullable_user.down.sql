-- NOTE: this will fail if any NULL user_id rows already exist (expected —
-- down migrations are a dev-rollback convenience, not a guaranteed-safe
-- production operation for a constraint-tightening change).
ALTER TABLE login_history MODIFY COLUMN user_id BIGINT UNSIGNED NOT NULL;
