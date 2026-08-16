import { describe, test, expect, jest } from '@jest/globals';
import { AiMemoryService } from '../../../../src/modules/ai/services/aiMemoryService.js';
import { AuthenticationError } from '../../../../src/errors/AppError.js';

function buildService() {
  const aiMemoryRepository = {
    listForUser: jest.fn().mockResolvedValue([{ key: 'a', value: 1 }]),
    get: jest.fn().mockResolvedValue({ key: 'a', value: 1 }),
    delete: jest.fn().mockResolvedValue(undefined),
    incrementCounter: jest.fn().mockResolvedValue(undefined),
  };
  const service = new AiMemoryService({ aiMemoryRepository });
  return { service, aiMemoryRepository };
}

const PRINCIPAL = { userId: 1, roles: ['CUSTOMER'] };

describe('AiMemoryService', () => {
  test('getMemoryForUser requires a principal and scopes to their own userId', async () => {
    const { service, aiMemoryRepository } = buildService();
    await expect(service.getMemoryForUser(null)).rejects.toBeInstanceOf(
      AuthenticationError,
    );
    await service.getMemoryForUser(PRINCIPAL);
    expect(aiMemoryRepository.listForUser).toHaveBeenCalledWith(1);
  });

  test('deleteMemoryKey requires a principal and scopes to their own userId', async () => {
    const { service, aiMemoryRepository } = buildService();
    await expect(service.deleteMemoryKey(null, 'a')).rejects.toBeInstanceOf(
      AuthenticationError,
    );
    await service.deleteMemoryKey(PRINCIPAL, 'a');
    expect(aiMemoryRepository.delete).toHaveBeenCalledWith(1, 'a');
  });

  test('recordDestinationAffinity/recordCategoryAffinity are system-facing — no principal required', async () => {
    const { service, aiMemoryRepository } = buildService();
    await service.recordDestinationAffinity(7, 'yerevan', 'Yerevan');
    await service.recordCategoryAffinity(7, 'hotel', 'Hotel');
    expect(aiMemoryRepository.incrementCounter).toHaveBeenCalledWith(
      7,
      'destination_affinity:yerevan',
      'Yerevan',
    );
    expect(aiMemoryRepository.incrementCounter).toHaveBeenCalledWith(
      7,
      'category_affinity:hotel',
      'Hotel',
    );
  });

  test('affinity recorders are no-ops when userId or code is missing', async () => {
    const { service, aiMemoryRepository } = buildService();
    await service.recordDestinationAffinity(null, 'yerevan', 'Yerevan');
    await service.recordCategoryAffinity(7, null, null);
    expect(aiMemoryRepository.incrementCounter).not.toHaveBeenCalled();
  });
});
