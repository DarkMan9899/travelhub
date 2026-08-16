-- Messaging Platform foundation (Phase 14). Replaces the empty
-- `apps/api/src/modules/messaging/` scaffold with a real schema.
--
-- `conversations.context_type`/`context_id` is the same polymorphic-
-- reference shape `audit_logs.target_type`/`target_id` (migration 0011)
-- and `media.mediable_type`/`mediable_id` (migration 0006) already
-- established — lets a conversation optionally anchor to a specific
-- booking/listing ("message the partner about BK-123") while also
-- supporting a free-standing conversation (e.g. admin support) with no
-- context at all.
--
-- `conversation_participants` deliberately has no "role" column — a
-- participant's role (customer, partner staff, admin) is a live fact
-- about the *user*, resolved at read time from their actual current
-- roles/partnerships, not a snapshot that would go stale (e.g. an
-- employee leaving a partner org). This also means a future AI
-- participant is just another row here, no schema change needed.
--
-- Read receipts/unread counts are tracked via
-- `conversation_participants.last_read_message_id` rather than a
-- per-message-per-reader table — unread count for a participant is
-- `COUNT(messages WHERE conversation_id = X AND id > last_read_message_id
-- AND sender_user_id != participant.user_id)`. Sufficient for the small
-- (2-4 participant) conversations this phase supports; a fan-out table
-- would only matter for large group chats, out of scope here.
--
-- Attachments deliberately have NO new table here — every existing
-- module (`listings`, `users`) already hand-rolls its own `attachMedia`
-- against the shared `media` table (migration 0006) with its own
-- `mediable_type` string; messaging follows the exact same convention
-- (`mediable_type = 'message'`), never a second attachment table.

CREATE TABLE IF NOT EXISTS conversations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  context_type VARCHAR(50) NULL,
  context_id BIGINT UNSIGNED NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  last_message_at DATETIME(3) NULL,
  is_archived TINYINT(1) NOT NULL DEFAULT 0,
  archived_at DATETIME(3) NULL,
  deleted_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT fk_conversations_created_by FOREIGN KEY (created_by) REFERENCES users (id),
  KEY idx_conversations_context (context_type, context_id),
  KEY idx_conversations_last_message_at (last_message_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS conversation_participants (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  conversation_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  joined_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_read_message_id BIGINT UNSIGNED NULL,
  is_archived_for_participant TINYINT(1) NOT NULL DEFAULT 0,
  archived_at DATETIME(3) NULL,
  left_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_conversation_participants UNIQUE (conversation_id, user_id),
  CONSTRAINT fk_conversation_participants_conversation_id FOREIGN KEY (conversation_id) REFERENCES conversations (id),
  CONSTRAINT fk_conversation_participants_user_id FOREIGN KEY (user_id) REFERENCES users (id),
  KEY idx_conversation_participants_user (user_id, is_archived_for_participant)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  conversation_id BIGINT UNSIGNED NOT NULL,
  sender_user_id BIGINT UNSIGNED NOT NULL,
  body TEXT NOT NULL,
  is_edited TINYINT(1) NOT NULL DEFAULT 0,
  edited_at DATETIME(3) NULL,
  deleted_at DATETIME(3) NULL,
  deleted_by BIGINT UNSIGNED NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT fk_messages_conversation_id FOREIGN KEY (conversation_id) REFERENCES conversations (id),
  CONSTRAINT fk_messages_sender_user_id FOREIGN KEY (sender_user_id) REFERENCES users (id),
  CONSTRAINT fk_messages_deleted_by FOREIGN KEY (deleted_by) REFERENCES users (id),
  KEY idx_messages_conversation_created (conversation_id, created_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS message_reactions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  message_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  reaction_code VARCHAR(20) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_message_reactions UNIQUE (message_id, user_id, reaction_code),
  CONSTRAINT fk_message_reactions_message_id FOREIGN KEY (message_id) REFERENCES messages (id),
  CONSTRAINT fk_message_reactions_user_id FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
