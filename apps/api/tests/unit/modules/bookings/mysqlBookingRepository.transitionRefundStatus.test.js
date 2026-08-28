/**
 * Launch-blocker remediation (P0-B) — unit-level proof of
 * `transitionRefundStatus`'s conditional-update semantics, isolated from
 * a real database via a fake connection (BACKEND_ARCHITECTURE.md §55:
 * unit tests never touch real infrastructure). This one gated SQL
 * statement is what makes every higher-level correctness property hold:
 * a failed refund (which never calls this method at all) leaves
 * `refund_status` untouched, an unrelated booking's refund_status can
 * never be corrupted (its current value won't match `fromStatus`), and a
 * duplicate/concurrent resolution attempt safely no-ops (the second call
 * finds `affectedRows === 0`).
 */

import { describe, test, expect, jest } from '@jest/globals';
import { MySqlBookingRepository } from '../../../../src/modules/bookings/repositories/mysqlBookingRepository.js';

function createRepository(queryImpl) {
  const repository = new MySqlBookingRepository({});
  const connection = { query: jest.fn(queryImpl) };
  return { repository, connection };
}

describe('MySqlBookingRepository#transitionRefundStatus (P0-B launch-blocker remediation)', () => {
  test('writes refund_status gated on the current value matching fromStatus, and reports true when a row was affected', async () => {
    const { repository, connection } = createRepository(async () => [
      { affectedRows: 1 },
    ]);

    const result = await repository.transitionRefundStatus(
      42,
      { fromStatus: 'REQUIRES_MANUAL_REVIEW', toStatus: 'MANUALLY_REFUNDED' },
      connection,
    );

    expect(result).toBe(true);
    expect(connection.query).toHaveBeenCalledWith(
      'UPDATE bookings SET refund_status = ? WHERE id = ? AND refund_status = ?',
      ['MANUALLY_REFUNDED', 42, 'REQUIRES_MANUAL_REVIEW'],
    );
  });

  test('reports false (a safe no-op) when the current refund_status did not match fromStatus', async () => {
    const { repository, connection } = createRepository(async () => [
      { affectedRows: 0 },
    ]);

    const result = await repository.transitionRefundStatus(
      42,
      { fromStatus: 'REQUIRES_MANUAL_REVIEW', toStatus: 'RESOLVED_NO_REFUND' },
      connection,
    );

    expect(result).toBe(false);
  });

  test('a second, duplicate call after the first succeeded reports false, not an error (idempotent)', async () => {
    let alreadyTransitioned = false;
    const { repository, connection } = createRepository(async (sql, params) => {
      const [, , fromStatus] = params;
      const affectedRows =
        !alreadyTransitioned && fromStatus === 'REQUIRES_MANUAL_REVIEW' ? 1 : 0;
      alreadyTransitioned = true;
      return [{ affectedRows }];
    });

    const first = await repository.transitionRefundStatus(
      7,
      { fromStatus: 'REQUIRES_MANUAL_REVIEW', toStatus: 'MANUALLY_REFUNDED' },
      connection,
    );
    const second = await repository.transitionRefundStatus(
      7,
      { fromStatus: 'REQUIRES_MANUAL_REVIEW', toStatus: 'MANUALLY_REFUNDED' },
      connection,
    );

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(connection.query).toHaveBeenCalledTimes(2);
  });
});
