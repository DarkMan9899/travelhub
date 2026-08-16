/**
 * MySQL-backed Admin repository — Phase 11 Admin Platform.
 *
 * `getDashboardStats` is a pure read composed entirely from existing
 * tables (users, partners, listings, bookings, audit_logs) — no new
 * tables were needed for the dashboard itself. "Booking value" is
 * grouped by currency (never summed across currencies) since the
 * `currencies` table seeds AMD/USD/EUR — see `adminDto.js` for why this
 * is deliberately never labeled "revenue".
 */

import { getMysqlPool } from '../../../infrastructure/database/mysqlPool.js';

export class MySqlAdminRepository {
  #pool;

  constructor(pool = getMysqlPool()) {
    this.#pool = pool;
  }

  async getDashboardStats() {
    const [
      [[userCounts]],
      [[partnerCounts]],
      [[listingCounts]],
      [[bookingCounts]],
      [pendingPartners],
      [pendingListings],
      [pendingBookings],
      [bookingValueRows],
      [bookingsByDay],
      [recentActivity],
    ] = await Promise.all([
      this.#pool.query(
        `SELECT COUNT(*) AS total FROM users WHERE deleted_at IS NULL`,
      ),
      this.#pool.query(
        `SELECT COUNT(*) AS total FROM partners WHERE deleted_at IS NULL`,
      ),
      this.#pool.query(
        `SELECT COUNT(*) AS total,
                SUM(ls.code = 'PUBLISHED') AS published
         FROM listings l
         JOIN listing_statuses ls ON ls.id = l.status_id
         WHERE l.deleted_at IS NULL`,
      ),
      this.#pool.query(
        `SELECT COUNT(*) AS total,
                SUM(bs.code = 'COMPLETED') AS completed
         FROM bookings b
         JOIN booking_statuses bs ON bs.id = b.status_id`,
      ),
      this.#pool.query(
        `SELECT COUNT(*) AS total FROM partners p
         JOIN moderation_statuses ms ON ms.id = p.moderation_status_id
         WHERE p.deleted_at IS NULL AND ms.code = 'PENDING'`,
      ),
      this.#pool.query(
        `SELECT COUNT(*) AS total FROM listings l
         JOIN moderation_statuses ms ON ms.id = l.moderation_status_id
         WHERE l.deleted_at IS NULL AND ms.code = 'PENDING'`,
      ),
      this.#pool.query(
        `SELECT COUNT(*) AS total FROM bookings b
         JOIN booking_statuses bs ON bs.id = b.status_id
         WHERE bs.code = 'PENDING_VENDOR'`,
      ),
      this.#pool.query(
        `SELECT c.code AS currency_code, SUM(b.total_amount) AS total
         FROM bookings b
         JOIN booking_statuses bs ON bs.id = b.status_id
         JOIN currencies c ON c.id = b.currency_id
         WHERE bs.code IN ('CONFIRMED', 'COMPLETED')
         GROUP BY c.code`,
      ),
      this.#pool.query(
        `SELECT DATE(b.created_at) AS day, COUNT(*) AS total
         FROM bookings b
         WHERE b.created_at >= DATE_SUB(CURDATE(), INTERVAL 13 DAY)
         GROUP BY DATE(b.created_at)
         ORDER BY day ASC`,
      ),
      this.#pool.query(
        `SELECT al.action, al.target_type, al.target_id, al.created_at,
                u.first_name, u.last_name
         FROM audit_logs al
         LEFT JOIN users u ON u.id = al.actor_id
         ORDER BY al.created_at DESC, al.id DESC
         LIMIT 10`,
      ),
    ]);

    return {
      counts: {
        users: Number(userCounts.total),
        partners: Number(partnerCounts.total),
        listings: Number(listingCounts.total),
        publishedListings: Number(listingCounts.published ?? 0),
        bookings: Number(bookingCounts.total),
        completedBookings: Number(bookingCounts.completed ?? 0),
      },
      pendingActions: {
        pendingPartners: Number(pendingPartners[0].total),
        pendingListings: Number(pendingListings[0].total),
        pendingBookings: Number(pendingBookings[0].total),
      },
      bookingValueByCurrency: bookingValueRows.map((row) => ({
        currencyCode: row.currency_code,
        total: Number(row.total),
      })),
      bookingsByDay: bookingsByDay.map((row) => ({
        day:
          row.day instanceof Date
            ? row.day.toISOString().slice(0, 10)
            : row.day,
        total: Number(row.total),
      })),
      recentActivity: recentActivity.map((row) => ({
        action: row.action,
        targetType: row.target_type,
        targetId: row.target_id,
        createdAt: row.created_at,
        actorName:
          row.first_name || row.last_name
            ? `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim()
            : null,
      })),
    };
  }
}

export default MySqlAdminRepository;
