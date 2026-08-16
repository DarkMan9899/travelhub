import { describe, test, expect, jest } from '@jest/globals';
import { FavoriteService } from '../../../../src/modules/favorites/services/favoriteService.js';
import { AuthenticationError } from '../../../../src/errors/AppError.js';

const PRINCIPAL = { userId: 1, roles: ['CUSTOMER'] };

function buildService(overrides = {}) {
  const favoriteRepository = {
    add: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
    listListingIdsForCustomer: jest.fn().mockResolvedValue([]),
    listForCustomer: jest.fn().mockResolvedValue({ rows: [], meta: {} }),
    ...overrides.favoriteRepository,
  };
  const listingService = {
    getListing: jest.fn().mockResolvedValue({ id: 5, statusCode: 'PUBLISHED' }),
    ...overrides.listingService,
  };
  const service = new FavoriteService({ favoriteRepository, listingService });
  return { service, favoriteRepository, listingService };
}

describe('FavoriteService', () => {
  test('addFavorite verifies listing visibility then adds it', async () => {
    const { service, favoriteRepository, listingService } = buildService();
    await service.addFavorite(PRINCIPAL, 5);
    expect(listingService.getListing).toHaveBeenCalledWith(PRINCIPAL, 5);
    expect(favoriteRepository.add).toHaveBeenCalledWith(1, 5);
  });

  test('addFavorite propagates a NotFoundError for an invisible listing without adding it', async () => {
    const notFound = new Error('not found');
    const { service, favoriteRepository } = buildService({
      listingService: { getListing: jest.fn().mockRejectedValue(notFound) },
    });
    await expect(service.addFavorite(PRINCIPAL, 5)).rejects.toBe(notFound);
    expect(favoriteRepository.add).not.toHaveBeenCalled();
  });

  test('addFavorite throws AuthenticationError with no principal', async () => {
    const { service } = buildService();
    await expect(service.addFavorite(null, 5)).rejects.toBeInstanceOf(
      AuthenticationError,
    );
  });

  test('removeFavorite delegates to the repository', async () => {
    const { service, favoriteRepository } = buildService();
    await service.removeFavorite(PRINCIPAL, 5);
    expect(favoriteRepository.remove).toHaveBeenCalledWith(1, 5);
  });

  test('listFavoritedListingIds delegates to the repository', async () => {
    const { service, favoriteRepository } = buildService({
      favoriteRepository: {
        listListingIdsForCustomer: jest.fn().mockResolvedValue([5, 6]),
      },
    });
    const result = await service.listFavoritedListingIds(PRINCIPAL);
    expect(favoriteRepository.listListingIdsForCustomer).toHaveBeenCalledWith(
      1,
    );
    expect(result).toEqual([5, 6]);
  });

  test('listFavorites delegates to the repository with pagination options', async () => {
    const { service, favoriteRepository } = buildService();
    await service.listFavorites(PRINCIPAL, { cursor: 'abc', limit: 10 });
    expect(favoriteRepository.listForCustomer).toHaveBeenCalledWith(1, {
      cursor: 'abc',
      limit: 10,
    });
  });
});
