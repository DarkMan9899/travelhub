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
 * The public `/availability` write path may only ever persist
 * `AVAILABLE`/`BLOCKED` calendar rows — `BOOKED`/`HELD` are reserved for
 * the Booking Engine and are rejected outright (`UNWRITABLE_STATUS`).
 * This is unchanged by Sprint 10: `reserveCapacity`/`releaseHold`/
 * `consumeHold` (below) never write `status_id` at all — capacity for a
 * held or booked date is tracked entirely through `quantity_available`,
 * so the write-guard this file already enforced needed no relaxation.
 * No `availability.*` permission key exists yet (`seeds/
 * 004_roles_and_permissions.js`), so every mutation and management list
 * are gated on `listing.update` (owner fallback) or `listing.moderate`
 * (admin-wide), mirroring `ListingService`'s own reuse of
 * `listing.update` for media management.
 *
 * **Sprint 10 addition**: `reserveCapacity`/`releaseHold`/`consumeHold`
 * are new, additive capabilities over `reservation_holds` (owned here,
 * same as the other three tables) and `availability_calendar.
 * quantity_available` — called only by the `booking-holds`/`bookings`
 * modules as a Service-to-Service dependency, never exposed as new HTTP
 * routes on `/availability`. Availability still never decides, on its
 * own initiative, that a unit should be held or booked — it only ever
 * acts on an explicit caller request, the same inventory-agnostic rule
 * `registerUnit` already established.
 */

import {
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  ValidationError,
  NotFoundError,
} from '../../../errors/AppError.js';
import { isPartnerOwner } from '../../../infrastructure/database/repositories/partnerEmployeeRepository.js';
import { findCurrencyByCode } from '../../../infrastructure/database/repositories/currencyRepository.js';
import { withTransaction } from '../../../infrastructure/database/transaction.js';
import {
  enumerateDates,
  expandCalendarDays,
  isVetoedByBlackout,
} from '../../../core/domain/calendarExpansion.js';

const MANAGE_PERMISSION = 'listing.update';
const ADMIN_PERMISSION = 'listing.moderate';
const WRITABLE_STATUSES = Object.freeze(['AVAILABLE', 'BLOCKED']);
const PUBLIC_RANGES_LIMIT = 100;
const EXPIRY_SWEEP_BATCH_SIZE = 200;

function assertWritableStatus(status) {
  if (!WRITABLE_STATUSES.includes(status)) {
    throw new ValidationError(
      'Only AVAILABLE or BLOCKED may be set through this endpoint — BOOKED/HELD are reserved for the Booking Engine.',
      [{ field: 'status', issue: 'UNWRITABLE_STATUS' }],
    );
  }
}

/** Groups hold rows sharing one (unit, date range) so their capacity is restored in one update per date, not one per row. */
function groupHoldsByRange(holds) {
  const groups = new Map();
  holds.forEach((hold) => {
    const key = `${hold.bookableUnitId}:${hold.dateFrom}:${hold.dateTo}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      groups.set(key, {
        bookableUnitId: hold.bookableUnitId,
        dateFrom: hold.dateFrom,
        dateTo: hold.dateTo,
        count: 1,
      });
    }
  });
  return [...groups.values()];
}

export class AvailabilityService {
  #availabilityCalendarRepository;

  #reservationHoldRepository;

  #bookableUnitService;

  #blackoutService;

  #listingService;

  #permissionResolver;

  constructor({
    availabilityCalendarRepository,
    reservationHoldRepository,
    bookableUnitService,
    blackoutService,
    listingService,
    permissionResolver,
  }) {
    this.#availabilityCalendarRepository = availabilityCalendarRepository;
    this.#reservationHoldRepository = reservationHoldRepository;
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

  /**
   * Internal, unauthorized read of a unit's own attributes (listingId,
   * bookableUnitTypeCode, capacity) — Sprint 10's `BookingService` uses
   * this to resolve which listing/partner/unit-type a hold's unit belongs
   * to, then performs its own ownership/visibility checks via
   * `ListingService`. Not exposed as an HTTP route; a cross-module Service
   * call only, same as `BookableUnitService` itself has no ownership
   * check (its caller is responsible for authorizing first).
   */
  async getUnitById(id) {
    const unit = await this.#bookableUnitService.findById(id);
    if (!unit) throw new NotFoundError('Bookable unit not found.');
    return unit;
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
      priceOverrideAmount,
      priceOverrideCurrency,
    } = input;
    assertWritableStatus(status);

    const unit = await this.#bookableUnitService.findById(unitId);
    if (!unit) throw new NotFoundError('Bookable unit not found.');
    await this.#loadListingForManagement(principal, unit.listingId);

    const statusId =
      await this.#availabilityCalendarRepository.findStatusIdByCode(status);
    const dates = enumerateDates(dateFrom, dateTo);
    const priceOverrideCurrencyId = await this.#resolveCurrencyId(
      priceOverrideCurrency,
    );

    return this.#availabilityCalendarRepository.upsertRange({
      bookableUnitId: unit.id,
      dates,
      statusId,
      quantityAvailable,
      priceOverrideAmount,
      priceOverrideCurrencyId,
    });
  }

  /** Resolves a client-supplied currency code to its id, or `undefined` when none was supplied. */
  async #resolveCurrencyId(currencyCode) {
    if (currencyCode === undefined) return undefined;
    const currency = await findCurrencyByCode(currencyCode);
    if (!currency) {
      throw new ValidationError('Unknown currency code.', [
        { field: 'priceOverrideCurrency', issue: 'UNKNOWN_CURRENCY' },
      ]);
    }
    return currency.id;
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
    const priceOverrideCurrencyId = await this.#resolveCurrencyId(
      fields.priceOverrideCurrency,
    );

    return this.#availabilityCalendarRepository.update(id, {
      statusId,
      quantityAvailable: fields.quantityAvailable,
      priceOverrideAmount: fields.priceOverrideAmount,
      priceOverrideCurrencyId,
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

  // --- Sprint 10: capacity reservation (reservation_holds +
  // availability_calendar.quantity_available). Called only by the
  // booking-holds/bookings modules as a Service-to-Service dependency —
  // never exposed as new HTTP routes on /availability. These methods
  // never write availability_calendar.status_id: the public write-guard
  // above (AVAILABLE/BLOCKED only) is untouched. ---

  async #restoreCapacityForRange(
    { bookableUnitId, dateFrom, dateTo, restoreAmount },
    connection,
  ) {
    const unit = await this.#bookableUnitService.findById(bookableUnitId);
    const availableStatusId =
      await this.#availabilityCalendarRepository.findStatusIdByCode(
        'AVAILABLE',
        connection,
      );
    const dates = enumerateDates(dateFrom, dateTo);
    for (const date of dates) {
      // eslint-disable-next-line no-await-in-loop -- each date's lock+write must be sequential within one transaction.
      const row = await this.#availabilityCalendarRepository.lockForCapacity(
        {
          bookableUnitId,
          date,
          availableStatusId,
          defaultCapacity: unit?.capacity ?? 1,
        },
        connection,
      );
      // eslint-disable-next-line no-await-in-loop
      await this.#availabilityCalendarRepository.update(
        row.id,
        { quantityAvailable: row.quantityAvailable + restoreAmount },
        connection,
      );
    }
  }

  /**
   * Grants a hold of `quantity` units of capacity for `[dateFrom, dateTo]`
   * on `unitId`: checks the blackout veto once for the whole range, then
   * locks and decrements `quantity_available` one date at a time (in
   * ascending date order, so concurrent requests acquire locks in a
   * consistent order and don't deadlock each other), all-or-nothing.
   * Must run inside the caller's transaction (`connection` is required).
   *
   * @returns {Promise<{holdIds: number[], unitId: number, dateFrom: string, dateTo: string, quantity: number, expiresAt: Date}>}
   */
  async reserveCapacity(
    { unitId, dateFrom, dateTo, quantity, expiresAt, userId },
    connection,
  ) {
    const unit = await this.#bookableUnitService.findById(unitId);
    if (!unit) throw new NotFoundError('Bookable unit not found.');

    const dates = enumerateDates(dateFrom, dateTo);
    const blockedRanges = await this.#blackoutService.getActiveRangesForListing(
      unit.listingId,
      { from: dateFrom, to: dateTo },
      connection,
    );
    if (dates.some((date) => isVetoedByBlackout(date, blockedRanges))) {
      throw new ConflictError(
        'One or more requested dates are blocked for this listing.',
        'BLACKOUT_DATE',
      );
    }

    const availableStatusId =
      await this.#availabilityCalendarRepository.findStatusIdByCode(
        'AVAILABLE',
        connection,
      );

    for (const date of dates) {
      // eslint-disable-next-line no-await-in-loop -- sequential lock+check+write per date, within one transaction.
      const row = await this.#availabilityCalendarRepository.lockForCapacity(
        {
          bookableUnitId: unit.id,
          date,
          availableStatusId,
          defaultCapacity: unit.capacity,
        },
        connection,
      );
      if (row.statusCode === 'BLOCKED') {
        throw new ConflictError(
          'One or more requested dates are blocked for this listing.',
          'BLACKOUT_DATE',
        );
      }
      if (row.quantityAvailable < quantity) {
        throw new ConflictError(
          'The requested quantity is not available for one or more requested dates.',
          'AVAILABILITY_CONFLICT',
        );
      }
      // eslint-disable-next-line no-await-in-loop
      await this.#availabilityCalendarRepository.update(
        row.id,
        { quantityAvailable: row.quantityAvailable - quantity },
        connection,
      );
    }

    const holdIds = await this.#reservationHoldRepository.createMany(
      {
        bookableUnitId: unit.id,
        userId,
        dateFrom,
        dateTo,
        expiresAt,
        count: quantity,
      },
      connection,
    );
    return { holdIds, unitId: unit.id, dateFrom, dateTo, quantity, expiresAt };
  }

  /**
   * Releases holds the caller owns, restoring the capacity they consumed.
   * Must run inside the caller's transaction (`connection` is required).
   */
  async releaseHold({ holdIds, userId }, connection) {
    const holds = await this.#reservationHoldRepository.findActiveByIds(
      holdIds,
      userId,
      connection,
    );
    if (holds.length !== holdIds.length) {
      throw new ConflictError(
        'One or more holds are already expired, consumed, or do not belong to you.',
        'HOLD_EXPIRED',
      );
    }
    const groups = groupHoldsByRange(holds);
    for (const group of groups) {
      // eslint-disable-next-line no-await-in-loop
      await this.#restoreCapacityForRange(
        { ...group, restoreAmount: group.count },
        connection,
      );
    }
    await this.#reservationHoldRepository.deleteByIds(holdIds, connection);
  }

  /**
   * Consumes holds the caller owns — deletes them WITHOUT restoring
   * capacity, since it has now transferred to the booking the caller
   * (`BookingService`) is creating in the same transaction. Returns the
   * consumed hold rows so the caller can group them into `booking_items`
   * (quantity = how many rows shared one unit + date range).
   */
  async consumeHold({ holdIds, userId }, connection) {
    const holds = await this.#reservationHoldRepository.findActiveByIds(
      holdIds,
      userId,
      connection,
    );
    if (holds.length !== holdIds.length) {
      throw new ConflictError(
        'One or more holds are already expired, consumed, or do not belong to you.',
        'HOLD_EXPIRED',
      );
    }
    await this.#reservationHoldRepository.deleteByIds(holdIds, connection);
    return holds;
  }

  /** Self-service: the caller's own active (non-expired) holds. */
  async listActiveHoldsForUser(userId) {
    return this.#reservationHoldRepository.listActiveForUser(userId);
  }

  /**
   * Restores capacity a now-cancelled/rejected booking item had consumed
   * — called by `BookingService` when a `booking_item`'s date range is
   * still in the future (a past date range's capacity is moot; that
   * Service decides which items qualify, this method just performs the
   * restoration it's told to). Must run inside the caller's transaction.
   */
  async releaseBookedCapacity(
    { unitId, dateFrom, dateTo, quantity },
    connection,
  ) {
    await this.#restoreCapacityForRange(
      { bookableUnitId: unitId, dateFrom, dateTo, restoreAmount: quantity },
      connection,
    );
  }

  /**
   * The scheduled hold-expiry sweep's entry point (called by
   * `modules/booking-holds/jobs/holdExpirySweep.js`, never by an HTTP
   * route). Opens its own transaction per batch — this is a top-level
   * system operation, not a sub-call within a larger caller transaction.
   *
   * @returns {Promise<number>} how many expired hold rows were released
   */
  async releaseExpiredHoldsBatch(limit = EXPIRY_SWEEP_BATCH_SIZE) {
    return withTransaction(async (connection) => {
      const expired = await this.#reservationHoldRepository.findExpired(
        limit,
        connection,
      );
      if (expired.length === 0) return 0;

      const groups = groupHoldsByRange(expired);
      for (const group of groups) {
        // eslint-disable-next-line no-await-in-loop
        await this.#restoreCapacityForRange(
          { ...group, restoreAmount: group.count },
          connection,
        );
      }
      await this.#reservationHoldRepository.deleteByIds(
        expired.map((hold) => hold.id),
        connection,
      );
      return expired.length;
    });
  }

  /**
   * Per-date `price_override_amount` for a range — the only pricing
   * source that exists until a real Pricing module ships (§6 of the
   * approved Sprint 10 proposal: no `base_price` on `listings`, deferred
   * since Sprint 7). Thin passthrough so `BookingService` never touches
   * `availability_calendar` directly, same cross-module rule as every
   * other Availability capability.
   */
  async getPricingForRange({ unitId, dateFrom, dateTo }, connection) {
    return this.#availabilityCalendarRepository.listPricesForUnit(
      unitId,
      { from: dateFrom, to: dateTo },
      connection,
    );
  }
}

export default AvailabilityService;
