/**
 * MySQL-backed Message Attachment repository — Phase 14 (Messaging
 * Platform). Reuses the existing polymorphic `media` table (migration
 * 0006) with `mediable_type='message'`, exactly the convention every
 * other module (`listings`, `users`) already follows for its own
 * attachments — never a new dedicated attachment table.
 *
 * Upload is two-step (see `messagingValidators.js`/`messageService.js`):
 * a file is uploaded before the message it belongs to exists, so `create`
 * parents the row to `mediable_type='conversation'` first; `attachToMessage`
 * re-parents it to `mediable_type='message'` once the message is created,
 * and only ever re-parents rows that are still pending for THIS
 * conversation — guarding against a caller attaching another
 * conversation's (or an already-attached) media row by guessing an id.
 */

import { getMysqlPool } from '../../../infrastructure/database/mysqlPool.js';
import { mapMysqlError } from '../../../infrastructure/database/errorMapping.js';

function toAttachmentDomain(row) {
  if (!row) return null;
  return {
    id: row.id,
    mediableType: row.mediable_type,
    mediableId: row.mediable_id,
    mediaTypeCode: row.media_type_code,
    url: row.url,
    mimeType: row.mime_type,
    fileSizeBytes: row.file_size_bytes,
    ownerUserId: row.owner_user_id,
    createdAt: row.created_at,
  };
}

const ATTACHMENT_SELECT = `
  m.id, m.mediable_type, m.mediable_id, mt.code AS media_type_code,
  m.url, m.mime_type, m.file_size_bytes, m.owner_user_id, m.created_at
`;

export class MySqlMessageAttachmentRepository {
  #pool;

  constructor(pool = getMysqlPool()) {
    this.#pool = pool;
  }

  async create(
    {
      conversationId,
      mediaTypeCode,
      url,
      mimeType,
      fileSizeBytes,
      ownerUserId,
    },
    connection = this.#pool,
  ) {
    const [[mediaType]] = await connection.query(
      'SELECT id FROM media_types WHERE code = ?',
      [mediaTypeCode],
    );
    const [[completedStatus]] = await connection.query(
      "SELECT id FROM media_upload_statuses WHERE code = 'COMPLETED'",
    );
    const [[pendingStatus]] = await connection.query(
      "SELECT id FROM moderation_statuses WHERE code = 'PENDING'",
    );

    try {
      const [result] = await connection.query(
        `INSERT INTO media
          (mediable_type, mediable_id, media_type_id, url, upload_status_id, moderation_status_id, mime_type, file_size_bytes, owner_user_id, created_by, updated_by)
         VALUES ('conversation', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          conversationId,
          mediaType.id,
          url,
          completedStatus.id,
          pendingStatus.id,
          mimeType,
          fileSizeBytes,
          ownerUserId,
          ownerUserId,
          ownerUserId,
        ],
      );
      return this.findById(result.insertId, connection);
    } catch (err) {
      throw mapMysqlError(err);
    }
  }

  async findById(id, connection = this.#pool) {
    const [rows] = await connection.query(
      `SELECT ${ATTACHMENT_SELECT} FROM media m
       JOIN media_types mt ON mt.id = m.media_type_id
       WHERE m.id = ? AND m.deleted_at IS NULL LIMIT 1`,
      [id],
    );
    return toAttachmentDomain(rows[0]);
  }

  /** Returns the number of rows actually re-parented (may be < mediaIds.length if some didn't belong to this conversation). */
  async attachToMessage(
    mediaIds,
    conversationId,
    messageId,
    connection = this.#pool,
  ) {
    if (mediaIds.length === 0) return 0;
    const placeholders = mediaIds.map(() => '?').join(', ');
    const [result] = await connection.query(
      `UPDATE media SET mediable_type = 'message', mediable_id = ?
       WHERE id IN (${placeholders}) AND mediable_type = 'conversation' AND mediable_id = ?`,
      [messageId, ...mediaIds, conversationId],
    );
    return result.affectedRows;
  }

  async listForMessages(messageIds, connection = this.#pool) {
    if (messageIds.length === 0) return [];
    const placeholders = messageIds.map(() => '?').join(', ');
    const [rows] = await connection.query(
      `SELECT ${ATTACHMENT_SELECT} FROM media m
       JOIN media_types mt ON mt.id = m.media_type_id
       WHERE m.mediable_type = 'message' AND m.mediable_id IN (${placeholders}) AND m.deleted_at IS NULL
       ORDER BY m.id ASC`,
      messageIds,
    );
    return rows.map(toAttachmentDomain);
  }
}

export default MySqlMessageAttachmentRepository;
