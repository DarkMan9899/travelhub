/**
 * MySQL-backed Refund repository (Phase 16). Owns `refunds` (migration
 * 0024) — its own table/lifecycle, never a mutation of the `payments`
 * row it refunds (`mysqlPaymentRepository.js` owns that table).
 */

import { getMysqlPool } from '../../../infrastructure/database/mysqlPool.js';
import { mapMysqlError } from '../../../infrastructure/database/errorMapping.js';
import {
  decodeCursor,
  buildPageMeta,
} from '../../../infrastructure/database/pagination.js';

function toRefundDomain(row) {
  if (!row) return null;
  return {
    id: row.id,
    refundReference: row.refund_reference,
    paymentId: row.payment_id,
    amount: row.amount,
    currencyCode: row.currency_code,
    reason: row.reason,
    statusId: row.status_id,
    statusCode: row.status_code,
    providerCode: row.provider_code,
    providerRefundId: row.provider_refund_id,
    idempotencyKey: row.idempotency_key,
    failureCode: row.failure_code,
    failureMessage: row.failure_message,
    requestedBy: row.requested_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    succeededAt: row.succeeded_at,
    failedAt: row.failed_at,
  };
}

const REFUND_SELECT = `
  r.id, r.refund_reference, r.payment_id, r.amount, cur.code AS currency_code,
  r.reason, r.status_id, rs.code AS status_code, r.provider_code,
  r.provider_refund_id, r.idempotency_key, r.failure_code, r.failure_message,
  r.requested_by, r.created_at, r.updated_at, r.succeeded_at, r.failed_at
`;
const REFUND_FROM = `
  FROM refunds r
  JOIN refund_statuses rs ON rs.id = r.status_id
  JOIN currencies cur ON cur.id = r.currency_id
`;

export class MySqlRefundRepository {
  #pool;

  constructor(pool = getMysqlPool()) {
    this.#pool = pool;
  }

  async findRefundStatusIdByCode(code, connection = this.#pool) {
    const [rows] = await connection.query(
      'SELECT id FROM refund_statuses WHERE code = ? LIMIT 1',
      [code],
    );
    return rows[0]?.id ?? null;
  }

  async findByIdempotencyKey(idempotencyKey, connection = this.#pool) {
    const [rows] = await connection.query(
      `SELECT ${REFUND_SELECT} ${REFUND_FROM} WHERE r.idempotency_key = ? LIMIT 1`,
      [idempotencyKey],
    );
    return toRefundDomain(rows[0]);
  }

  async create(
    {
      refundReference,
      paymentId,
      amount,
      currencyId,
      reason,
      statusId,
      providerCode,
      idempotencyKey,
      requestedBy,
    },
    connection = this.#pool,
  ) {
    try {
      const [result] = await connection.query(
        `INSERT INTO refunds
          (refund_reference, payment_id, amount, currency_id, reason, status_id,
           provider_code, idempotency_key, requested_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          refundReference,
          paymentId,
          amount,
          currencyId,
          reason ?? null,
          statusId,
          providerCode,
          idempotencyKey ?? null,
          requestedBy ?? null,
        ],
      );
      return this.findById(result.insertId, connection);
    } catch (err) {
      throw mapMysqlError(err);
    }
  }

  async findById(id, connection = this.#pool) {
    const [rows] = await connection.query(
      `SELECT ${REFUND_SELECT} ${REFUND_FROM} WHERE r.id = ? LIMIT 1`,
      [id],
    );
    return toRefundDomain(rows[0]);
  }

  async updateStatus(
    id,
    {
      statusId,
      providerRefundId,
      failureCode,
      failureMessage,
      succeededAt,
      failedAt,
    },
    connection = this.#pool,
  ) {
    const assignments = ['status_id = ?'];
    const values = [statusId];
    if (providerRefundId !== undefined) {
      assignments.push('provider_refund_id = ?');
      values.push(providerRefundId);
    }
    if (failureCode !== undefined) {
      assignments.push('failure_code = ?');
      values.push(failureCode);
    }
    if (failureMessage !== undefined) {
      assignments.push('failure_message = ?');
      values.push(failureMessage);
    }
    if (succeededAt !== undefined) {
      assignments.push('succeeded_at = ?');
      values.push(succeededAt);
    }
    if (failedAt !== undefined) {
      assignments.push('failed_at = ?');
      values.push(failedAt);
    }

    await connection.query(
      `UPDATE refunds SET ${assignments.join(', ')} WHERE id = ?`,
      [...values, id],
    );
  }

  async listForPayment(paymentId, connection = this.#pool) {
    const [rows] = await connection.query(
      `SELECT ${REFUND_SELECT} ${REFUND_FROM} WHERE r.payment_id = ? ORDER BY r.id ASC`,
      [paymentId],
    );
    return rows.map(toRefundDomain);
  }

  async list(
    filters = {},
    { cursor = null, limit = 20 } = {},
    connection = this.#pool,
  ) {
    const conditions = ['1 = 1'];
    const params = [];

    if (filters.paymentId !== undefined) {
      conditions.push('r.payment_id = ?');
      params.push(filters.paymentId);
    }
    if (filters.statusCode !== undefined) {
      conditions.push('rs.code = ?');
      params.push(filters.statusCode);
    }

    const decoded = decodeCursor(cursor);
    if (decoded?.id) {
      conditions.push('r.id < ?');
      params.push(decoded.id);
    }

    const [rows] = await connection.query(
      `SELECT ${REFUND_SELECT} ${REFUND_FROM}
       WHERE ${conditions.join(' AND ')}
       ORDER BY r.id DESC
       LIMIT ?`,
      [...params, limit + 1],
    );

    const { rows: pageRows, meta } = buildPageMeta(rows, limit, (row) => ({
      id: row.id,
    }));
    return { rows: pageRows.map(toRefundDomain), meta };
  }
}

export default MySqlRefundRepository;
