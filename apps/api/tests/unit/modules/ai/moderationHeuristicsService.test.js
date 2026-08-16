import { describe, test, expect, jest } from '@jest/globals';
import { ModerationHeuristicsService } from '../../../../src/modules/ai/services/moderationHeuristicsService.js';

const PRINCIPAL = { userId: 1, roles: ['ADMIN'] };

function buildService(overrides = {}) {
  const listingService = {
    listListingsAdmin: jest.fn().mockResolvedValue({ rows: [], meta: {} }),
    getListingAdminDetail: jest.fn(),
    ...overrides.listingService,
  };
  const aiService = {
    complete: jest.fn().mockResolvedValue({
      content: 'Likely needs manual review.',
      providerCode: 'local',
      cacheHit: false,
    }),
    ...overrides.aiService,
  };
  const service = new ModerationHeuristicsService({
    listingService,
    aiService,
  });
  return { service, listingService, aiService };
}

describe('ModerationHeuristicsService', () => {
  describe('getModerationQueue', () => {
    test('flags near-duplicate titles from the same partner, never cross-partner', async () => {
      const { service, listingService } = buildService({
        listingService: {
          listListingsAdmin: jest.fn().mockResolvedValue({
            rows: [
              {
                id: 1,
                title: 'Cozy Downtown Apartment Yerevan',
                partnerId: 10,
                partnerDisplayName: 'Partner A',
              },
              {
                id: 2,
                title: 'Cozy Downtown Apartment in Yerevan',
                partnerId: 10,
                partnerDisplayName: 'Partner A',
              },
              {
                id: 3,
                title: 'Cozy Downtown Apartment Yerevan',
                partnerId: 20,
                partnerDisplayName: 'Partner B',
              },
            ],
            meta: {},
          }),
        },
      });

      const queue = await service.getModerationQueue(PRINCIPAL, { limit: 50 });

      expect(listingService.listListingsAdmin).toHaveBeenCalledWith(
        PRINCIPAL,
        {},
        { limit: 50 },
      );
      const entry1 = queue.find((e) => e.listingId === 1);
      const entry3 = queue.find((e) => e.listingId === 3);
      expect(entry1.signals).toContain('POSSIBLE_DUPLICATE_TITLE');
      expect(entry3).toBeUndefined();
    });

    test('flags an all-caps title as a spam signal', async () => {
      const { service } = buildService({
        listingService: {
          listListingsAdmin: jest.fn().mockResolvedValue({
            rows: [
              {
                id: 5,
                title: 'BEST DEAL EVER BOOK NOW',
                partnerId: 30,
                partnerDisplayName: 'Partner C',
              },
            ],
            meta: {},
          }),
        },
      });

      const queue = await service.getModerationQueue(PRINCIPAL, { limit: 50 });
      expect(queue).toHaveLength(1);
      expect(queue[0].signals).toContain('TITLE_ALL_CAPS');
      expect(queue[0].score).toBeGreaterThan(0);
    });

    test('a clean listing with no signals is excluded from the queue', async () => {
      const { service } = buildService({
        listingService: {
          listListingsAdmin: jest.fn().mockResolvedValue({
            rows: [
              {
                id: 7,
                title: 'Boutique Hotel Near the City Center',
                partnerId: 40,
                partnerDisplayName: 'Partner D',
              },
            ],
            meta: {},
          }),
        },
      });

      const queue = await service.getModerationQueue(PRINCIPAL, { limit: 50 });
      expect(queue).toHaveLength(0);
    });
  });

  describe('scoreListing', () => {
    test('combines title/description signals and layers an AI note on top of the real heuristic score', async () => {
      const { service, listingService, aiService } = buildService({
        listingService: {
          getListingAdminDetail: jest.fn().mockResolvedValue({
            id: 9,
            partnerId: 50,
            translations: [{ title: 'AMAZING DEAL!!!', description: 'Nice.' }],
          }),
          listListingsAdmin: jest
            .fn()
            .mockResolvedValue({ rows: [], meta: {} }),
        },
      });

      const result = await service.scoreListing(PRINCIPAL, 9);

      expect(listingService.getListingAdminDetail).toHaveBeenCalledWith(
        PRINCIPAL,
        9,
      );
      expect(result.signals).toEqual(
        expect.arrayContaining([
          'TITLE_ALL_CAPS',
          'EXCESSIVE_PUNCTUATION',
          'DESCRIPTION_TOO_SHORT',
        ]),
      );
      expect(result.heuristicScore).toBeGreaterThan(0);
      expect(aiService.complete).toHaveBeenCalledWith(
        expect.objectContaining({ featureCode: 'moderation' }),
      );
      expect(result.aiNote).toBe('Likely needs manual review.');
    });

    test('a listing with no real signals still stands alone on a zero heuristic score', async () => {
      const { service } = buildService({
        listingService: {
          getListingAdminDetail: jest.fn().mockResolvedValue({
            id: 11,
            partnerId: 60,
            translations: [
              {
                title: 'Charming Guest House With Garden View',
                description:
                  'A peaceful stay just minutes from the historic center.',
              },
            ],
          }),
          listListingsAdmin: jest
            .fn()
            .mockResolvedValue({ rows: [], meta: {} }),
        },
      });

      const result = await service.scoreListing(PRINCIPAL, 11);
      expect(result.signals).toEqual([]);
      expect(result.heuristicScore).toBe(0);
    });
  });
});
