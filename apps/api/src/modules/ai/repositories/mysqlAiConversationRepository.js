/**
 * MySQL-backed AI conversation repository (Phase 15). Owns
 * `ai_conversations` (migration 0023) — the generic conversation-thread
 * primitive shared by every AI feature that needs turn-by-turn history
 * (Trip Planner, the Assistant). `feature_code` scopes which feature a
 * thread belongs to; ownership is always `user_id`, checked by
 * `AiConversationService`, never by this repository.
 */

import { getMysqlPool } from '../../../infrastructure/database/mysqlPool.js';
import {
  decodeCursor,
  buildPageMeta,
} from '../../../infrastructure/database/pagination.js';

function toConversationDomain(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    featureCode: row.feature_code,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class MySqlAiConversationRepository {
  #pool;

  constructor(pool = getMysqlPool()) {
    this.#pool = pool;
  }

  async create({ userId, featureCode, title = null }) {
    const [result] = await this.#pool.query(
      `INSERT INTO ai_conversations (user_id, feature_code, title) VALUES (?, ?, ?)`,
      [userId, featureCode, title],
    );
    return this.findById(result.insertId);
  }

  async findById(id) {
    const [rows] = await this.#pool.query(
      `SELECT * FROM ai_conversations WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
      [id],
    );
    return toConversationDomain(rows[0]);
  }

  async listForUser(userId, { featureCode, cursor, limit = 20 } = {}) {
    const decoded = decodeCursor(cursor);
    const conditions = ['user_id = ?', 'deleted_at IS NULL'];
    const params = [userId];
    if (featureCode) {
      conditions.push('feature_code = ?');
      params.push(featureCode);
    }
    if (decoded?.updatedAt !== undefined && decoded?.id !== undefined) {
      conditions.push('(updated_at, id) < (?, ?)');
      params.push(decoded.updatedAt, decoded.id);
    }
    const [rows] = await this.#pool.query(
      `SELECT * FROM ai_conversations
       WHERE ${conditions.join(' AND ')}
       ORDER BY updated_at DESC, id DESC
       LIMIT ?`,
      [...params, limit + 1],
    );
    return buildPageMeta(rows.map(toConversationDomain), limit, (row) => ({
      updatedAt: row.updatedAt,
      id: row.id,
    }));
  }

  async touchUpdatedAt(id) {
    await this.#pool.query(
      `UPDATE ai_conversations SET updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?`,
      [id],
    );
  }

  async softDelete(id) {
    await this.#pool.query(
      `UPDATE ai_conversations SET deleted_at = CURRENT_TIMESTAMP(3) WHERE id = ?`,
      [id],
    );
  }
}

export default MySqlAiConversationRepository;
