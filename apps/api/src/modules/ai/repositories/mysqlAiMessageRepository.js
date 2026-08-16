/**
 * MySQL-backed AI message repository (Phase 15). Owns `ai_messages` —
 * the turn-by-turn history under an `ai_conversations` thread. Lists
 * chronologically ascending (oldest first), unlike Messaging's
 * backward-paginated chat thread convention (Phase 14, scope decision
 * #10) — an AI conversation is read top-to-bottom as a transcript, not
 * scrolled-into like a live chat with potentially thousands of messages.
 */

import { getMysqlPool } from '../../../infrastructure/database/mysqlPool.js';

function toMessageDomain(row) {
  if (!row) return null;
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    providerCode: row.provider_code,
    model: row.model,
    promptTokens: row.prompt_tokens,
    completionTokens: row.completion_tokens,
    latencyMs: row.latency_ms,
    cacheHit: Boolean(row.cache_hit),
    createdAt: row.created_at,
  };
}

export class MySqlAiMessageRepository {
  #pool;

  constructor(pool = getMysqlPool()) {
    this.#pool = pool;
  }

  async create({
    conversationId,
    role,
    content,
    providerCode = null,
    model = null,
    promptTokens = null,
    completionTokens = null,
    latencyMs = null,
    cacheHit = false,
  }) {
    const [result] = await this.#pool.query(
      `INSERT INTO ai_messages
         (conversation_id, role, content, provider_code, model,
          prompt_tokens, completion_tokens, latency_ms, cache_hit)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        conversationId,
        role,
        content,
        providerCode,
        model,
        promptTokens,
        completionTokens,
        latencyMs,
        cacheHit ? 1 : 0,
      ],
    );
    const [rows] = await this.#pool.query(
      `SELECT * FROM ai_messages WHERE id = ? LIMIT 1`,
      [result.insertId],
    );
    return toMessageDomain(rows[0]);
  }

  async listForConversation(conversationId) {
    const [rows] = await this.#pool.query(
      `SELECT * FROM ai_messages WHERE conversation_id = ? ORDER BY created_at ASC, id ASC`,
      [conversationId],
    );
    return rows.map(toMessageDomain);
  }
}

export default MySqlAiMessageRepository;
