/**
 * BookableUnitService — public Service for `bookable_units` (Module
 * Catalog #15). The extension seam a future Hotels/Tours module calls
 * directly (the same cross-module Service-dependency pattern as
 * `AvailabilityService` depending on `ListingService`) once it has real
 * inventory rows to register — passing real `sourceTable`/`sourceId`
 * instead of this sprint's own `registerUnit` default
 * (`sourceTable: 'listings'`, `sourceId: listingId`, an explicit,
 * documented placeholder for "the listing considered as its own single
 * unit," per the Sprint 9 plan).
 *
 * No ownership/visibility checks here — this Service is a thin, reusable
 * persistence seam; the caller (`AvailabilityService`, or a future
 * per-type module's own Service) is responsible for authorizing the
 * listing first, exactly like `ListingRepository` doesn't re-check
 * ownership either.
 */

import { ValidationError } from '../../../errors/AppError.js';

const DEFAULT_SOURCE_TABLE = 'listings';
const DEFAULT_CAPACITY = 1;

export class BookableUnitService {
  #bookableUnitRepository;

  constructor({ bookableUnitRepository }) {
    this.#bookableUnitRepository = bookableUnitRepository;
  }

  /**
   * Idempotent find-or-create keyed on `(listingId, bookableUnitTypeCode,
   * sourceTable, sourceId)`.
   */
  async registerUnit({
    listingId,
    bookableUnitTypeCode,
    capacity = DEFAULT_CAPACITY,
    sourceTable = DEFAULT_SOURCE_TABLE,
    sourceId,
    createdBy,
  }) {
    const resolvedSourceId = sourceId ?? listingId;

    const bookableUnitTypeId =
      await this.#bookableUnitRepository.findTypeIdByCode(bookableUnitTypeCode);
    if (!bookableUnitTypeId) {
      throw new ValidationError('Unknown bookable unit type.', [
        { field: 'bookableUnitType', issue: 'UNKNOWN_BOOKABLE_UNIT_TYPE' },
      ]);
    }

    const existing = await this.#bookableUnitRepository.findMatching({
      listingId,
      bookableUnitTypeId,
      sourceTable,
      sourceId: resolvedSourceId,
    });
    if (existing) return existing;

    return this.#bookableUnitRepository.create({
      listingId,
      bookableUnitTypeId,
      sourceTable,
      sourceId: resolvedSourceId,
      capacity,
      createdBy,
    });
  }

  async findById(id) {
    return this.#bookableUnitRepository.findById(id);
  }

  async listUnitsForListing(listingId) {
    return this.#bookableUnitRepository.listForListing(listingId);
  }

  async retireUnit(id, deletedBy) {
    await this.#bookableUnitRepository.softDelete(id, deletedBy);
  }
}

export default BookableUnitService;
