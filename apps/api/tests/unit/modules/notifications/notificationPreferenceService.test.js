import { describe, test, expect, jest } from '@jest/globals';
import { NotificationPreferenceService } from '../../../../src/modules/notifications/services/notificationPreferenceService.js';
import { ValidationError } from '../../../../src/errors/AppError.js';

function buildService(overrides = {}) {
  const preferenceRepository = {
    listCategoryCodes: jest
      .fn()
      .mockResolvedValue(['BOOKING', 'REVIEW', 'FAVORITE']),
    listForUser: jest.fn().mockResolvedValue([]),
    findForUserAndCategory: jest.fn().mockResolvedValue(null),
    upsert: jest.fn().mockResolvedValue({
      categoryCode: 'BOOKING',
      inAppEnabled: true,
      emailEnabled: false,
    }),
    ...overrides.preferenceRepository,
  };
  const service = new NotificationPreferenceService({ preferenceRepository });
  return { service, preferenceRepository };
}

describe('NotificationPreferenceService', () => {
  test('getPreferences defaults every category to enabled when no override exists', async () => {
    const { service } = buildService();
    const preferences = await service.getPreferences(1);
    expect(preferences).toEqual([
      { categoryCode: 'BOOKING', inAppEnabled: true, emailEnabled: true },
      { categoryCode: 'REVIEW', inAppEnabled: true, emailEnabled: true },
      { categoryCode: 'FAVORITE', inAppEnabled: true, emailEnabled: true },
    ]);
  });

  test('getPreferences uses a stored override where one exists', async () => {
    const { service } = buildService({
      preferenceRepository: {
        listForUser: jest.fn().mockResolvedValue([
          {
            categoryCode: 'BOOKING',
            inAppEnabled: true,
            emailEnabled: false,
          },
        ]),
      },
    });
    const preferences = await service.getPreferences(1);
    expect(preferences).toContainEqual({
      categoryCode: 'BOOKING',
      inAppEnabled: true,
      emailEnabled: false,
    });
  });

  test('updatePreference rejects an unknown category code', async () => {
    const { service } = buildService();
    await expect(
      service.updatePreference(1, 'NOT_REAL', {
        inAppEnabled: true,
        emailEnabled: true,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  test('updatePreference delegates to the repository for a known category', async () => {
    const { service, preferenceRepository } = buildService();
    await service.updatePreference(1, 'BOOKING', {
      inAppEnabled: true,
      emailEnabled: false,
    });
    expect(preferenceRepository.upsert).toHaveBeenCalledWith(1, 'BOOKING', {
      inAppEnabled: true,
      emailEnabled: false,
    });
  });

  test('isChannelEnabled defaults to true with no override row', async () => {
    const { service } = buildService();
    await expect(service.isChannelEnabled(1, 'BOOKING', 'EMAIL')).resolves.toBe(
      true,
    );
  });

  test('isChannelEnabled respects a stored disabled override', async () => {
    const { service } = buildService({
      preferenceRepository: {
        findForUserAndCategory: jest.fn().mockResolvedValue({
          categoryCode: 'BOOKING',
          inAppEnabled: true,
          emailEnabled: false,
        }),
      },
    });
    await expect(service.isChannelEnabled(1, 'BOOKING', 'EMAIL')).resolves.toBe(
      false,
    );
    await expect(
      service.isChannelEnabled(1, 'BOOKING', 'IN_APP'),
    ).resolves.toBe(true);
  });
});
