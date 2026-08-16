/**
 * Unit coverage for `PartnerAiService` is deliberately narrow: every
 * generation method's first step is the real `isPartnerOwner` DB check
 * (the same hard import `listingService.js` itself uses, which has no
 * unit test of its own for the identical reason) — ownership/permission
 * enforcement and prompt-grounding are covered end-to-end against a real
 * database in `tests/integration/ai/partnerAi.test.js` instead. This file
 * only covers the one branch that never reaches that DB call.
 */

import { describe, test, expect, jest } from '@jest/globals';
import { PartnerAiService } from '../../../../src/modules/ai/services/partnerAiService.js';
import { AuthenticationError } from '../../../../src/errors/AppError.js';

function buildService() {
  return new PartnerAiService({
    listingService: { getListing: jest.fn() },
    searchService: { searchCategories: jest.fn() },
    aiService: { complete: jest.fn() },
    permissionResolver: { hasPermission: jest.fn() },
  });
}

describe('PartnerAiService', () => {
  test.each([
    ['generateDescription'],
    ['generateSeo'],
    ['generateTitle'],
    ['generateAmenities'],
    ['translate'],
    ['generateFaqs'],
  ])('%s requires a principal', async (method) => {
    const service = buildService();
    await expect(service[method](null, 10)).rejects.toBeInstanceOf(
      AuthenticationError,
    );
  });
});
