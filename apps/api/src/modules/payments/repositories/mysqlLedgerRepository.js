/**
 * MySQL-backed Ledger repository (Phase 16). Owns
 * `financial_ledger_entries` (migration 0024) — append-only platform
 * accounting. Deliberately exposes no "update balance" method: a
 * partner's payable balance is always computed on read
 * (`getPartnerBalance`), never cached, so it can never silently drift
 * from the entries that make it up.
 */

import { getMysqlPool } from '../../../infrastructure/database/mysqlPool.js';
import {
  decodeCursor,
  buildPageMeta,
} from '../../../infrastructure/database/pagination.js';

function toDomain(row) {
  if (!row) return null;
  return {
    id: row.id,
    entryType: row.entry_type,
    paymentId: row.payment_id,
    refundId: row.refund_id,
    bookingId: row.booking_id,
    partnerId: row.partner_id,
    amount: row.amount,
    currencyCode: row.currency_code,
    description: row.description,
    createdAt: row.created_at,
  };
}

const ENTRY_SELECT = `
  l.id, l.entry_type, l.payment_id, l.refund_id, l.booking_id, l.partner_id,
  l.amount, cur.code AS currency_code, l.description, l.created_at
`;
const ENTRY_FROM = `
  FROM financial_ledger_entries l
  JOIN currencies cur ON cur.id = l.currency_id
`;

export class MySqlLedgerRepository {
  #pool;

  constructor(pool = getMysqlPool()) {
    this.#pool = pool;
  }

  async create(
    {
      entryType,
      paymentId,
      refundId,
      bookingId,
      partnerId,
      amount,
      currencyId,
      description,
    },
    connection = this.#pool,
  ) {
    await connection.query(
      `INSERT INTO financial_ledger_entries
        (entry_type, payment_id, refund_id, booking_id, partner_id, amount, currency_id, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entryType,
        paymentId ?? null,
        refundId ?? null,
        bookingId ?? null,
        partnerId ?? null,
        amount,
        currencyId,
        description ?? null,
      ],
    );
  }

  async list(
    filters = {},
    { cursor = null, limit = 20 } = {},
    connection = this.#pool,
  ) {
    const conditions = ['1 = 1'];
    const params = [];

    if (filters.partnerId !== undefined) {
      conditions.push('l.partner_id = ?');
      params.push(filters.partnerId);
    }
    if (filters.entryType !== undefined) {
      conditions.push('l.entry_type = ?');
      params.push(filters.entryType);
    }

    const decoded = decodeCursor(cursor);
    if (decoded?.id) {
      conditions.push('l.id < ?');
      params.push(decoded.id);
    }

    const [rows] = await connection.query(
      `SELECT ${ENTRY_SELECT} ${ENTRY_FROM}
       WHERE ${conditions.join(' AND ')}
       ORDER BY l.id DESC
       LIMIT ?`,
      [...params, limit + 1],
    );

    const { rows: pageRows, meta } = buildPageMeta(rows, limit, (row) => ({
      id: row.id,
    }));
    return { rows: pageRows.map(toDomain), meta };
  }

  /**
   * A partner's payable balance, computed fresh from the ledger every
   * time — grouped by currency since a partner could in principle earn
   * in more than one currency (Phase 16 spec §2's multi-currency-ready
   * architecture, even though this marketplace is AMD-only today).
   */
  async getPartnerBalance(partnerId, connection = this.#pool) {
    const [rows] = await connection.query(
      `SELECT cur.code AS currency_code, SUM(l.amount) AS balance
       ${ENTRY_FROM}
       WHERE l.partner_id = ?
       GROUP BY cur.code`,
      [partnerId],
    );
    return rows.map((row) => ({
      currencyCode: row.currency_code,
      balance: row.balance,
    }));
  }
}

export default MySqlLedgerRepository;
