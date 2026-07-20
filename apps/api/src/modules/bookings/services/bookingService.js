/**
 * BookingService — public Service for the Bookings module (Sprint 10,
 * Module Catalog #18, deliberately scoped down from
 * `BACKEND_ARCHITECTURE.md`'s aspirational entry — no Payments/Refunds/
 * Wallet dependency, since none of those modules or their tables exist
 * yet; see the approved Sprint 10 proposal §1/§7 for the documented gap).
 *
 * The only Service permitted to write `bookings.status_id` (mirrors
 * `BACKEND_ARCHITECTURE.md` Ch.26's "no module other than bookings/
 * booking-holds mutates status directly," scoped down to just `bookings`
 * owning it here since this sprint merges the confirm-transition into
 * this one Service rather than a separate `ConfirmBookingHoldUseCase`).
 *
 * Depends on `AvailabilityService`'s public interface for everything
 * touching `bookable_units`/`availability_calendar`/`reservation_holds`
 * (`consumeHold`, `getUnitById`, `getPricingForRange`,
 * `releaseBookedCapacity`) — never a second Repository over those tables,
 * same cross-module rule Sprint 9 established. Depends on
 * `ListingService` only to resolve a listing's `partnerId`.
 *
 * **Booking creation never trusts client-supplied price, capacity, or
 * availability** (BACKEND_ARCHITECTURE.md §13) — every item's price is
 * resolved server-side from `availability_calendar.price_override_amount`
 * (the only pricing source that exists until a real Pricing module
 * ships), and every item's capacity was already re-verified, under lock,
 * when its hold was granted.
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
import { Money } from '../../../core/domain/money.js';
import { enumerateDates } from '../../../core/domain/calendarExpansion.js';
import { resolveBookingTypeCode } from '../../../core/domain/bookableUnitTypeToBookingType.js';
import { isValidBookingStatusTransition } from '../../../core/domain/bookingStatusTransitions.js';
import { generateBookingReference } from '../../../core/domain/bookingReference.js';

const VIEW_ALL_PERMISSION = 'booking.view_all';
const CONFIRM_PERMISSION = 'booking.confirm';
const REJECT_PERMISSION = 'booking.reject';
const CANCEL_ANY_PERMISSION = 'booking.cancel_any';
const MAX_REFERENCE_ATTEMPTS = 5;

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

export class BookingService {
  #bookingRepository;

  #availabilityService;

  #listingService;

  #permissionResolver;

  constructor({
    bookingRepository,
    availabilityService,
    listingService,
    permissionResolver,
  }) {
    this.#bookingRepository = bookingRepository;
    this.#availabilityService = availabilityService;
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

  /**
   * Resolves one request item's holds into a priced, unit/listing-
   * consistent line: consumes the item's `holdIds` (deleting them,
   * transferring their capacity to this booking), verifies they all
   * share one unit + date range, and sums that range's per-date price
   * into a single `unit_price_amount` (the price for ONE unit of
   * capacity across the whole range; `quantity` multiplies separately).
   */
  async #resolveItem(item, userId, connection) {
    const holds = await this.#availabilityService.consumeHold(
      { holdIds: item.holdIds, userId },
      connection,
    );
    const [firstHold] = holds;
    const consistent = holds.every(
      (hold) =>
        hold.bookableUnitId === firstHold.bookableUnitId &&
        hold.dateFrom === firstHold.dateFrom &&
        hold.dateTo === firstHold.dateTo,
    );
    if (!consistent) {
      throw new ValidationError(
        'All holdIds within one booking item must share the same unit and date range.',
        [{ field: 'items', issue: 'INCONSISTENT_HOLD_GROUP' }],
      );
    }

    const unit = await this.#availabilityService.getUnitById(
      firstHold.bookableUnitId,
    );

    const prices = await this.#availabilityService.getPricingForRange(
      {
        unitId: firstHold.bookableUnitId,
        dateFrom: firstHold.dateFrom,
        dateTo: firstHold.dateTo,
      },
      connection,
    );
    const dates = enumerateDates(firstHold.dateFrom, firstHold.dateTo);
    const isPriceMissing = (price) =>
      price === undefined ||
      price.amount === null ||
      price.currencyCode === null;
    if (prices.length !== dates.length || prices.some(isPriceMissing)) {
      throw new ValidationError(
        'One or more requested dates has no price set for this unit.',
        [{ field: 'items', issue: 'PRICING_INCOMPLETE' }],
      );
    }
    const { currencyCode } = prices[0];
    if (prices.some((price) => price.currencyCode !== currencyCode)) {
      throw new ValidationError(
        'All dates within one booking item must share the same currency.',
        [{ field: 'items', issue: 'PRICING_CURRENCY_MISMATCH' }],
      );
    }

    let unitPrice = Money.zero(currencyCode);
    prices.forEach((price) => {
      unitPrice = unitPrice.add(
        Money.fromDecimalString(price.amount, currencyCode),
      );
    });

    return {
      bookableUnitId: firstHold.bookableUnitId,
      dateFrom: firstHold.dateFrom,
      dateTo: firstHold.dateTo,
      quantity: holds.length,
      unitPrice,
      currencyCode,
      listingId: unit.listingId,
      bookableUnitTypeCode: unit.bookableUnitTypeCode,
      guests: item.guests ?? [],
    };
  }

  /**
   * Converts one or more already-granted holds into a real, auditable
   * booking. All items must resolve to the same listing (schema-enforced:
   * `bookings.listing_id`/`partner_id` are singular columns) and the same
   * bookable unit type (so `booking_type_id`, also a singular column,
   * stays well-defined).
   */
  async createBooking(
    principal,
    { items, customerNotes, guestContactSnapshot },
  ) {
    if (!principal) throw new AuthenticationError();

    return withTransaction(async (connection) => {
      const resolvedItems = [];
      for (const item of items) {
        // eslint-disable-next-line no-await-in-loop -- each item's holds are consumed sequentially within one transaction.
        const resolved = await this.#resolveItem(
          item,
          principal.userId,
          connection,
        );
        resolvedItems.push(resolved);
      }

      const [first] = resolvedItems;
      resolvedItems.forEach((resolved) => {
        if (resolved.listingId !== first.listingId) {
          throw new ValidationError(
            'All items in one booking must belong to the same listing.',
            [{ field: 'items', issue: 'MULTI_LISTING_BOOKING' }],
          );
        }
        if (resolved.bookableUnitTypeCode !== first.bookableUnitTypeCode) {
          throw new ValidationError(
            'All items in one booking must share the same bookable unit type.',
            [{ field: 'items', issue: 'MIXED_UNIT_TYPES' }],
          );
        }
        if (resolved.currencyCode !== first.currencyCode) {
          throw new ValidationError(
            'All items in one booking must share the same currency.',
            [{ field: 'items', issue: 'PRICING_CURRENCY_MISMATCH' }],
          );
        }
      });

      const listing = await this.#listingService.getListing(
        principal,
        first.listingId,
      );

      let subtotal = Money.zero(first.currencyCode);
      resolvedItems.forEach((resolved) => {
        subtotal = subtotal.add(resolved.unitPrice.multiply(resolved.quantity));
      });

      const currency = await findCurrencyByCode(first.currencyCode, connection);
      const bookingTypeCode = resolveBookingTypeCode(
        first.bookableUnitTypeCode,
      );
      const [bookingTypeId, statusId, paymentStatusId] = await Promise.all([
        this.#bookingRepository.findBookingTypeIdByCode(
          bookingTypeCode,
          connection,
        ),
        this.#bookingRepository.findStatusIdByCode(
          'PENDING_VENDOR',
          connection,
        ),
        this.#bookingRepository.findPaymentStatusIdByCode(
          'NOT_REQUIRED_ON_PLATFORM',
          connection,
        ),
      ]);

      let booking;
      for (let attempt = 0; attempt < MAX_REFERENCE_ATTEMPTS; attempt += 1) {
        try {
          // eslint-disable-next-line no-await-in-loop -- a duplicate reference is only known after the insert attempt.
          booking = await this.#bookingRepository.createBooking(
            {
              bookingReference: generateBookingReference(),
              customerUserId: principal.userId,
              partnerId: listing.partnerId,
              listingId: first.listingId,
              bookingTypeId,
              statusId,
              customerNotes,
              guestContactSnapshot,
              currencyId: currency.id,
              subtotalAmount: subtotal.toDecimalString(),
              totalAmount: subtotal.toDecimalString(),
              paymentStatusId,
              requestedAt: new Date(),
              createdBy: principal.userId,
            },
            connection,
          );
          break;
        } catch (err) {
          const isLastAttempt = attempt === MAX_REFERENCE_ATTEMPTS - 1;
          if (err.code !== 'CONFLICT' || isLastAttempt) throw err;
        }
      }

      for (const resolved of resolvedItems) {
        // eslint-disable-next-line no-await-in-loop
        const bookingItemId = await this.#bookingRepository.createBookingItem(
          {
            bookingId: booking.id,
            bookableUnitId: resolved.bookableUnitId,
            dateFrom: resolved.dateFrom,
            dateTo: resolved.dateTo,
            quantity: resolved.quantity,
            unitPriceAmount: resolved.unitPrice.toDecimalString(),
          },
          connection,
        );
        for (const guest of resolved.guests) {
          // eslint-disable-next-line no-await-in-loop
          await this.#bookingRepository.createBookingGuest(
            {
              bookingItemId,
              fullName: guest.fullName,
              documentNumber: guest.documentNumber,
            },
            connection,
          );
        }
      }

      await this.#bookingRepository.createStatusHistory(
        {
          bookingId: booking.id,
          fromStatusId: null,
          toStatusId: statusId,
          changedBy: principal.userId,
        },
        connection,
      );

      return this.#hydrate(booking, connection);
    });
  }

  async #hydrate(booking, connection) {
    const items = await this.#bookingRepository.findItemsForBooking(
      booking.id,
      connection,
    );
    const guests = await this.#bookingRepository.findGuestsForBookingItems(
      items.map((item) => item.id),
      connection,
    );
    return {
      ...booking,
      items: items.map((item) => ({
        ...item,
        guests: guests.filter((guest) => guest.bookingItemId === item.id),
      })),
    };
  }

  /** 404-masked: visible to the booking's own customer, the listing's partner owner/staff, or `booking.view_all`. */
  async getBooking(principal, id) {
    const booking = await this.#bookingRepository.findById(id);
    if (!booking) throw new NotFoundError('Booking not found.');
    if (!principal) throw new NotFoundError('Booking not found.');

    const isCustomer = booking.customerUserId === principal.userId;
    if (!isCustomer) {
      const allowed = await this.#isOwnerOrHasPermission(
        principal,
        booking.partnerId,
        VIEW_ALL_PERMISSION,
      );
      if (!allowed) throw new NotFoundError('Booking not found.');
    }
    return this.#hydrate(booking);
  }

  /**
   * Visibility: an explicit `partnerId` filter requires owner-or-
   * `booking.view_all` for that partner; an explicit `viewAll` flag
   * requires the platform-wide `booking.view_all` permission; otherwise
   * defaults to the caller's own bookings as a customer (the common
   * "My Trips" case, self-service, no permission needed).
   */
  async listBookings(principal, filters = {}, paginationOpts = {}) {
    if (!principal) throw new AuthenticationError();
    const { partnerId, viewAll } = filters;

    if (partnerId !== undefined) {
      await this.#assertOwnerOrPermission(
        principal,
        partnerId,
        VIEW_ALL_PERMISSION,
      );
      return this.#bookingRepository.list({ partnerId }, paginationOpts);
    }
    if (viewAll) {
      const isAdmin = await this.#permissionResolver.hasPermission(
        principal.roles,
        VIEW_ALL_PERMISSION,
      );
      if (!isAdmin) throw new AuthorizationError();
      return this.#bookingRepository.list({}, paginationOpts);
    }
    return this.#bookingRepository.list(
      { customerUserId: principal.userId },
      paginationOpts,
    );
  }

  /**
   * Shared status-transition machinery: validates the transition against
   * the existing domain state machine, writes the new status + one
   * timestamp column + a `booking_status_history` row, and — when
   * `restoreCapacity` is set — returns each future-dated item's capacity
   * to `availability_calendar`. Runs inside the caller's transaction.
   */
  async #applyTransition(
    booking,
    toStatusCode,
    { changedBy, timestampField, cancellationReason, restoreCapacity = false },
    connection,
  ) {
    if (!isValidBookingStatusTransition(booking.statusCode, toStatusCode)) {
      throw new ConflictError(
        `Cannot transition a booking from ${booking.statusCode} to ${toStatusCode}.`,
        'INVALID_BOOKING_TRANSITION',
      );
    }

    const toStatusId = await this.#bookingRepository.findStatusIdByCode(
      toStatusCode,
      connection,
    );
    await this.#bookingRepository.updateStatus(
      booking.id,
      {
        statusId: toStatusId,
        ...(timestampField ? { [timestampField]: new Date() } : {}),
        ...(cancellationReason !== undefined ? { cancellationReason } : {}),
      },
      connection,
    );
    await this.#bookingRepository.createStatusHistory(
      {
        bookingId: booking.id,
        fromStatusId: booking.statusId,
        toStatusId,
        changedBy,
      },
      connection,
    );

    if (restoreCapacity) {
      const items = await this.#bookingRepository.findItemsForBooking(
        booking.id,
        connection,
      );
      const today = todayDateString();
      for (const item of items) {
        if (item.dateTo >= today) {
          // eslint-disable-next-line no-await-in-loop
          await this.#availabilityService.releaseBookedCapacity(
            {
              unitId: item.bookableUnitId,
              dateFrom: item.dateFrom,
              dateTo: item.dateTo,
              quantity: item.quantity,
            },
            connection,
          );
        }
      }
    }

    return this.#hydrate(
      await this.#bookingRepository.findById(booking.id, connection),
      connection,
    );
  }

  async confirmBooking(principal, id) {
    if (!principal) throw new AuthenticationError();
    return withTransaction(async (connection) => {
      const booking = await this.#bookingRepository.lockById(id, connection);
      if (!booking) throw new NotFoundError('Booking not found.');
      await this.#assertOwnerOrPermission(
        principal,
        booking.partnerId,
        CONFIRM_PERMISSION,
      );
      return this.#applyTransition(
        booking,
        'CONFIRMED',
        { changedBy: principal.userId, timestampField: 'confirmedAt' },
        connection,
      );
    });
  }

  async rejectBooking(principal, id, { reason } = {}) {
    if (!principal) throw new AuthenticationError();
    return withTransaction(async (connection) => {
      const booking = await this.#bookingRepository.lockById(id, connection);
      if (!booking) throw new NotFoundError('Booking not found.');
      await this.#assertOwnerOrPermission(
        principal,
        booking.partnerId,
        REJECT_PERMISSION,
      );
      return this.#applyTransition(
        booking,
        'REJECTED',
        {
          changedBy: principal.userId,
          timestampField: 'rejectedAt',
          cancellationReason: reason,
          restoreCapacity: true,
        },
        connection,
      );
    });
  }

  /**
   * Self-service for the booking's own customer (`CANCELLED_BY_CUSTOMER`,
   * no permission needed) or the listing's partner owner/staff/
   * `booking.cancel_any` admin (`CANCELLED_BY_VENDOR`) — one endpoint,
   * the terminal status resolved from the caller's own identity.
   */
  async cancelBooking(principal, id, { reason } = {}) {
    if (!principal) throw new AuthenticationError();
    return withTransaction(async (connection) => {
      const booking = await this.#bookingRepository.lockById(id, connection);
      if (!booking) throw new NotFoundError('Booking not found.');

      const isCustomer = booking.customerUserId === principal.userId;
      const isVendorSide =
        !isCustomer &&
        (await this.#isOwnerOrHasPermission(
          principal,
          booking.partnerId,
          CANCEL_ANY_PERMISSION,
        ));
      if (!isCustomer && !isVendorSide) throw new AuthorizationError();

      return this.#applyTransition(
        booking,
        isCustomer ? 'CANCELLED_BY_CUSTOMER' : 'CANCELLED_BY_VENDOR',
        {
          changedBy: principal.userId,
          timestampField: 'cancelledAt',
          cancellationReason: reason,
          restoreCapacity: true,
        },
        connection,
      );
    });
  }

  /** No dedicated `booking.complete`/`booking.no_show` permission is seeded; reuses `booking.confirm` (owner-fallback still applies), same reuse-when-none-fits precedent as Sprint 9's `listing.update`/`listing.moderate`. */
  async completeBooking(principal, id) {
    if (!principal) throw new AuthenticationError();
    return withTransaction(async (connection) => {
      const booking = await this.#bookingRepository.lockById(id, connection);
      if (!booking) throw new NotFoundError('Booking not found.');
      await this.#assertOwnerOrPermission(
        principal,
        booking.partnerId,
        CONFIRM_PERMISSION,
      );
      return this.#applyTransition(
        booking,
        'COMPLETED',
        { changedBy: principal.userId, timestampField: 'completedAt' },
        connection,
      );
    });
  }

  async markNoShow(principal, id) {
    if (!principal) throw new AuthenticationError();
    return withTransaction(async (connection) => {
      const booking = await this.#bookingRepository.lockById(id, connection);
      if (!booking) throw new NotFoundError('Booking not found.');
      await this.#assertOwnerOrPermission(
        principal,
        booking.partnerId,
        CONFIRM_PERMISSION,
      );
      return this.#applyTransition(
        booking,
        'NO_SHOW',
        { changedBy: principal.userId },
        connection,
      );
    });
  }

  /**
   * The scheduled `PENDING_VENDOR` SLA sweep's entry point (called by
   * `jobs/pendingVendorSlaSweep.js`, never by an HTTP route) — separate
   * from the much-shorter reservation-hold TTL sweep in the
   * `booking-holds` module; this one operates on already-created
   * bookings, not pre-booking holds.
   *
   * @returns {Promise<number>} how many bookings were auto-expired
   */
  async expireStaleBookings(slaHours, limit = 100) {
    return withTransaction(async (connection) => {
      const stale = await this.#bookingRepository.findPendingVendorPastSla(
        slaHours,
        limit,
        connection,
      );
      for (const booking of stale) {
        // eslint-disable-next-line no-await-in-loop
        await this.#applyTransition(
          booking,
          'EXPIRED',
          { changedBy: null, restoreCapacity: true },
          connection,
        );
      }
      return stale.length;
    });
  }
}

export default BookingService;
