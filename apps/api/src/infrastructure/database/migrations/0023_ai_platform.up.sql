-- AI Platform foundation (Phase 15). Replaces the empty
-- `apps/api/src/modules/ai/` scaffold with a real schema.
--
-- `ai_conversations`/`ai_messages` are deliberately NOT a reuse of
-- Messaging's `conversations`/`messages` tables (migration 0022) — an AI
-- turn carries metadata (provider, model, token counts, latency, cache
-- hit) that a human-to-human message row has no use for, and Messaging's
-- participant model assumes real authenticated humans on both sides of a
-- thread. The Assistant UI reuses Messaging's visual language
-- (MessageBubble-style bubbles) without sharing a backend schema.
--
-- `ai_user_memory` is a small, strictly user-scoped key/value table for
-- preferences/travel-style/budget/favorite-destinations — no cross-user
-- reads, no admin override (admins only ever see aggregate usage via
-- `ai_usage_logs`, never another user's raw memory content).
--
-- `ai_usage_logs` is append-only, never joined into a hot request path —
-- it backs the Admin AI usage dashboard (`GET /admin/ai/usage`) and is
-- written by `AiService` after every provider call, success or failure.

CREATE TABLE IF NOT EXISTS ai_conversations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  feature_code VARCHAR(30) NOT NULL,
  title VARCHAR(255) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_ai_conversations_user_id FOREIGN KEY (user_id) REFERENCES users (id),
  KEY idx_ai_conversations_user (user_id, feature_code, deleted_at, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  conversation_id BIGINT UNSIGNED NOT NULL,
  role VARCHAR(20) NOT NULL,
  content MEDIUMTEXT NOT NULL,
  provider_code VARCHAR(30) NULL,
  model VARCHAR(100) NULL,
  prompt_tokens INT UNSIGNED NULL,
  completion_tokens INT UNSIGNED NULL,
  latency_ms INT UNSIGNED NULL,
  cache_hit TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT fk_ai_messages_conversation_id FOREIGN KEY (conversation_id) REFERENCES ai_conversations (id),
  KEY idx_ai_messages_conversation_created (conversation_id, created_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_user_memory (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  memory_key VARCHAR(60) NOT NULL,
  memory_value JSON NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_ai_user_memory UNIQUE (user_id, memory_key),
  CONSTRAINT fk_ai_user_memory_user_id FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NULL,
  partner_id BIGINT UNSIGNED NULL,
  feature_code VARCHAR(30) NOT NULL,
  provider_code VARCHAR(30) NOT NULL,
  model VARCHAR(100) NULL,
  prompt_tokens INT UNSIGNED NOT NULL DEFAULT 0,
  completion_tokens INT UNSIGNED NOT NULL DEFAULT 0,
  total_tokens INT UNSIGNED NOT NULL DEFAULT 0,
  latency_ms INT UNSIGNED NOT NULL DEFAULT 0,
  cache_hit TINYINT(1) NOT NULL DEFAULT 0,
  succeeded TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT fk_ai_usage_logs_user_id FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_ai_usage_logs_partner_id FOREIGN KEY (partner_id) REFERENCES partners (id),
  KEY idx_ai_usage_logs_feature_created (feature_code, created_at),
  KEY idx_ai_usage_logs_user (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
