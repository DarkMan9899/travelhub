/**
 * BlackoutService — public Service for `blackout_dates` (Module Catalog
 * #15). The **complementary veto layer**, not the primary availability
 * engine — `AvailabilityService` composes this alongside
 * `availability_calendar` when computing effective per-day status
 * (`BOOKING_ENGINE_ARCHITECTURE.md` §11.5).
 *
 * No listing existence/ownership checks here — `AvailabilityService`
 * (this Service's only caller) already resolves and authorizes the
 * listing before delegating, so this stays a focused CRUD + overlap-
 * detection Service over one table, mirroring the narrow-Service
 * precedent (e.g. `PartnerEmployeeService`-style single-table Services)
 * already used elsewhere in this codebase.
 */

import {
  ConflictError,
  ValidationError,
  NotFoundError,
} from '../../../errors/AppError.js';

export class BlackoutService {
  #blackoutRepository;

  constructor({ blackoutRepository }) {
    this.#blackoutRepository = blackoutRepository;
  }

  async #assertNoOverlap(listingId, dateFrom, dateTo, excludeId = null) {
    const overlaps = await this.#blackoutRepository.hasOverlap(
      listingId,
      dateFrom,
      dateTo,
      excludeId,
    );
    if (overlaps) {
      throw new ConflictError(
        'This date range overlaps an existing blocked range for this listing.',
        'OVERLAPPING_RANGE',
      );
    }
  }

  async findById(id) {
    return this.#blackoutRepository.findById(id);
  }

  async createRange({ listingId, dateFrom, dateTo, reason, createdBy }) {
    await this.#assertNoOverlap(listingId, dateFrom, dateTo);
    return this.#blackoutRepository.create({
      listingId,
      dateFrom,
      dateTo,
      reason,
      createdBy,
    });
  }

  async updateRange(id, fields, updatedBy) {
    const existing = await this.#blackoutRepository.findById(id);
    if (!existing) throw new NotFoundError('Blocked date range not found.');

    const nextDateFrom = fields.dateFrom ?? existing.dateFrom;
    const nextDateTo = fields.dateTo ?? existing.dateTo;
    if (nextDateTo < nextDateFrom) {
      throw new ValidationError('dateTo must not be before dateFrom.', [
        { field: 'dateTo', issue: 'BEFORE_DATE_FROM' },
      ]);
    }
    if (fields.dateFrom !== undefined || fields.dateTo !== undefined) {
      await this.#assertNoOverlap(
        existing.listingId,
        nextDateFrom,
        nextDateTo,
        id,
      );
    }

    return this.#blackoutRepository.update(id, {
      dateFrom: fields.dateFrom,
      dateTo: fields.dateTo,
      reason: fields.reason,
      updatedBy,
    });
  }

  async deleteRange(id) {
    await this.#blackoutRepository.remove(id);
  }

  /** Owner/admin management list — includes `reason`/`id`. */
  async listRanges(filters, paginationOpts) {
    return this.#blackoutRepository.list(filters, paginationOpts);
  }

  /** Public-safe: ranges only, no `reason`/`id` filtering is the DTO's job. */
  async getRangesForListing(listingId, limit) {
    const { rows } = await this.#blackoutRepository.list(
      { listingId },
      { limit },
    );
    return rows;
  }

  /** Blackout ranges overlapping `[from, to]`, for calendar veto computation. */
  async getActiveRangesForListing(listingId, { from, to }, connection) {
    return this.#blackoutRepository.listForListing(
      listingId,
      { from, to },
      connection,
    );
  }
}

export default BlackoutService;
