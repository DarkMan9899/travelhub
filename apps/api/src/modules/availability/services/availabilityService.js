/**
 * AvailabilityService — public Service for the Availability & Calendar
 * Foundation module (Sprint 9, redesigned twice: first to build on
 * `bookable_units`/`availability_calendar` instead of `blackout_dates`,
 * then to make unit *existence* an explicit, inventory-agnostic decision
 * instead of an automatic side effect of writing a calendar entry).
 *
 * The `AvailabilityCheckService` slice of `BACKEND_ARCHITECTURE.md`'s
 * Module Catalog entry #15: owns `availability_calendar` read/write
 * directly, composes `BookableUnitService` (unit CRUD) and
 * `BlackoutService` (the complementary veto layer) rather than owning
 * their tables itself. Depends on `ListingService`'s public interface for
 * listing existence and visibility, exactly like Auth depends on
 * `UserService` — never a second Listings repository.
 *
 * **Availability is inventory-agnostic**: it never decides that a listing
 * *should* have a bookable unit, of what type, or how many. `registerUnit`/
 * `retireUnit` expose that capability, but only ever act in response to an
 * explicit caller request — today, a host calling this module's own API;
 * later, a per-type inventory module (Hotels, Tours, ...) calling the same
 * methods once it creates real inventory rows. `setAvailability` (the
 * calendar write path) *consumes* an existing `unitId` — it never creates
 * one, so a request against a unit that doesn't exist fails plainly rather
 * than silently provisioning one. Which listing types get one unit,
 * several, or none is a business rule that intentionally lives nowhere in
 * this file.
 *
 * This sprint's write path may only ever persist `AVAILABLE`/`BLOCKED`
 * calendar rows — `BOOKED`/`HELD` are reserved for the future Booking
 * Engine and are rejected outright (`UNWRITABLE_STATUS`). `reservation_
 * holds` is never read or written here. No `availability.*` permission
 * key exists yet (`seeds/004_roles_and_permissions.js`), so every
 * mutation and management list are gated on `listing.update` (owner
 * fallback) or `listing.moderate` (admin-wide), mirroring
 * `ListingService`'s own reuse of `listing.update` for media management.
 */

import {
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  NotFoundError,
} from '../../../errors/AppError.js';
import { isPartnerOwner } from '../../../infrastructure/database/repositories/partnerEmployeeRepository.js';
import {
  enumerateDates,
  expandCalendarDays,
} from '../../../core/domain/calendarExpansion.js';

const MANAGE_PERMISSION = 'listing.update';
const ADMIN_PERMISSION = 'listing.moderate';
const WRITABLE_STATUSES = Object.freeze(['AVAILABLE', 'BLOCKED']);
const PUBLIC_RANGES_LIMIT = 100;

function assertWritableStatus(status) {
  if (!WRITABLE_STATUSES.includes(status)) {
    throw new ValidationError(
      'Only AVAILABLE or BLOCKED may be set through this endpoint — BOOKED/HELD are reserved for the Booking Engine.',
      [{ field: 'status', issue: 'UNWRITABLE_STATUS' }],
    );
  }
}

export class AvailabilityService {
  #availabilityCalendarRepository;

  #bookableUnitService;

  #blackoutService;

  #listingService;

  #permissionResolver;

  constructor({
    availabilityCalendarRepository,
    bookableUnitService,
    blackoutService,
    listingService,
    permissionResolver,
  }) {
    this.#availabilityCalendarRepository = availabilityCalendarRepository;
    this.#bookableUnitService = bookableUnitService;
    this.#blackoutService = blackoutService;
    this.#listingService = listingService;
    this.#permissionResolver = permissionResolver;
  }

  async #isOwnerOrHasPermission(principal, partnerId, permissionKey) {
    if (!principal) return false;
    const isOwner = await isPartnerOwner(principal.userId, partnerId);
    if (isOwner) return true;
    return this.#permissionResolver.hasPermission(
      principal.roles,
      permissionKey,
    );
  }

  async #assertOwnerOrPermission(principal, partnerId, permissionKey) {
    if (!principal) throw new AuthenticationError();
    const allowed = await this.#isOwnerOrHasPermission(
      principal,
      partnerId,
      permissionKey,
    );
    if (!allowed) throw new AuthorizationError();
  }

  /** Loads the listing (`getListing`'s 404-masking applies) then asserts owner-or-`listing.update`. */
  async #loadListingForManagement(principal, listingId) {
    const listing = await this.#listingService.getListing(principal, listingId);
    await this.#assertOwnerOrPermission(
      principal,
      listing.partnerId,
      MANAGE_PERMISSION,
    );
    return listing;
  }

  async #assertListVisibility(principal, { listingId, partnerId }) {
    if (listingId !== undefined) {
      const listing = await this.#listingService.getListing(
        principal,
        listingId,
      );
      await this.#assertOwnerOrPermission(
        principal,
        listing.partnerId,
        MANAGE_PERMISSION,
      );
      return;
    }
    if (partnerId !== undefined) {
      await this.#assertOwnerOrPermission(
        principal,
        partnerId,
        ADMIN_PERMISSION,
      );
      return;
    }
    if (!principal) throw new AuthenticationError();
    const isAdmin = await this.#permissionResolver.hasPermission(
      principal.roles,
      ADMIN_PERMISSION,
    );
    if (!isAdmin) throw new AuthorizationError();
  }

  // --- bookable_units (inventory-agnostic capability: Availability owns the
  // table, but never decides on its own that a unit should exist — it is
  // only ever created in response to an explicit call, made today by the
  // host through this API, and in the future by a per-type inventory
  // module such as Hotels/Tours calling the exact same capability) ---

  async registerUnit(principal, input) {
    if (!principal) throw new AuthenticationError();
    const listing = await this.#loadListingForManagement(
      principal,
      input.listingId,
    );
    return this.#bookableUnitService.registerUnit({
      listingId: listing.id,
      bookableUnitTypeCode: input.bookableUnitType,
      capacity: input.capacity,
      createdBy: principal.userId,
    });
  }

  async retireUnit(principal, id) {
    if (!principal) throw new AuthenticationError();
    const unit = await this.#bookableUnitService.findById(id);
    if (!unit) throw new NotFoundError('Bookable unit not found.');
    await this.#loadListingForManagement(principal, unit.listingId);
    await this.#bookableUnitService.retireUnit(id, principal.userId);
  }

  async listUnits(principal, listingId) {
    await this.#loadListingForManagement(principal, listingId);
    return this.#bookableUnitService.listUnitsForListing(listingId);
  }

  // --- availability_calendar (the primary engine) ---

  /**
   * Consumes an existing `unitId` — it never creates one. If the unit
   * doesn't exist (or was never explicitly registered via `registerUnit`),
   * this fails plainly rather than provisioning one to make the request
   * succeed, keeping Availability inventory-agnostic.
   */
  async setAvailability(principal, input) {
    if (!principal) throw new AuthenticationError();
    const {
      unitId,
      dateFrom,
      dateTo,
      status = 'AVAILABLE',
      quantityAvailable,
    } = input;
    assertWritableStatus(status);

    const unit = await this.#bookableUnitService.findById(unitId);
    if (!unit) throw new NotFoundError('Bookable unit not found.');
    await this.#loadListingForManagement(principal, unit.listingId);

    const statusId =
      await this.#availabilityCalendarRepository.findStatusIdByCode(status);
    const dates = enumerateDates(dateFrom, dateTo);

    return this.#availabilityCalendarRepository.upsertRange({
      bookableUnitId: unit.id,
      dates,
      statusId,
      quantityAvailable,
    });
  }

  async updateCalendarEntry(principal, id, fields) {
    if (!principal) throw new AuthenticationError();
    const existing = await this.#availabilityCalendarRepository.findById(id);
    if (!existing) throw new NotFoundError('Calendar entry not found.');
    const unit = await this.#bookableUnitService.findById(
      existing.bookableUnitId,
    );
    if (!unit) throw new NotFoundError('Calendar entry not found.');
    await this.#loadListingForManagement(principal, unit.listingId);

    let statusId;
    if (fields.status !== undefined) {
      assertWritableStatus(fields.status);
      statusId = await this.#availabilityCalendarRepository.findStatusIdByCode(
        fields.status,
      );
    }

    return this.#availabilityCalendarRepository.update(id, {
      statusId,
      quantityAvailable: fields.quantityAvailable,
    });
  }

  async removeCalendarEntry(principal, id) {
    if (!principal) throw new AuthenticationError();
    const existing = await this.#availabilityCalendarRepository.findById(id);
    if (!existing) throw new NotFoundError('Calendar entry not found.');
    const unit = await this.#bookableUnitService.findById(
      existing.bookableUnitId,
    );
    if (!unit) throw new NotFoundError('Calendar entry not found.');
    await this.#loadListingForManagement(principal, unit.listingId);

    await this.#availabilityCalendarRepository.remove(id);
  }

  async listCalendarEntries(principal, filters = {}, paginationOpts = {}) {
    await this.#assertListVisibility(principal, filters);
    return this.#availabilityCalendarRepository.list(filters, paginationOpts);
  }

  // --- blackout_dates (the complementary veto layer) ---

  async createBlackout(principal, input) {
    if (!principal) throw new AuthenticationError();
    const listing = await this.#loadListingForManagement(
      principal,
      input.listingId,
    );
    return this.#blackoutService.createRange({
      listingId: listing.id,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      reason: input.reason,
      createdBy: principal.userId,
    });
  }

  async updateBlackout(principal, id, fields) {
    if (!principal) throw new AuthenticationError();
    const existing = await this.#blackoutService.findById(id);
    if (!existing) throw new NotFoundError('Blocked date range not found.');
    await this.#loadListingForManagement(principal, existing.listingId);
    return this.#blackoutService.updateRange(id, fields, principal.userId);
  }

  async deleteBlackout(principal, id) {
    if (!principal) throw new AuthenticationError();
    const existing = await this.#blackoutService.findById(id);
    if (!existing) throw new NotFoundError('Blocked date range not found.');
    await this.#loadListingForManagement(principal, existing.listingId);
    await this.#blackoutService.deleteRange(id);
  }

  async listBlackouts(principal, filters = {}, paginationOpts = {}) {
    await this.#assertListVisibility(principal, filters);
    return this.#blackoutService.listRanges(filters, paginationOpts);
  }

  // --- public views ---

  /** Public: a listing's blocked ranges, no `reason`/`id` (DTO strips them). */
  async getPublicRanges(principal, listingId) {
    await this.#listingService.getListing(principal, listingId);
    return this.#blackoutService.getRangesForListing(
      listingId,
      PUBLIC_RANGES_LIMIT,
    );
  }

  /**
   * Public day-by-day calendar merging `availability_calendar` (default
   * `AVAILABLE` where no row exists) with the `blackout_dates` veto.
   *
   * Unit resolution never guesses: zero units registered -> the whole
   * span is blackout-only (every day defaults to `AVAILABLE` unless
   * vetoed); exactly one unit -> used unambiguously; more than one ->
   * the caller must pass `unitId` explicitly, since "which calendar do
   * you mean" is a real question once multiple units exist and
   * Availability has no inventory-type knowledge to answer it on its own.
   */
  async getCalendar(principal, listingId, from, to, unitId) {
    await this.#listingService.getListing(principal, listingId);

    let resolvedUnitId = unitId;
    if (resolvedUnitId === undefined) {
      const units =
        await this.#bookableUnitService.listUnitsForListing(listingId);
      if (units.length > 1) {
        throw new ValidationError(
          'This listing has more than one bookable unit; specify unitId.',
          [{ field: 'unitId', issue: 'AMBIGUOUS_UNIT' }],
        );
      }
      resolvedUnitId = units[0]?.id;
    } else {
      const unit = await this.#bookableUnitService.findById(resolvedUnitId);
      if (!unit || unit.listingId !== listingId) {
        throw new NotFoundError('Bookable unit not found for this listing.');
      }
    }

    let calendarByDate = {};
    if (resolvedUnitId !== undefined) {
      const rows = await this.#availabilityCalendarRepository.listForUnit(
        resolvedUnitId,
        {
          from,
          to,
        },
      );
      calendarByDate = Object.fromEntries(
        rows.map((row) => [row.date, row.statusCode]),
      );
    }

    const blockedRanges = await this.#blackoutService.getActiveRangesForListing(
      listingId,
      {
        from,
        to,
      },
    );

    return expandCalendarDays(from, to, { calendarByDate, blockedRanges });
  }
}

export default AvailabilityService;
