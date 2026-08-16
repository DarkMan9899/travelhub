/**
 * ListingMetadataService — public Service backing `GET /listings/metadata`.
 *
 * Read-only, public (no auth/ownership check — this is category-scoped
 * catalog data, not a specific listing's private state, the same
 * visibility rule as `GET /search/filters`). No `auditLogger` dependency —
 * nothing here mutates anything.
 */

import { resolveLocaleIds } from '../../../infrastructure/database/repositories/languageRepository.js';

export class ListingMetadataService {
  #listingMetadataRepository;

  constructor({ listingMetadataRepository }) {
    this.#listingMetadataRepository = listingMetadataRepository;
  }

  async getMetadataForCategory(categoryId, locale) {
    const { localeId, defaultLocaleId } = await resolveLocaleIds(locale);
    return this.#listingMetadataRepository.getMetadataForCategory(categoryId, {
      localeId,
      defaultLocaleId,
    });
  }
}

export default ListingMetadataService;
