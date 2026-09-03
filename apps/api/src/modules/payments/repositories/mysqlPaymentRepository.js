/**
 * MySQL-backed Payment repository (Phase 16).
 *
 * Owns `payments`, `payment_attempts`, and `payment_transactions`
 * (migration 0024) — three tightly-coupled tables that only ever change
 * together within one payment's lifecycle, consolidated into one
 * repository the same way `mysqlBookingRepository.js` owns
 * `bookings`/`booking_items`/`booking_guests`/`booking_status_history`.
 *
 * Every write here is expected to run inside a caller-supplied
 * transaction connection (`PaymentService` opens one for every mutating
 * call) — but every method still defaults `connection` to the pool, same
 * convention as every other Repository in this codebase.
 */

import { getMysqlPool } from '../../../infrastructure/database/mysqlPool.js';
import { mapMysqlError } from '../../../infrastructure/database/errorMapping.js';
import {
  decodeCursor,
  buildPageMeta,
} from '../../../infrastructure/database/pagination.js';

function toPaymentDomain(row) {
  if (!row) return null;
  return {
    id: row.id,
    paymentReference: row.payment_reference,
    bookingId: row.booking_id,
    customerUserId: row.customer_user_id,
    partnerId: row.partner_id,
    providerCode: row.provider_code,
    providerPaymentId: row.provider_payment_id,
    statusId: row.status_id,
    statusCode: row.status_code,
    baseAmount: row.base_amount,
    feesAmount: row.fees_amount,
    taxAmount: row.tax_amount,
    discountAmount: row.discount_amount,
    totalAmount: row.total_amount,
    currencyCode: row.currency_code,
    capturedAmount: row.captured_amount,
    refundedAmount: row.refunded_amount,
    idempotencyKey: row.idempotency_key,
    failureCode: row.failure_code,
    failureMessage: row.failure_message,
    metadata:
      typeof row.metadata === 'string'
        ? JSON.parse(row.metadata)
        : row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    authorizedAt: row.authorized_at,
    succeededAt: row.succeeded_at,
    failedAt: row.failed_at,
    cancelledAt: row.cancelled_at,
    createdBy: row.created_by,
  };
}

const PAYMENT_SELECT = `
  p.id, p.payment_reference, p.booking_id, p.customer_user_id, p.partner_id,
  p.provider_code, p.provider_payment_id, p.status_id, pis.code AS status_code,
  p.base_amount, p.fees_amount, p.tax_amount, p.discount_amount, p.total_amount,
  cur.code AS currency_code, p.captured_amount, p.refunded_amount,
  p.idempotency_key, p.failure_code, p.failure_message, p.metadata,
  p.created_at, p.updated_at, p.authorized_at, p.succeeded_at, p.failed_at,
  p.cancelled_at, p.created_by
`;
const PAYMENT_FROM = `
  FROM payments p
  JOIN payment_intent_statuses pis ON pis.id = p.status_id
  JOIN currencies cur ON cur.id = p.currency_id
`;

export class MySqlPaymentRepository {
  #pool;

  constructor(pool = getMysqlPool()) {
    this.#pool = pool;
  }

  // --- lookups ---

  async findIntentStatusIdByCode(code, connection = this.#pool) {
    const [rows] = await connection.query(
      'SELECT id FROM payment_intent_statuses WHERE code = ? LIMIT 1',
      [code],
    );
    return rows[0]?.id ?? null;
  }

  // --- payments ---

  /**
   * Row-locks every non-terminal payment for a booking — must run inside
   * a transaction. This is the concurrency guard behind "at most one
   * active payment per booking": InnoDB's next-key locking on this query
   * blocks a concurrent transaction from inserting a conflicting row
   * until the first commits, even when zero rows currently match.
   */
  async findActiveForBooking(bookingId, connection) {
    const [rows] = await connection.query(
      `SELECT ${PAYMENT_SELECT} ${PAYMENT_FROM}
       WHERE p.booking_id = ? AND pis.code NOT IN ('FAILED', 'CANCELLED', 'REFUNDED')
       FOR UPDATE`,
      [bookingId],
    );
    return rows.map(toPaymentDomain);
  }

  /**
   * P0.2 (Master Roadmap): the payment (if any) for a booking that still
   * has real, captured money on it — `SUCCEEDED` or `PARTIALLY_REFUNDED`
   * — used by `BookingService#cancelBooking` to decide whether a
   * cancellation has money attached that a refund policy must resolve.
   * Most recent first: a booking can only ever have one non-terminal
   * payment at a time (`findActiveForBooking`'s own guard), but a prior
   * FAILED/CANCELLED attempt could still sit alongside a later
   * SUCCEEDED one, so this is not a bare `LIMIT 1` on booking_id alone.
   */
  async findRefundableForBooking(bookingId, connection = this.#pool) {
    const [rows] = await connection.query(
      `SELECT ${PAYMENT_SELECT} ${PAYMENT_FROM}
       WHERE p.booking_id = ? AND pis.code IN ('SUCCEEDED', 'PARTIALLY_REFUNDED')
       ORDER BY p.created_at DESC LIMIT 1`,
      [bookingId],
    );
    return toPaymentDomain(rows[0]);
  }

  /**
   * Manual-capture booking payment flow: the payment (if any) for a
   * booking that is authorized but not yet captured — used by
   * `BookingService#confirmBooking`/`#rejectBooking`/`#cancelBooking` to
   * find the authorization that a vendor decision must now capture or
   * void. A booking can only ever have one non-terminal payment at a time
   * (`findActiveForBooking`'s own guard), so `LIMIT 1` is always
   * unambiguous.
   */
  async findAuthorizedForBooking(bookingId, connection = this.#pool) {
    const [rows] = await connection.query(
      `SELECT ${PAYMENT_SELECT} ${PAYMENT_FROM}
       WHERE p.booking_id = ? AND pis.code = 'AUTHORIZED'
       ORDER BY p.created_at DESC LIMIT 1`,
      [bookingId],
    );
    return toPaymentDomain(rows[0]);
  }

  async findByIdempotencyKey(idempotencyKey, connection = this.#pool) {
    const [rows] = await connection.query(
      `SELECT ${PAYMENT_SELECT} ${PAYMENT_FROM} WHERE p.idempotency_key = ? LIMIT 1`,
      [idempotencyKey],
    );
    return toPaymentDomain(rows[0]);
  }

  async create(
    {
      paymentReference,
      bookingId,
      customerUserId,
      partnerId,
      providerCode,
      statusId,
      baseAmount,
      feesAmount,
      taxAmount,
      discountAmount,
      totalAmount,
      currencyId,
      idempotencyKey,
      metadata,
      createdBy,
    },
    connection = this.#pool,
  ) {
    try {
      const [result] = await connection.query(
        `INSERT INTO payments
          (payment_reference, booking_id, customer_user_id, partner_id, provider_code,
           status_id, base_amount, fees_amount, tax_amount, discount_amount, total_amount,
           currency_id, idempotency_key, metadata, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          paymentReference,
          bookingId,
          customerUserId,
          partnerId,
          providerCode,
          statusId,
          baseAmount,
          feesAmount,
          taxAmount,
          discountAmount,
          totalAmount,
          currencyId,
          idempotencyKey ?? null,
          metadata ? JSON.stringify(metadata) : null,
          createdBy ?? null,
        ],
      );
      return this.findById(result.insertId, connection);
    } catch (err) {
      throw mapMysqlError(err);
    }
  }

  async findById(id, connection = this.#pool) {
    const [rows] = await connection.query(
      `SELECT ${PAYMENT_SELECT} ${PAYMENT_FROM} WHERE p.id = ? LIMIT 1`,
      [id],
    );
    return toPaymentDomain(rows[0]);
  }

  /** Must run inside a transaction — `FOR UPDATE` outside one is meaningless. */
  async lockById(id, connection) {
    const [rows] = await connection.query(
      `SELECT ${PAYMENT_SELECT} ${PAYMENT_FROM} WHERE p.id = ? FOR UPDATE`,
      [id],
    );
    return toPaymentDomain(rows[0]);
  }

  /** Must run inside a transaction. Used by webhook processing, which only knows the provider's own payment id. */
  async lockByProviderPaymentId(providerCode, providerPaymentId, connection) {
    if (!providerPaymentId) return null;
    const [rows] = await connection.query(
      `SELECT ${PAYMENT_SELECT} ${PAYMENT_FROM}
       WHERE p.provider_code = ? AND p.provider_payment_id = ? FOR UPDATE`,
      [providerCode, providerPaymentId],
    );
    return toPaymentDomain(rows[0]);
  }

  /**
   * Stripe go-live preflight — transaction-boundary fix: atomically
   * reserves `amount` against the payment's refundable balance
   * (`captured_amount - refunded_amount`) in ONE statement, matching zero
   * rows if insufficient balance remains. This is the sole concurrency
   * guard for `#executeRefund`'s two-transaction split (validate+reserve
   * / call the provider / finalize) — no row lock needs to be held across
   * the provider network call, because the reservation already committed
   * to `refunded_amount` before that call ever starts, so a concurrent
   * second refund request's own reservation attempt correctly sees the
   * reduced balance. `releaseRefundAmount` undoes a reservation that
   * never actually succeeded with the provider (network failure, or a
   * definitive FAILED/CANCELLED result).
   */
  async reserveRefundAmount(id, amount, connection = this.#pool) {
    const [result] = await connection.query(
      `UPDATE payments
       SET refunded_amount = refunded_amount + ?
       WHERE id = ? AND (captured_amount - refunded_amount) >= ?`,
      [amount, id, amount],
    );
    return result.affectedRows > 0;
  }

  /** Undoes a reservation made by `reserveRefundAmount` — see its own doc comment. */
  async releaseRefundAmount(id, amount, connection = this.#pool) {
    await connection.query(
      'UPDATE payments SET refunded_amount = refunded_amount - ? WHERE id = ?',
      [amount, id],
    );
  }

  async updateStatus(
    id,
    {
      statusId,
      providerPaymentId,
      capturedAmount,
      refundedAmount,
      failureCode,
      failureMessage,
      authorizedAt,
      succeededAt,
      failedAt,
      cancelledAt,
    },
    connection = this.#pool,
  ) {
    const assignments = ['status_id = ?'];
    const values = [statusId];
    if (providerPaymentId !== undefined) {
      assignments.push('provider_payment_id = ?');
      values.push(providerPaymentId);
    }
    if (capturedAmount !== undefined) {
      assignments.push('captured_amount = ?');
      values.push(capturedAmount);
    }
    if (refundedAmount !== undefined) {
      assignments.push('refunded_amount = ?');
      values.push(refundedAmount);
    }
    if (failureCode !== undefined) {
      assignments.push('failure_code = ?');
      values.push(failureCode);
    }
    if (failureMessage !== undefined) {
      assignments.push('failure_message = ?');
      values.push(failureMessage);
    }
    if (authorizedAt !== undefined) {
      assignments.push('authorized_at = ?');
      values.push(authorizedAt);
    }
    if (succeededAt !== undefined) {
      assignments.push('succeeded_at = ?');
      values.push(succeededAt);
    }
    if (failedAt !== undefined) {
      assignments.push('failed_at = ?');
      values.push(failedAt);
    }
    if (cancelledAt !== undefined) {
      assignments.push('cancelled_at = ?');
      values.push(cancelledAt);
    }

    await connection.query(
      `UPDATE payments SET ${assignments.join(', ')} WHERE id = ?`,
      [...values, id],
    );
  }

  /** Visibility (customer/partner/admin scoping) is the Service's job — this is a plain filtered list. */
  async list(
    filters = {},
    { cursor = null, limit = 20 } = {},
    connection = this.#pool,
  ) {
    const conditions = ['1 = 1'];
    const params = [];

    if (filters.customerUserId !== undefined) {
      conditions.push('p.customer_user_id = ?');
      params.push(filters.customerUserId);
    }
    if (filters.partnerId !== undefined) {
      conditions.push('p.partner_id = ?');
      params.push(filters.partnerId);
    }
    if (filters.bookingId !== undefined) {
      conditions.push('p.booking_id = ?');
      params.push(filters.bookingId);
    }
    if (filters.statusCode !== undefined) {
      conditions.push('pis.code = ?');
      params.push(filters.statusCode);
    }
    if (filters.providerCode !== undefined) {
      conditions.push('p.provider_code = ?');
      params.push(filters.providerCode);
    }

    const decoded = decodeCursor(cursor);
    if (decoded?.id) {
      conditions.push('p.id < ?');
      params.push(decoded.id);
    }

    const [rows] = await connection.query(
      `SELECT ${PAYMENT_SELECT} ${PAYMENT_FROM}
       WHERE ${conditions.join(' AND ')}
       ORDER BY p.id DESC
       LIMIT ?`,
      [...params, limit + 1],
    );

    const { rows: pageRows, meta } = buildPageMeta(rows, limit, (row) => ({
      id: row.id,
    }));
    return { rows: pageRows.map(toPaymentDomain), meta };
  }

  // --- payment_attempts ---

  async createAttempt(
    {
      paymentId,
      attemptNumber,
      providerCode,
      providerRequestId,
      statusId,
      failureCode,
      failureMessage,
      rawProviderResponse,
    },
    connection = this.#pool,
  ) {
    const [result] = await connection.query(
      `INSERT INTO payment_attempts
        (payment_id, attempt_number, provider_code, provider_request_id, status_id,
         failure_code, failure_message, raw_provider_response)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        paymentId,
        attemptNumber,
        providerCode,
        providerRequestId ?? null,
        statusId,
        failureCode ?? null,
        failureMessage ?? null,
        rawProviderResponse ? JSON.stringify(rawProviderResponse) : null,
      ],
    );
    return result.insertId;
  }

  async countAttemptsForPayment(paymentId, connection = this.#pool) {
    const [rows] = await connection.query(
      'SELECT COUNT(*) AS count FROM payment_attempts WHERE payment_id = ?',
      [paymentId],
    );
    return rows[0]?.count ?? 0;
  }

  async listAttemptsForPayment(paymentId, connection = this.#pool) {
    const [rows] = await connection.query(
      `SELECT pa.id, pa.payment_id, pa.attempt_number, pa.provider_code,
              pa.provider_request_id, pis.code AS status_code, pa.failure_code,
              pa.failure_message, pa.raw_provider_response, pa.created_at
       FROM payment_attempts pa
       JOIN payment_intent_statuses pis ON pis.id = pa.status_id
       WHERE pa.payment_id = ?
       ORDER BY pa.attempt_number ASC`,
      [paymentId],
    );
    return rows.map((row) => ({
      id: row.id,
      paymentId: row.payment_id,
      attemptNumber: row.attempt_number,
      providerCode: row.provider_code,
      providerRequestId: row.provider_request_id,
      statusCode: row.status_code,
      failureCode: row.failure_code,
      failureMessage: row.failure_message,
      createdAt: row.created_at,
    }));
  }

  // --- payment_transactions (append-only audit trail) ---

  async createTransaction(
    { paymentId, refundId, type, amount, currencyId, actorId, metadata },
    connection = this.#pool,
  ) {
    await connection.query(
      `INSERT INTO payment_transactions
        (payment_id, refund_id, type, amount, currency_id, actor_id, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        paymentId,
        refundId ?? null,
        type,
        amount ?? null,
        currencyId ?? null,
        actorId ?? null,
        metadata ? JSON.stringify(metadata) : null,
      ],
    );
  }

  async listTransactionsForPayment(paymentId, connection = this.#pool) {
    const [rows] = await connection.query(
      `SELECT pt.id, pt.payment_id, pt.refund_id, pt.type, pt.amount,
              cur.code AS currency_code, pt.actor_id, pt.metadata, pt.created_at
       FROM payment_transactions pt
       LEFT JOIN currencies cur ON cur.id = pt.currency_id
       WHERE pt.payment_id = ?
       ORDER BY pt.id ASC`,
      [paymentId],
    );
    return rows.map((row) => ({
      id: row.id,
      paymentId: row.payment_id,
      refundId: row.refund_id,
      type: row.type,
      amount: row.amount,
      currencyCode: row.currency_code,
      actorId: row.actor_id,
      metadata:
        typeof row.metadata === 'string'
          ? JSON.parse(row.metadata)
          : row.metadata,
      createdAt: row.created_at,
    }));
  }
}

export default MySqlPaymentRepository;
