-- Bug fix (Sprint 6): `login_history.user_id` was NOT NULL (migration
-- 0002), but API_SPECIFICATION.md §27 requires logging *every* login
-- attempt, success or failure — including a failed attempt against an
-- email that doesn't belong to any account, which has no user_id to
-- attach the row to. Loosening NOT NULL -> NULL is a safe, additive
-- change (DATABASE_ARCHITECTURE.md §15.5's expand-and-contract rule);
-- the existing FK constraint already permits NULL without modification.

ALTER TABLE login_history MODIFY COLUMN user_id BIGINT UNSIGNED NULL;
