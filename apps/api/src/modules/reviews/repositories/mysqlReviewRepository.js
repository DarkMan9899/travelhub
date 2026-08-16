/**
 * MySQL-backed Review repository — Phase 12 (Product Polish: minimal
 * Reviews module). Owns `reviews` (migration 0009, unused until now).
 *
 * Reviews are auto-approved on submission (`status_id = 'APPROVED'`) —
 * this phase does not add an admin moderation UI for reviews (the
 * `review.moderate` permission already exists in the seed catalog for a
 * future phase to use), so gating a customer-written review behind an
 * unreachable PENDING queue would make it invisible forever. `vendor
 * response`/moderation columns stay available on the table for that
 * future phase.
 */

import { getMysqlPool } from '../../../infrastructure/database/mysqlPool.js';
import { mapMysqlError } from '../../../infrastructure/database/errorMapping.js';
import {
  decodeCursor,
  buildPageMeta,
} from '../../../infrastructure/database/pagination.js';

function toReviewDomain(row) {
  if (!row) return null;
  return {
    id: row.id,
    customerUserId: row.customer_user_id,
    bookingId: row.booking_id,
    listingId: row.listing_id,
    rating: row.rating,
    title: row.title,
    content: row.content,
    statusCode: row.status_code,
    vendorResponse: row.vendor_response,
    vendorRespondedAt: row.vendor_responded_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    customerDisplayName: row.customer_display_name ?? undefined,
  };
}

const REVIEW_SELECT = `
  rv.id, rv.customer_user_id, rv.booking_id, rv.listing_id, rv.rating,
  rv.title, rv.content, rs.code AS status_code,
  rv.vendor_response, rv.vendor_responded_at,
  rv.created_at, rv.updated_at
`;

export class MySqlReviewRepository {
  #pool;

  constructor(pool = getMysqlPool()) {
    this.#pool = pool;
  }

  async findByBookingId(bookingId, connection = this.#pool) {
    const [rows] = await connection.query(
      `SELECT ${REVIEW_SELECT}
       FROM reviews rv
       JOIN moderation_statuses rs ON rs.id = rv.status_id
       WHERE rv.booking_id = ? AND rv.deleted_at IS NULL
       LIMIT 1`,
      [bookingId],
    );
    return toReviewDomain(rows[0]);
  }

  async findById(id, connection = this.#pool) {
    const [rows] = await connection.query(
      `SELECT ${REVIEW_SELECT}
       FROM reviews rv
       JOIN moderation_statuses rs ON rs.id = rv.status_id
       WHERE rv.id = ? AND rv.deleted_at IS NULL
       LIMIT 1`,
      [id],
    );
    return toReviewDomain(rows[0]);
  }

  async create(
    { customerUserId, bookingId, listingId, rating, title, content },
    connection = this.#pool,
  ) {
    try {
      const [result] = await connection.query(
        `INSERT INTO reviews
           (customer_user_id, booking_id, listing_id, rating, title, content,
            status_id, created_by)
         VALUES (?, ?, ?, ?, ?, ?,
           (SELECT id FROM moderation_statuses WHERE code = 'APPROVED'), ?)`,
        [
          customerUserId,
          bookingId,
          listingId,
          rating,
          title ?? null,
          content ?? null,
          customerUserId,
        ],
      );
      return this.findById(result.insertId, connection);
    } catch (err) {
      throw mapMysqlError(err);
    }
  }

  /** Public, cursor-paginated: only ever APPROVED, non-deleted reviews, newest first. */
  async listByListingId(listingId, { cursor, limit } = {}) {
    const decoded = decodeCursor(cursor);
    const conditions = [
      'rv.listing_id = ?',
      "rs.code = 'APPROVED'",
      'rv.deleted_at IS NULL',
    ];
    const params = [listingId];
    if (
      decoded &&
      decoded.createdAt !== undefined &&
      decoded.id !== undefined
    ) {
      conditions.push('(rv.created_at, rv.id) < (?, ?)');
      params.push(decoded.createdAt, decoded.id);
    }

    const [rows] = await this.#pool.query(
      `SELECT ${REVIEW_SELECT}, CONCAT(u.first_name, ' ', u.last_name) AS customer_display_name
       FROM reviews rv
       JOIN moderation_statuses rs ON rs.id = rv.status_id
       JOIN users u ON u.id = rv.customer_user_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY rv.created_at DESC, rv.id DESC
       LIMIT ?`,
      [...params, limit + 1],
    );

    return buildPageMeta(rows.map(toReviewDomain), limit, (row) => ({
      createdAt: row.createdAt,
      id: row.id,
    }));
  }

  /** Bulk aggregate lookup — `SearchResultCard`/company-listing grids need one rating per row without an N+1. */
  async getSummariesForListingIds(listingIds) {
    if (listingIds.length === 0) return new Map();
    const placeholders = listingIds.map(() => '?').join(', ');
    const [rows] = await this.#pool.query(
      `SELECT rv.listing_id, AVG(rv.rating) AS rating_average, COUNT(*) AS review_count
       FROM reviews rv
       JOIN moderation_statuses rs ON rs.id = rv.status_id
       WHERE rv.listing_id IN (${placeholders}) AND rs.code = 'APPROVED' AND rv.deleted_at IS NULL
       GROUP BY rv.listing_id`,
      listingIds,
    );
    return new Map(
      rows.map((row) => [
        row.listing_id,
        {
          ratingAverage: Number(row.rating_average),
          reviewCount: row.review_count,
        },
      ]),
    );
  }

  async getSummaryForListingId(listingId) {
    const summaries = await this.getSummariesForListingIds([listingId]);
    return summaries.get(listingId) ?? { ratingAverage: null, reviewCount: 0 };
  }
}

export default MySqlReviewRepository;
