/**
 * MySQL-backed EmailDelivery repository — P0.3 (Master Roadmap). Owns
 * `email_deliveries` (migration 0029), an append-only log of every real
 * email send attempt — the "did this actually send?" question this
 * codebase previously had no answer to after the fact.
 */

import { getMysqlPool } from '../../../infrastructure/database/mysqlPool.js';

export class MySqlEmailDeliveryRepository {
  #pool;

  constructor(pool = getMysqlPool()) {
    this.#pool = pool;
  }

  async create(
    { notificationId, recipientEmail, provider, status, errorMessage },
    connection = this.#pool,
  ) {
    await connection.query(
      `INSERT INTO email_deliveries
        (notification_id, recipient_email, provider, status, error_message)
       VALUES (?, ?, ?, ?, ?)`,
      [notificationId, recipientEmail, provider, status, errorMessage ?? null],
    );
  }

  /** Most-recent-first — used to diagnose a specific notification's delivery history. */
  async listForNotification(notificationId, connection = this.#pool) {
    const [rows] = await connection.query(
      `SELECT id, notification_id, recipient_email, provider, status, error_message, created_at
       FROM email_deliveries WHERE notification_id = ? ORDER BY created_at DESC`,
      [notificationId],
    );
    return rows.map((row) => ({
      id: row.id,
      notificationId: row.notification_id,
      recipientEmail: row.recipient_email,
      provider: row.provider,
      status: row.status,
      errorMessage: row.error_message,
      createdAt: row.created_at,
    }));
  }
}

export default MySqlEmailDeliveryRepository;
