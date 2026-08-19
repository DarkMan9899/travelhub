-- P0.4 (Master Roadmap): `notification_preferences.in_app_enabled` has
-- been stored and editable since migration 0021 but was never actually
-- enforced — `NotificationService#createNotification` always wrote the
-- in-app row regardless of the recipient's preference. The `EMAIL`
-- channel's equivalent preference IS enforced, but by skipping the
-- delivery-queue enqueue, not by touching the row itself — there is no
-- equivalent "enqueue" step for in-app, since the row itself IS the
-- in-app delivery. A snapshot flag captured at creation time (mirroring
-- `moderation_notes`'s single-`ALTER TABLE ADD COLUMN` shape, migration
-- 0017) is the smallest correct fix: the row still exists (still the
-- source object `EMAIL` delivery reads from, still idempotent by
-- event_id+recipient_user_id), it just never surfaces via
-- `listForUser`/`countUnread` when the recipient had `IN_APP` disabled
-- for that category at creation time.

ALTER TABLE notifications ADD COLUMN is_in_app_visible TINYINT(1) NOT NULL DEFAULT 1 AFTER metadata;
