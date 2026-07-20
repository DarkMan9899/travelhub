/**
 * MySQL-backed Booking repository — Sprint 10 (Booking & Reservation
 * Holds Foundation).
 *
 * Owns `bookings`, `booking_items`, `booking_guests`, and
 * `booking_status_history` (Module Catalog #18), migrated in 0008 but
 * unused until now. Stays inside that migration's documented MVP,
 * no-payment-gateway model: `payment_method` is always `'offline'`,
 * `payment_status_id` only ever moves among the four already-seeded
 * values, no `payments`/`invoices` tables exist to write to.
 *
 * Every write here is expected to run inside a caller-supplied
 * transaction connection (`BookingService` opens one for every mutating
 * call, since a booking write always touches at least two of this
 * repository's four tables together) — but every method still defaults
 * `connection` to the pool, same convention as every other Repository in
 * this codebase, so simple reads (`GET /bookings/:id`) don't need a
 * transaction wrapped around them just to satisfy this signature.
 */

import { getMysqlPool } from '../../../infrastructure/database/mysqlPool.js';
import { mapMysqlError } from '../../../infrastructure/database/errorMapping.js';
import {
  decodeCursor,
  buildPageMeta,
} from '../../../infrastructure/database/pagination.js';
import { toDateString } from '../../../infrastructure/database/dateFormat.js';

function toBookingDomain(row) {
  if (!row) return null;
  return {
    id: row.id,
    bookingReference: row.booking_reference,
    customerUserId: row.customer_user_id,
    partnerId: row.partner_id,
    listingId: row.listing_id,
    bookingTypeCode: row.booking_type_code,
    statusId: row.status_id,
    statusCode: row.status_code,
    customerNotes: row.customer_notes,
    vendorNotes: row.vendor_notes,
    guestContactSnapshot:
      typeof row.guest_contact_snapshot === 'string'
        ? JSON.parse(row.guest_contact_snapshot)
        : row.guest_contact_snapshot,
    currencyCode: row.currency_code,
    subtotalAmount: row.subtotal_amount,
    feesAmount: row.fees_amount,
    discountAmount: row.discount_amount,
    totalAmount: row.total_amount,
    paymentMethod: row.payment_method,
    paymentStatusCode: row.payment_status_code,
    requestedAt: row.requested_at,
    confirmedAt: row.confirmed_at,
    rejectedAt: row.rejected_at,
    cancelledAt: row.cancelled_at,
    completedAt: row.completed_at,
    cancellationReason: row.cancellation_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toItemDomain(row) {
  return {
    id: row.id,
    bookingId: row.booking_id,
    bookableUnitId: row.bookable_unit_id,
    dateFrom: toDateString(row.date_from),
    dateTo: toDateString(row.date_to),
    quantity: row.quantity,
    unitPriceAmount: row.unit_price_amount,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toGuestDomain(row) {
  return {
    id: row.id,
    bookingItemId: row.booking_item_id,
    fullName: row.full_name,
    documentNumber: row.document_number,
  };
}

const BOOKING_SELECT = `
  b.id, b.booking_reference, b.customer_user_id, b.partner_id, b.listing_id,
  bt.code AS booking_type_code, b.status_id, bs.code AS status_code,
  b.customer_notes, b.vendor_notes, b.guest_contact_snapshot,
  cur.code AS currency_code, b.subtotal_amount, b.fees_amount, b.discount_amount, b.total_amount,
  b.payment_method, ps.code AS payment_status_code,
  b.requested_at, b.confirmed_at, b.rejected_at, b.cancelled_at, b.completed_at,
  b.cancellation_reason, b.created_at, b.updated_at
`;
const BOOKING_FROM = `
  FROM bookings b
  JOIN booking_types bt ON bt.id = b.booking_type_id
  JOIN booking_statuses bs ON bs.id = b.status_id
  JOIN currencies cur ON cur.id = b.currency_id
  JOIN payment_statuses ps ON ps.id = b.payment_status_id
`;

export class MySqlBookingRepository {
  #pool;

  constructor(pool = getMysqlPool()) {
    this.#pool = pool;
  }

  // --- lookups ---

  async findBookingTypeIdByCode(code, connection = this.#pool) {
    const [rows] = await connection.query(
      'SELECT id FROM booking_types WHERE code = ? LIMIT 1',
      [code],
    );
    return rows[0]?.id ?? null;
  }

  async findStatusIdByCode(code, connection = this.#pool) {
    const [rows] = await connection.query(
      'SELECT id FROM booking_statuses WHERE code = ? LIMIT 1',
      [code],
    );
    return rows[0]?.id ?? null;
  }

  async findPaymentStatusIdByCode(code, connection = this.#pool) {
    const [rows] = await connection.query(
      'SELECT id FROM payment_statuses WHERE code = ? LIMIT 1',
      [code],
    );
    return rows[0]?.id ?? null;
  }

  // --- bookings ---

  async createBooking(
    {
      bookingReference,
      customerUserId,
      partnerId,
      listingId,
      bookingTypeId,
      statusId,
      customerNotes,
      guestContactSnapshot,
      currencyId,
      subtotalAmount,
      totalAmount,
      paymentStatusId,
      requestedAt,
      createdBy,
    },
    connection = this.#pool,
  ) {
    try {
      const [result] = await connection.query(
        `INSERT INTO bookings
          (booking_reference, customer_user_id, partner_id, listing_id, booking_type_id, status_id,
           customer_notes, guest_contact_snapshot, currency_id, subtotal_amount, fees_amount,
           discount_amount, total_amount, payment_method, payment_status_id, requested_at,
           created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0.00, 0.00, ?, 'offline', ?, ?, ?, ?)`,
        [
          bookingReference,
          customerUserId,
          partnerId,
          listingId,
          bookingTypeId,
          statusId,
          customerNotes ?? null,
          JSON.stringify(guestContactSnapshot),
          currencyId,
          subtotalAmount,
          totalAmount,
          paymentStatusId,
          requestedAt,
          createdBy,
          createdBy,
        ],
      );
      return this.findById(result.insertId, connection);
    } catch (err) {
      throw mapMysqlError(err);
    }
  }

  async findById(id, connection = this.#pool) {
    const [rows] = await connection.query(
      `SELECT ${BOOKING_SELECT} ${BOOKING_FROM} WHERE b.id = ? AND b.deleted_at IS NULL LIMIT 1`,
      [id],
    );
    return toBookingDomain(rows[0]);
  }

  /** Row-locks the booking for a status transition — must run inside a transaction (no pool default: `FOR UPDATE` outside a transaction is meaningless). */
  async lockById(id, connection) {
    const [rows] = await connection.query(
      `SELECT ${BOOKING_SELECT} ${BOOKING_FROM} WHERE b.id = ? AND b.deleted_at IS NULL FOR UPDATE`,
      [id],
    );
    return toBookingDomain(rows[0]);
  }

  async updateStatus(
    id,
    {
      statusId,
      confirmedAt,
      rejectedAt,
      cancelledAt,
      completedAt,
      cancellationReason,
    },
    connection = this.#pool,
  ) {
    const assignments = ['status_id = ?'];
    const values = [statusId];
    if (confirmedAt !== undefined) {
      assignments.push('confirmed_at = ?');
      values.push(confirmedAt);
    }
    if (rejectedAt !== undefined) {
      assignments.push('rejected_at = ?');
      values.push(rejectedAt);
    }
    if (cancelledAt !== undefined) {
      assignments.push('cancelled_at = ?');
      values.push(cancelledAt);
    }
    if (completedAt !== undefined) {
      assignments.push('completed_at = ?');
      values.push(completedAt);
    }
    if (cancellationReason !== undefined) {
      assignments.push('cancellation_reason = ?');
      values.push(cancellationReason);
    }

    await connection.query(
      `UPDATE bookings SET ${assignments.join(', ')} WHERE id = ?`,
      [...values, id],
    );
  }

  /** Owner/admin/customer visibility is the Service's job — this is a plain filtered list. */
  async list(
    filters = {},
    { cursor = null, limit = 20 } = {},
    connection = this.#pool,
  ) {
    const conditions = ['b.deleted_at IS NULL'];
    const params = [];

    if (filters.customerUserId !== undefined) {
      conditions.push('b.customer_user_id = ?');
      params.push(filters.customerUserId);
    }
    if (filters.partnerId !== undefined) {
      conditions.push('b.partner_id = ?');
      params.push(filters.partnerId);
    }

    const decoded = decodeCursor(cursor);
    if (decoded?.id) {
      conditions.push('b.id < ?');
      params.push(decoded.id);
    }

    const [rows] = await connection.query(
      `SELECT ${BOOKING_SELECT} ${BOOKING_FROM}
       WHERE ${conditions.join(' AND ')}
       ORDER BY b.id DESC
       LIMIT ?`,
      [...params, limit + 1],
    );

    const { rows: pageRows, meta } = buildPageMeta(rows, limit, (row) => ({
      id: row.id,
    }));
    return { rows: pageRows.map(toBookingDomain), meta };
  }

  // --- booking_items ---

  async createBookingItem(
    { bookingId, bookableUnitId, dateFrom, dateTo, quantity, unitPriceAmount },
    connection = this.#pool,
  ) {
    const [result] = await connection.query(
      `INSERT INTO booking_items
        (booking_id, bookable_unit_id, date_from, date_to, quantity, unit_price_amount)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [bookingId, bookableUnitId, dateFrom, dateTo, quantity, unitPriceAmount],
    );
    return result.insertId;
  }

  async findItemsForBooking(bookingId, connection = this.#pool) {
    const [rows] = await connection.query(
      'SELECT * FROM booking_items WHERE booking_id = ? ORDER BY id ASC',
      [bookingId],
    );
    return rows.map(toItemDomain);
  }

  // --- booking_guests ---

  async createBookingGuest(
    { bookingItemId, fullName, documentNumber },
    connection = this.#pool,
  ) {
    const [result] = await connection.query(
      `INSERT INTO booking_guests (booking_item_id, full_name, document_number)
       VALUES (?, ?, ?)`,
      [bookingItemId, fullName, documentNumber ?? null],
    );
    return result.insertId;
  }

  async findGuestsForBookingItems(bookingItemIds, connection = this.#pool) {
    if (bookingItemIds.length === 0) return [];
    const placeholders = bookingItemIds.map(() => '?').join(', ');
    const [rows] = await connection.query(
      `SELECT * FROM booking_guests WHERE booking_item_id IN (${placeholders}) ORDER BY id ASC`,
      bookingItemIds,
    );
    return rows.map(toGuestDomain);
  }

  // --- booking_status_history ---

  async createStatusHistory(
    { bookingId, fromStatusId, toStatusId, changedBy },
    connection = this.#pool,
  ) {
    await connection.query(
      `INSERT INTO booking_status_history (booking_id, from_status_id, to_status_id, changed_by)
       VALUES (?, ?, ?, ?)`,
      [bookingId, fromStatusId ?? null, toStatusId, changedBy ?? null],
    );
  }

  async findStatusHistoryForBooking(bookingId, connection = this.#pool) {
    const [rows] = await connection.query(
      `SELECT bh.id, bh.booking_id, fs.code AS from_status_code, ts.code AS to_status_code,
              bh.changed_by, bh.created_at
       FROM booking_status_history bh
       LEFT JOIN booking_statuses fs ON fs.id = bh.from_status_id
       JOIN booking_statuses ts ON ts.id = bh.to_status_id
       WHERE bh.booking_id = ?
       ORDER BY bh.id ASC`,
      [bookingId],
    );
    return rows;
  }

  /** Bookings still `PENDING_VENDOR` past their SLA window — the scheduled expiry sweep's read. */
  async findPendingVendorPastSla(slaHours, limit, connection = this.#pool) {
    const [rows] = await connection.query(
      `SELECT ${BOOKING_SELECT} ${BOOKING_FROM}
       WHERE bs.code = 'PENDING_VENDOR' AND b.deleted_at IS NULL
         AND b.requested_at <= DATE_SUB(UTC_TIMESTAMP(3), INTERVAL ? HOUR)
       ORDER BY b.requested_at ASC
       LIMIT ?`,
      [slaHours, limit],
    );
    return rows.map(toBookingDomain);
  }
}

export default MySqlBookingRepository;
