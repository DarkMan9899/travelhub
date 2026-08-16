-- Stage 11.7 Admin Platform: the new admin-facing `GET /admin/audit-logs`
-- viewer can filter by `action` alone or by a `created_at` date range with
-- no other filter. The two existing indexes on `audit_logs`
-- (`target_type`+`target_id`+`created_at`, and `actor_id` alone) don't
-- cover either case — this composite index does, and also serves an
-- `action`-only filter via its leftmost prefix.
ALTER TABLE audit_logs
  ADD INDEX idx_audit_logs_action_created_at (action, created_at);
