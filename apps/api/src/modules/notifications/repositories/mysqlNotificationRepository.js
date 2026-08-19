/**
 * MySQL-backed Notification repository — Phase 13 (Notifications
 * Center). Owns `notifications`/`notification_preferences` (migration
 * 0021).
 *
 * No rendered title/body is ever stored — `event_type` + `payload` JSON
 * only, matching this codebase's established rule that i18n owns every
 * user-facing label and the backend returns codes/structured data
 * (Phase 4.2). `category`/`priority` are resolved from their lookup
 * tables by code at write time, mirroring `mysqlReviewRepository.js`'s
 * `(SELECT id FROM moderation_statuses WHERE code = ?)` idiom.
 */

import { getMysqlPool } from '../../../infrastructure/database/mysqlPool.js';
import { mapMysqlError } from '../../../infrastructure/database/errorMapping.js';
import {
  decodeCursor,
  buildPageMeta,
} from '../../../infrastructure/database/pagination.js';

function toNotificationDomain(row) {
  if (!row) return null;
  return {
    id: row.id,
    recipientUserId: row.recipient_user_id,
    eventId: row.event_id,
    eventType: row.event_type,
    categoryCode: row.category_code,
    priorityCode: row.priority_code,
    actorId: row.actor_id,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    payload:
      typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
    metadata:
      typeof row.metadata === 'string'
        ? JSON.parse(row.metadata)
        : row.metadata,
    isRead: Boolean(row.is_read),
    readAt: row.read_at,
    isArchived: Boolean(row.is_archived),
    archivedAt: row.archived_at,
    isInAppVisible: Boolean(row.is_in_app_visible),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const NOTIFICATION_SELECT = `
  n.id, n.recipient_user_id, n.event_id, n.event_type,
  nc.code AS category_code, np.code AS priority_code,
  n.actor_id, n.resource_type, n.resource_id, n.payload, n.metadata,
  n.is_read, n.read_at, n.is_archived, n.archived_at, n.is_in_app_visible,
  n.created_at, n.updated_at
`;

export class MySqlNotificationRepository {
  #pool;

  constructor(pool = getMysqlPool()) {
    this.#pool = pool;
  }

  async findById(id, recipientUserId, connection = this.#pool) {
    const [rows] = await connection.query(
      `SELECT ${NOTIFICATION_SELECT}
       FROM notifications n
       JOIN notification_categories nc ON nc.id = n.category_id
       JOIN notification_priorities np ON np.id = n.priority_id
       WHERE n.id = ? AND n.recipient_user_id = ? AND n.deleted_at IS NULL
       LIMIT 1`,
      [id, recipientUserId],
    );
    return toNotificationDomain(rows[0]);
  }

  /**
   * Recipient-unscoped lookup — used only by the delivery worker
   * (`jobs/notificationDeliveryQueue.js`), which has a bare
   * `notificationId` from the queue job and no HTTP principal to scope
   * by. Never exposed through any controller/route.
   */
  async findByIdUnscoped(id, connection = this.#pool) {
    const [rows] = await connection.query(
      `SELECT ${NOTIFICATION_SELECT}
       FROM notifications n
       JOIN notification_categories nc ON nc.id = n.category_id
       JOIN notification_priorities np ON np.id = n.priority_id
       WHERE n.id = ? AND n.deleted_at IS NULL
       LIMIT 1`,
      [id],
    );
    return toNotificationDomain(rows[0]);
  }

  /** Idempotent by (event_id, recipient_user_id) — a republished event never creates a duplicate row. */
  async create(
    {
      recipientUserId,
      eventId = null,
      eventType,
      categoryCode,
      priorityCode,
      actorId = null,
      resourceType = null,
      resourceId = null,
      payload = {},
      metadata = {},
      isInAppVisible = true,
    },
    connection = this.#pool,
  ) {
    try {
      const [result] = await connection.query(
        `INSERT INTO notifications
           (recipient_user_id, event_id, event_type, category_id, priority_id,
            actor_id, resource_type, resource_id, payload, metadata, is_in_app_visible)
         VALUES (?, ?, ?,
           (SELECT id FROM notification_categories WHERE code = ?),
           (SELECT id FROM notification_priorities WHERE code = ?),
           ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE id = id`,
        [
          recipientUserId,
          eventId,
          eventType,
          categoryCode,
          priorityCode,
          actorId,
          resourceType,
          resourceId,
          JSON.stringify(payload),
          JSON.stringify(metadata),
          isInAppVisible ? 1 : 0,
        ],
      );
      // `result.insertId` is 0 on the ON DUPLICATE KEY no-op branch (and
      // `eventId` is NULL for announcements, which never dedups) — so a
      // fresh insert is looked up by insertId, the idempotent-skip case
      // by (eventId, recipientUserId).
      const id =
        result.insertId && result.insertId > 0
          ? result.insertId
          : (
              await connection.query(
                'SELECT id FROM notifications WHERE event_id = ? AND recipient_user_id = ? LIMIT 1',
                [eventId, recipientUserId],
              )
            )[0][0].id;
      return this.findById(id, recipientUserId, connection);
    } catch (err) {
      throw mapMysqlError(err);
    }
  }

  /**
   * Cursor-paginated. `status`: 'all' (default, excludes soft-deleted) |
   * 'unread' | 'archived'. `search` matches against `event_type` and a
   * raw-JSON substring match on `payload` (no rendered text exists to
   * search, so this is the honest search surface available).
   */
  async listForUser(
    recipientUserId,
    { status = 'all', categoryCode, search, cursor, limit } = {},
  ) {
    const decoded = decodeCursor(cursor);
    const conditions = [
      'n.recipient_user_id = ?',
      'n.deleted_at IS NULL',
      'n.is_in_app_visible = 1',
    ];
    const params = [recipientUserId];

    if (status === 'unread') {
      conditions.push('n.is_read = 0', 'n.is_archived = 0');
    } else if (status === 'archived') {
      conditions.push('n.is_archived = 1');
    }

    if (categoryCode) {
      conditions.push('nc.code = ?');
      params.push(categoryCode);
    }

    if (search) {
      conditions.push(
        '(n.event_type LIKE ? OR CAST(n.payload AS CHAR) LIKE ?)',
      );
      params.push(`%${search}%`, `%${search}%`);
    }

    if (
      decoded &&
      decoded.createdAt !== undefined &&
      decoded.id !== undefined
    ) {
      conditions.push('(n.created_at, n.id) < (?, ?)');
      params.push(decoded.createdAt, decoded.id);
    }

    const [rows] = await this.#pool.query(
      `SELECT ${NOTIFICATION_SELECT}
       FROM notifications n
       JOIN notification_categories nc ON nc.id = n.category_id
       JOIN notification_priorities np ON np.id = n.priority_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY n.created_at DESC, n.id DESC
       LIMIT ?`,
      [...params, limit + 1],
    );

    return buildPageMeta(rows.map(toNotificationDomain), limit, (row) => ({
      createdAt: row.createdAt,
      id: row.id,
    }));
  }

  async countUnread(recipientUserId) {
    const [rows] = await this.#pool.query(
      `SELECT COUNT(*) AS count FROM notifications
       WHERE recipient_user_id = ? AND is_read = 0 AND is_archived = 0
         AND is_in_app_visible = 1 AND deleted_at IS NULL`,
      [recipientUserId],
    );
    return rows[0].count;
  }

  async markRead(id, recipientUserId) {
    await this.#pool.query(
      `UPDATE notifications SET is_read = 1, read_at = CURRENT_TIMESTAMP(3)
       WHERE id = ? AND recipient_user_id = ? AND deleted_at IS NULL`,
      [id, recipientUserId],
    );
    return this.findById(id, recipientUserId);
  }

  async markAllRead(recipientUserId) {
    await this.#pool.query(
      `UPDATE notifications SET is_read = 1, read_at = CURRENT_TIMESTAMP(3)
       WHERE recipient_user_id = ? AND is_read = 0 AND deleted_at IS NULL`,
      [recipientUserId],
    );
  }

  async archive(id, recipientUserId) {
    await this.#pool.query(
      `UPDATE notifications SET is_archived = 1, archived_at = CURRENT_TIMESTAMP(3)
       WHERE id = ? AND recipient_user_id = ? AND deleted_at IS NULL`,
      [id, recipientUserId],
    );
    return this.findById(id, recipientUserId);
  }

  async softDelete(id, recipientUserId) {
    const [result] = await this.#pool.query(
      `UPDATE notifications SET deleted_at = CURRENT_TIMESTAMP(3)
       WHERE id = ? AND recipient_user_id = ? AND deleted_at IS NULL`,
      [id, recipientUserId],
    );
    return result.affectedRows > 0;
  }
}

export default MySqlNotificationRepository;
