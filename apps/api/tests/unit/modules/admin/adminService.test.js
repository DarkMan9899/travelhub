import { describe, test, expect, jest } from '@jest/globals';
import { AdminService } from '../../../../src/modules/admin/services/adminService.js';

describe('AdminService', () => {
  test('getDashboardStats delegates to the repository and returns its result unchanged', async () => {
    const stats = {
      counts: {
        users: 1,
        partners: 1,
        listings: 1,
        publishedListings: 1,
        bookings: 1,
        completedBookings: 0,
      },
      pendingActions: {
        pendingPartners: 0,
        pendingListings: 0,
        pendingBookings: 0,
      },
      bookingValueByCurrency: [{ currencyCode: 'AMD', total: 1000 }],
      bookingsByDay: [{ day: '2026-07-30', total: 1 }],
      recentActivity: [],
    };
    const adminRepository = {
      getDashboardStats: jest.fn().mockResolvedValue(stats),
    };
    const service = new AdminService({ adminRepository });

    const result = await service.getDashboardStats();

    expect(adminRepository.getDashboardStats).toHaveBeenCalledTimes(1);
    expect(result).toBe(stats);
  });
});
