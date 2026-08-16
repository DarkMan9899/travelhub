/**
 * MySQL-backed Message Reaction repository — Phase 14 (Messaging
 * Platform). Owns `message_reactions` (migration 0022). A small, fixed
 * `reaction_code` set is validated by the Zod schema (not a lookup
 * table) — see `messagingValidators.js` for the allowed set and why.
 */

import { getMysqlPool } from '../../../infrastructure/database/mysqlPool.js';

function toReactionDomain(row) {
  return {
    id: row.id,
    messageId: row.message_id,
    userId: row.user_id,
    reactionCode: row.reaction_code,
    createdAt: row.created_at,
  };
}

export class MySqlMessageReactionRepository {
  #pool;

  constructor(pool = getMysqlPool()) {
    this.#pool = pool;
  }

  /** Toggling an already-reacted (message, user, code) removes it; otherwise adds it. */
  async toggle(messageId, userId, reactionCode) {
    const [existing] = await this.#pool.query(
      `SELECT id FROM message_reactions
       WHERE message_id = ? AND user_id = ? AND reaction_code = ? LIMIT 1`,
      [messageId, userId, reactionCode],
    );
    if (existing.length > 0) {
      await this.#pool.query('DELETE FROM message_reactions WHERE id = ?', [
        existing[0].id,
      ]);
      return { added: false };
    }
    await this.#pool.query(
      `INSERT INTO message_reactions (message_id, user_id, reaction_code)
       VALUES (?, ?, ?)`,
      [messageId, userId, reactionCode],
    );
    return { added: true };
  }

  async listForMessage(messageId) {
    const [rows] = await this.#pool.query(
      `SELECT id, message_id, user_id, reaction_code, created_at
       FROM message_reactions WHERE message_id = ?
       ORDER BY created_at ASC`,
      [messageId],
    );
    return rows.map(toReactionDomain);
  }

  /** Batch read for a page of messages — avoids N+1 when listing a conversation's thread. */
  async listForMessages(messageIds) {
    if (messageIds.length === 0) return [];
    const placeholders = messageIds.map(() => '?').join(', ');
    const [rows] = await this.#pool.query(
      `SELECT id, message_id, user_id, reaction_code, created_at
       FROM message_reactions WHERE message_id IN (${placeholders})
       ORDER BY created_at ASC`,
      messageIds,
    );
    return rows.map(toReactionDomain);
  }
}

export default MySqlMessageReactionRepository;
