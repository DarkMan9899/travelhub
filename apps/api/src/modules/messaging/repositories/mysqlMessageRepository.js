/**
 * MySQL-backed Message repository — Phase 14 (Messaging Platform). Owns
 * `messages` (migration 0022).
 *
 * `listForConversation` paginates BACKWARD (`created_at DESC, id DESC`,
 * same keyset-cursor mechanism `mysqlNotificationRepository.js` already
 * uses for its forward "load more" list) — a chat thread's "load more"
 * means "load older messages," so the newest page loads first and the
 * cursor walks further into the past. The query itself is identical in
 * shape to a forward list; only the caller's mental model of "which
 * direction is `next`" differs. `MessageService` reverses the page's
 * row order before returning it to the API, so a page reads oldest-to-
 * newest top-to-bottom, matching how a chat thread is actually rendered.
 */

import { getMysqlPool } from '../../../infrastructure/database/mysqlPool.js';
import { mapMysqlError } from '../../../infrastructure/database/errorMapping.js';
import {
  decodeCursor,
  buildPageMeta,
} from '../../../infrastructure/database/pagination.js';

function toMessageDomain(row) {
  if (!row) return null;
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderUserId: row.sender_user_id,
    body: row.body,
    isEdited: Boolean(row.is_edited),
    editedAt: row.edited_at,
    createdAt: row.created_at,
  };
}

const MESSAGE_SELECT = `
  m.id, m.conversation_id, m.sender_user_id, m.body, m.is_edited,
  m.edited_at, m.created_at
`;

export class MySqlMessageRepository {
  #pool;

  constructor(pool = getMysqlPool()) {
    this.#pool = pool;
  }

  async create(
    { conversationId, senderUserId, body },
    connection = this.#pool,
  ) {
    try {
      const [result] = await connection.query(
        `INSERT INTO messages (conversation_id, sender_user_id, body)
         VALUES (?, ?, ?)`,
        [conversationId, senderUserId, body],
      );
      return this.findById(result.insertId, connection);
    } catch (err) {
      throw mapMysqlError(err);
    }
  }

  async findById(id, connection = this.#pool) {
    const [rows] = await connection.query(
      `SELECT ${MESSAGE_SELECT} FROM messages m
       WHERE m.id = ? AND m.deleted_at IS NULL LIMIT 1`,
      [id],
    );
    return toMessageDomain(rows[0]);
  }

  /** Backward cursor — see this file's header comment. */
  async listForConversation(conversationId, { cursor, limit } = {}) {
    const decoded = decodeCursor(cursor);
    const conditions = ['m.conversation_id = ?', 'm.deleted_at IS NULL'];
    const params = [conversationId];

    if (
      decoded &&
      decoded.createdAt !== undefined &&
      decoded.id !== undefined
    ) {
      conditions.push('(m.created_at, m.id) < (?, ?)');
      params.push(decoded.createdAt, decoded.id);
    }

    const [rows] = await this.#pool.query(
      `SELECT ${MESSAGE_SELECT} FROM messages m
       WHERE ${conditions.join(' AND ')}
       ORDER BY m.created_at DESC, m.id DESC
       LIMIT ?`,
      [...params, limit + 1],
    );

    return buildPageMeta(rows.map(toMessageDomain), limit, (row) => ({
      createdAt: row.createdAt,
      id: row.id,
    }));
  }

  async search(conversationIds, query, { cursor, limit } = {}) {
    if (conversationIds.length === 0) {
      return { rows: [], meta: { next_cursor: null, has_more: false, limit } };
    }
    const decoded = decodeCursor(cursor);
    const placeholders = conversationIds.map(() => '?').join(', ');
    const conditions = [
      `m.conversation_id IN (${placeholders})`,
      'm.deleted_at IS NULL',
      'm.body LIKE ?',
    ];
    const params = [...conversationIds, `%${query}%`];

    if (
      decoded &&
      decoded.createdAt !== undefined &&
      decoded.id !== undefined
    ) {
      conditions.push('(m.created_at, m.id) < (?, ?)');
      params.push(decoded.createdAt, decoded.id);
    }

    const [rows] = await this.#pool.query(
      `SELECT ${MESSAGE_SELECT} FROM messages m
       WHERE ${conditions.join(' AND ')}
       ORDER BY m.created_at DESC, m.id DESC
       LIMIT ?`,
      [...params, limit + 1],
    );

    return buildPageMeta(rows.map(toMessageDomain), limit, (row) => ({
      createdAt: row.createdAt,
      id: row.id,
    }));
  }

  async softDelete(id, deletedBy, connection = this.#pool) {
    const [result] = await connection.query(
      `UPDATE messages SET deleted_at = CURRENT_TIMESTAMP(3), deleted_by = ?
       WHERE id = ? AND deleted_at IS NULL`,
      [deletedBy, id],
    );
    return result.affectedRows > 0;
  }
}

export default MySqlMessageRepository;
