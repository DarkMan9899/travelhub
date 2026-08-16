/**
 * MySQL-backed Conversation repository — Phase 14 (Messaging Platform).
 * Owns `conversations`/`conversation_participants` (migration 0022).
 *
 * No "role" is ever stored per participant (see migration 0022's header
 * comment) — this repository only ever returns `user_id` for a
 * participant; role/permission resolution is the Service's job, using
 * the requester's live roles/partnerships.
 *
 * Unread count and last-message preview are correlated subqueries rather
 * than a second round-trip — mirrors how `mysqlSearchRepository.js`
 * already joins multiple derived aggregates in one query rather than
 * N+1ing them.
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
    contextType: row.context_type,
    contextId: row.context_id,
    createdBy: row.created_by,
    lastMessageAt: row.last_message_at,
    isArchived: Boolean(row.is_archived),
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.unread_count !== undefined && {
      unreadCount: Number(row.unread_count),
    }),
    ...(row.last_message_preview !== undefined && {
      lastMessagePreview: row.last_message_preview,
    }),
    ...(row.is_archived_for_participant !== undefined && {
      isArchivedForParticipant: Boolean(row.is_archived_for_participant),
    }),
    ...(row.last_read_message_id !== undefined && {
      lastReadMessageId: row.last_read_message_id,
    }),
  };
}

export class MySqlConversationRepository {
  #pool;

  constructor(pool = getMysqlPool()) {
    this.#pool = pool;
  }

  async create(
    { createdBy, contextType = null, contextId = null, participantUserIds },
    connection = this.#pool,
  ) {
    const [result] = await connection.query(
      `INSERT INTO conversations (context_type, context_id, created_by)
       VALUES (?, ?, ?)`,
      [contextType, contextId, createdBy],
    );
    const conversationId = result.insertId;

    const rows = participantUserIds.map((userId) => [conversationId, userId]);
    await connection.query(
      'INSERT INTO conversation_participants (conversation_id, user_id) VALUES ?',
      [rows],
    );

    return this.findById(conversationId, connection);
  }

  async findById(id, connection = this.#pool) {
    const [rows] = await connection.query(
      `SELECT id, context_type, context_id, created_by, last_message_at,
              is_archived, archived_at, created_at, updated_at
       FROM conversations WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
      [id],
    );
    return toConversationDomain(rows[0]);
  }

  /**
   * Same conversation row as `findById`, but enriched with the given
   * user's own participant fields (unread count, read cursor, personal
   * archive state) — the shape every write action (archive, mark-read)
   * should hand back to its own caller, since those fields are
   * inherently per-participant, not a property of the conversation
   * itself. `findById` alone is for `messaging.view_all` reads by a
   * non-participant, who has no such personal state to report.
   */
  async findByIdForUser(id, userId, connection = this.#pool) {
    const [rows] = await connection.query(
      `SELECT c.id, c.context_type, c.context_id, c.created_by,
              c.last_message_at, c.is_archived, c.archived_at,
              c.created_at, c.updated_at,
              cp.last_read_message_id, cp.is_archived_for_participant,
              (SELECT COUNT(*) FROM messages m
                 WHERE m.conversation_id = c.id AND m.deleted_at IS NULL
                 AND m.sender_user_id != ?
                 AND (cp.last_read_message_id IS NULL OR m.id > cp.last_read_message_id)
              ) AS unread_count,
              (SELECT m2.body FROM messages m2
                 WHERE m2.conversation_id = c.id AND m2.deleted_at IS NULL
                 ORDER BY m2.created_at DESC, m2.id DESC LIMIT 1
              ) AS last_message_preview
       FROM conversations c
       JOIN conversation_participants cp
         ON cp.conversation_id = c.id AND cp.user_id = ?
       WHERE c.id = ? AND c.deleted_at IS NULL LIMIT 1`,
      [userId, userId, id],
    );
    return toConversationDomain(rows[0]);
  }

  /**
   * Finds an existing conversation anchored to the given context (e.g.
   * `contextType='booking'`, `contextId=<bookingId>`) that the given user
   * already participates in — lets `ConversationService.createConversation`
   * reuse a "message the partner about this booking" thread instead of
   * spawning a duplicate one every time the entry point is clicked again.
   */
  async findByContextForUser(
    contextType,
    contextId,
    userId,
    connection = this.#pool,
  ) {
    const [rows] = await connection.query(
      `SELECT c.id FROM conversations c
       JOIN conversation_participants cp
         ON cp.conversation_id = c.id AND cp.user_id = ? AND cp.left_at IS NULL
       WHERE c.context_type = ? AND c.context_id = ? AND c.deleted_at IS NULL
       LIMIT 1`,
      [userId, contextType, contextId],
    );
    if (rows.length === 0) return null;
    return this.findByIdForUser(rows[0].id, userId, connection);
  }

  async isParticipant(conversationId, userId, connection = this.#pool) {
    const [rows] = await connection.query(
      `SELECT 1 FROM conversation_participants
       WHERE conversation_id = ? AND user_id = ? AND left_at IS NULL LIMIT 1`,
      [conversationId, userId],
    );
    return rows.length > 0;
  }

  async listParticipantUserIds(conversationId, connection = this.#pool) {
    const [rows] = await connection.query(
      `SELECT user_id FROM conversation_participants
       WHERE conversation_id = ? AND left_at IS NULL`,
      [conversationId],
    );
    return rows.map((row) => row.user_id);
  }

  /**
   * Batch participant DISPLAY profiles (name, avatar) for one or more
   * conversations — a read-enrichment join against `users`/`media`
   * (`users.avatar_media_id`), the same "join a foreign table purely to
   * enrich a response" convention `mysqlSearchRepository.js` already uses
   * for cities/regions/countries. Never used for access control — only
   * `isParticipant`/`listParticipantUserIds` are.
   */
  async listParticipantProfiles(conversationIds, connection = this.#pool) {
    if (conversationIds.length === 0) return [];
    const placeholders = conversationIds.map(() => '?').join(', ');
    const [rows] = await connection.query(
      `SELECT cp.conversation_id, u.id AS user_id, u.first_name, u.last_name,
              m.url AS avatar_url
       FROM conversation_participants cp
       JOIN users u ON u.id = cp.user_id
       LEFT JOIN media m ON m.id = u.avatar_media_id
       WHERE cp.conversation_id IN (${placeholders}) AND cp.left_at IS NULL`,
      conversationIds,
    );
    return rows.map((row) => ({
      conversationId: row.conversation_id,
      userId: row.user_id,
      firstName: row.first_name,
      lastName: row.last_name,
      avatarUrl: row.avatar_url,
    }));
  }

  /** Lightweight id-only list — used by MessageService.searchMessages to scope a body search, never for display. */
  async listConversationIdsForUser(userId, connection = this.#pool) {
    const [rows] = await connection.query(
      `SELECT conversation_id FROM conversation_participants
       WHERE user_id = ? AND left_at IS NULL`,
      [userId],
    );
    return rows.map((row) => row.conversation_id);
  }

  /**
   * Cursor-paginated, forward/"load more" direction (this is the
   * conversation LIST, not a message thread — the established Phase 13
   * list-pagination convention applies here unchanged; only the message
   * *thread* itself paginates backward, see `mysqlMessageRepository.js`).
   */
  async listForUser(userId, { status = 'all', search, cursor, limit } = {}) {
    const decoded = decodeCursor(cursor);
    const conditions = [
      'cp.user_id = ?',
      'cp.left_at IS NULL',
      'c.deleted_at IS NULL',
    ];
    const params = [userId, userId];

    if (status === 'archived') {
      conditions.push('cp.is_archived_for_participant = 1');
    } else {
      conditions.push('cp.is_archived_for_participant = 0');
    }

    if (search) {
      conditions.push(
        `EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = c.id
                 AND m.deleted_at IS NULL AND m.body LIKE ?)`,
      );
      params.push(`%${search}%`);
    }

    if (
      decoded &&
      decoded.lastMessageAt !== undefined &&
      decoded.id !== undefined
    ) {
      conditions.push(
        '(COALESCE(c.last_message_at, c.created_at), c.id) < (?, ?)',
      );
      params.push(decoded.lastMessageAt, decoded.id);
    }

    const [rows] = await this.#pool.query(
      `SELECT c.id, c.context_type, c.context_id, c.created_by,
              c.last_message_at, c.is_archived, c.archived_at,
              c.created_at, c.updated_at,
              cp.last_read_message_id, cp.is_archived_for_participant,
              (SELECT COUNT(*) FROM messages m
                 WHERE m.conversation_id = c.id AND m.deleted_at IS NULL
                 AND m.sender_user_id != ?
                 AND (cp.last_read_message_id IS NULL OR m.id > cp.last_read_message_id)
              ) AS unread_count,
              (SELECT m2.body FROM messages m2
                 WHERE m2.conversation_id = c.id AND m2.deleted_at IS NULL
                 ORDER BY m2.created_at DESC, m2.id DESC LIMIT 1
              ) AS last_message_preview
       FROM conversations c
       JOIN conversation_participants cp ON cp.conversation_id = c.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY COALESCE(c.last_message_at, c.created_at) DESC, c.id DESC
       LIMIT ?`,
      [...params, limit + 1],
    );

    return buildPageMeta(rows.map(toConversationDomain), limit, (row) => ({
      lastMessageAt: row.lastMessageAt ?? row.createdAt,
      id: row.id,
    }));
  }

  async markRead(
    conversationId,
    userId,
    lastReadMessageId,
    connection = this.#pool,
  ) {
    await connection.query(
      `UPDATE conversation_participants
       SET last_read_message_id = ?
       WHERE conversation_id = ? AND user_id = ?`,
      [lastReadMessageId, conversationId, userId],
    );
  }

  async countUnreadConversations(userId) {
    const [rows] = await this.#pool.query(
      `SELECT COUNT(*) AS count FROM (
         SELECT c.id
         FROM conversations c
         JOIN conversation_participants cp ON cp.conversation_id = c.id
         WHERE cp.user_id = ? AND cp.left_at IS NULL
           AND cp.is_archived_for_participant = 0 AND c.deleted_at IS NULL
           AND EXISTS (
             SELECT 1 FROM messages m
             WHERE m.conversation_id = c.id AND m.deleted_at IS NULL
               AND m.sender_user_id != ?
               AND (cp.last_read_message_id IS NULL OR m.id > cp.last_read_message_id)
           )
       ) AS unread_conversations`,
      [userId, userId],
    );
    return rows[0].count;
  }

  async setArchivedForParticipant(conversationId, userId, isArchived) {
    await this.#pool.query(
      `UPDATE conversation_participants
       SET is_archived_for_participant = ?, archived_at = ?
       WHERE conversation_id = ? AND user_id = ?`,
      [
        isArchived ? 1 : 0,
        isArchived ? new Date() : null,
        conversationId,
        userId,
      ],
    );
  }

  async touchLastMessageAt(conversationId, timestamp, connection = this.#pool) {
    await connection.query(
      `UPDATE conversations SET last_message_at = ? WHERE id = ?`,
      [timestamp, conversationId],
    );
  }

  async markArchived(conversationId, connection = this.#pool) {
    await connection.query(
      `UPDATE conversations SET is_archived = 1, archived_at = CURRENT_TIMESTAMP(3)
       WHERE id = ?`,
      [conversationId],
    );
    return this.findById(conversationId, connection);
  }
}

export default MySqlConversationRepository;
