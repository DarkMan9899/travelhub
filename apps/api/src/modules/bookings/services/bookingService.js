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
import { resolveConsumedRange } from '../../../core/domain/accommodationDateSemantics.js';
import { resolveBookingTypeCode } from '../../../core/domain/bookableUnitTypeToBookingType.js';
import { isValidBookingStatusTransition } from '../../../core/domain/bookingStatusTransitions.js';
import { generateBookingReference } from '../../../core/domain/bookingReference.js';
import { createNoOpEventBus } from '../../../core/events/domainEventBus.js';
import { createDomainEvent } from '../../../core/events/createDomainEvent.js';
import { EVENT_TYPES } from '../../../core/events/eventTypes.js';

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

  #partnerService;

  #permissionResolver;

  #auditLogger;

  #eventBus;

  constructor({
    bookingRepository,
    availabilityService,
    listingService,
    partnerService = null,
    permissionResolver,
    auditLogger,
    eventBus = createNoOpEventBus(),
  }) {
    this.#bookingRepository = bookingRepository;
    this.#availabilityService = availabilityService;
    this.#listingService = listingService;
    this.#partnerService = partnerService;
    this.#permissionResolver = permissionResolver;
    this.#auditLogger = auditLogger;
    this.#eventBus = eventBus;
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
   *
   * Phase 21 fix: `availability_calendar.price_override_amount` is a
   * per-date *override* a partner may optionally set (peak pricing,
   * etc.) — it was never meant to be the only pricing source a listing
   * can ever have, but nothing filled in a default when no override
   * existed, so a listing that only ever set its base `listing_pricing`
   * rate (the "per night" price shown everywhere on its own detail page
   * and search cards) could never actually be booked: every date fell
   * through to `PRICING_INCOMPLETE`. Any date missing an explicit
   * override now falls back to the listing's base price — still fully
   * server-resolved (never client-supplied), still throws
   * `PRICING_INCOMPLETE` for a date with neither an override nor a base
   * price to fall back to.
   */
  async #resolveItem(item, userId, connection, principal) {
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

    // Prices (and the capacity `reserveCapacity` already consumed for
    // this hold) cover only the actually-occupied range — for lodging
    // (HOTEL_ROOM/PROPERTY_UNIT) that's checkout-exclusive nights, not
    // the full [dateFrom, dateTo] the guest picked. See
    // `accommodationDateSemantics.js`.
    const consumedRange = resolveConsumedRange(
      unit.bookableUnitTypeCode,
      firstHold.dateFrom,
      firstHold.dateTo,
    );
    const prices = await this.#availabilityService.getPricingForRange(
      {
        unitId: firstHold.bookableUnitId,
        dateFrom: consumedRange.dateFrom,
        dateTo: consumedRange.dateTo,
      },
      connection,
    );
    const dates = enumerateDates(consumedRange.dateFrom, consumedRange.dateTo);
    const priceByDate = new Map(prices.map((price) => [price.date, price]));
    const isPriceMissing = (price) =>
      price === undefined ||
      price.amount === null ||
      price.currencyCode === null;
    const needsFallback = dates.some((date) =>
      isPriceMissing(priceByDate.get(date)),
    );
    if (needsFallback) {
      const listing = await this.#listingService.getListing(
        principal,
        unit.listingId,
      );
      const basePrice = listing.pricing;
      if (!basePrice) {
        throw new ValidationError(
          'One or more requested dates has no price set for this unit.',
          [{ field: 'items', issue: 'PRICING_INCOMPLETE' }],
        );
      }
      dates.forEach((date) => {
        if (isPriceMissing(priceByDate.get(date))) {
          priceByDate.set(date, {
            date,
            amount: basePrice.amount,
            currencyCode: basePrice.currencyCode,
          });
        }
      });
    }
    const resolvedPrices = dates.map((date) => priceByDate.get(date));
    const { currencyCode } = resolvedPrices[0];
    if (resolvedPrices.some((price) => price.currencyCode !== currencyCode)) {
      throw new ValidationError(
        'All dates within one booking item must share the same currency.',
        [{ field: 'items', issue: 'PRICING_CURRENCY_MISMATCH' }],
      );
    }

    let unitPrice = Money.zero(currencyCode);
    resolvedPrices.forEach((price) => {
      unitPrice = unitPrice.add(
        Money.fromDecimalString(String(price.amount), currencyCode),
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

    const booking = await withTransaction(async (connection) => {
      const resolvedItems = [];
      for (const item of items) {
        // eslint-disable-next-line no-await-in-loop -- each item's holds are consumed sequentially within one transaction.
        const resolved = await this.#resolveItem(
          item,
          principal.userId,
          connection,
          principal,
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

      let createdBooking;
      for (let attempt = 0; attempt < MAX_REFERENCE_ATTEMPTS; attempt += 1) {
        try {
          // eslint-disable-next-line no-await-in-loop -- a duplicate reference is only known after the insert attempt.
          createdBooking = await this.#bookingRepository.createBooking(
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
            bookingId: createdBooking.id,
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
          bookingId: createdBooking.id,
          fromStatusId: null,
          toStatusId: statusId,
          changedBy: principal.userId,
        },
        connection,
      );

      await this.#auditLogger.record(
        {
          actorId: principal.userId,
          action: 'booking.created',
          targetType: 'booking',
          targetId: createdBooking.id,
          afterSnapshot: {
            listingId: first.listingId,
            totalAmount: subtotal.toDecimalString(),
          },
        },
        connection,
      );

      return this.#hydrate(createdBooking, connection);
    });

    // Published after the transaction commits (Scope decision #10) — a
    // notification/email failure can never roll back or block a booking.
    await this.#eventBus.publish(
      createDomainEvent({
        eventType: EVENT_TYPES.BOOKING_CREATED,
        actorId: principal.userId,
        resourceType: 'booking',
        resourceId: booking.id,
        payload: {
          bookingReference: booking.bookingReference,
          listingId: booking.listingId,
          partnerId: booking.partnerId,
          customerUserId: booking.customerUserId,
          totalAmount: booking.totalAmount,
        },
      }),
    );

    return booking;
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
    // Resolves who a customer can message about this booking (the
    // partner's owner/primary user — see `partnerService.getOwnerUserId`,
    // already used server-side by the notifications listener). Read-only,
    // display-only enrichment on the single-booking shape, never the list
    // summary — matches `mysqlSearchRepository.js`'s "join purely to
    // enrich a response" convention, just via a Service call instead of a
    // repository join since `partners` is a different module's table.
    const partnerOwnerUserId = this.#partnerService
      ? await this.#partnerService.getOwnerUserId(booking.partnerId)
      : null;
    return {
      ...booking,
      partnerOwnerUserId,
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
   * Stage 11.4 (Admin Platform — Booking Operations): `GET /bookings/:id/history`
   * — same 404-masked visibility rule as `getBooking` (the history of a
   * booking you can't see doesn't exist, as far as the caller knows).
   * Surfaces `booking_status_history` (written by every `#applyTransition`
   * call since Sprint 10, never read anywhere until now).
   */
  async getStatusHistory(principal, id) {
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
    return this.#bookingRepository.findStatusHistoryForBooking(id);
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
    const { partnerId, viewAll, status, customerUserId } = filters;

    if (partnerId !== undefined) {
      await this.#assertOwnerOrPermission(
        principal,
        partnerId,
        VIEW_ALL_PERMISSION,
      );
      return this.#bookingRepository.list(
        { partnerId, statusCode: status },
        paginationOpts,
      );
    }
    // Phase 11 Admin Platform: an admin looking up one specific
    // customer's booking history (e.g. from the User Management detail
    // page) — requires the same platform-wide permission `viewAll` does,
    // since it's equally "not my own bookings."
    if (customerUserId !== undefined) {
      const isAdmin = await this.#permissionResolver.hasPermission(
        principal.roles,
        VIEW_ALL_PERMISSION,
      );
      if (!isAdmin) throw new AuthorizationError();
      return this.#bookingRepository.list(
        { customerUserId, statusCode: status },
        paginationOpts,
      );
    }
    if (viewAll) {
      const isAdmin = await this.#permissionResolver.hasPermission(
        principal.roles,
        VIEW_ALL_PERMISSION,
      );
      if (!isAdmin) throw new AuthorizationError();
      return this.#bookingRepository.list(
        { statusCode: status },
        paginationOpts,
      );
    }
    return this.#bookingRepository.list(
      { customerUserId: principal.userId, statusCode: status },
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

    // Single choke point for every status-transition method below
    // (confirm/reject/cancel/complete/no-show/expire) — one audit call
    // here covers all of them, rather than duplicating it six times.
    // `changedBy` is null for the automated SLA sweep (`expireStaleBookings`),
    // which `AuditLogger.record` explicitly allows for system actions.
    await this.#auditLogger.record(
      {
        actorId: changedBy,
        action: 'booking.status_changed',
        targetType: 'booking',
        targetId: booking.id,
        beforeSnapshot: { status: booking.statusCode },
        afterSnapshot: { status: toStatusCode },
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
              bookingId: booking.id,
              actorUserId: changedBy,
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

  /** Shared publish step for confirm/reject/cancel/complete — always after the transaction has committed. */
  async #publishBookingEvent(eventType, principal, booking) {
    await this.#eventBus.publish(
      createDomainEvent({
        eventType,
        actorId: principal.userId,
        resourceType: 'booking',
        resourceId: booking.id,
        payload: {
          bookingReference: booking.bookingReference,
          partnerId: booking.partnerId,
          customerUserId: booking.customerUserId,
        },
      }),
    );
  }

  async confirmBooking(principal, id) {
    if (!principal) throw new AuthenticationError();
    const booking = await withTransaction(async (connection) => {
      const locked = await this.#bookingRepository.lockById(id, connection);
      if (!locked) throw new NotFoundError('Booking not found.');
      await this.#assertOwnerOrPermission(
        principal,
        locked.partnerId,
        CONFIRM_PERMISSION,
      );
      return this.#applyTransition(
        locked,
        'CONFIRMED',
        { changedBy: principal.userId, timestampField: 'confirmedAt' },
        connection,
      );
    });
    await this.#publishBookingEvent(
      EVENT_TYPES.BOOKING_CONFIRMED,
      principal,
      booking,
    );
    return booking;
  }

  async rejectBooking(principal, id, { reason } = {}) {
    if (!principal) throw new AuthenticationError();
    const booking = await withTransaction(async (connection) => {
      const locked = await this.#bookingRepository.lockById(id, connection);
      if (!locked) throw new NotFoundError('Booking not found.');
      await this.#assertOwnerOrPermission(
        principal,
        locked.partnerId,
        REJECT_PERMISSION,
      );
      return this.#applyTransition(
        locked,
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
    await this.#publishBookingEvent(
      EVENT_TYPES.BOOKING_REJECTED,
      principal,
      booking,
    );
    return booking;
  }

  /**
   * Self-service for the booking's own customer (`CANCELLED_BY_CUSTOMER`,
   * no permission needed) or the listing's partner owner/staff/
   * `booking.cancel_any` admin (`CANCELLED_BY_VENDOR`) — one endpoint,
   * the terminal status resolved from the caller's own identity.
   */
  async cancelBooking(principal, id, { reason } = {}) {
    if (!principal) throw new AuthenticationError();
    const booking = await withTransaction(async (connection) => {
      const locked = await this.#bookingRepository.lockById(id, connection);
      if (!locked) throw new NotFoundError('Booking not found.');

      const isCustomer = locked.customerUserId === principal.userId;
      const isVendorSide =
        !isCustomer &&
        (await this.#isOwnerOrHasPermission(
          principal,
          locked.partnerId,
          CANCEL_ANY_PERMISSION,
        ));
      if (!isCustomer && !isVendorSide) throw new AuthorizationError();

      return this.#applyTransition(
        locked,
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
    await this.#publishBookingEvent(
      EVENT_TYPES.BOOKING_CANCELLED,
      principal,
      booking,
    );
    return booking;
  }

  /** No dedicated `booking.complete`/`booking.no_show` permission is seeded; reuses `booking.confirm` (owner-fallback still applies), same reuse-when-none-fits precedent as Sprint 9's `listing.update`/`listing.moderate`. */
  async completeBooking(principal, id) {
    if (!principal) throw new AuthenticationError();
    const booking = await withTransaction(async (connection) => {
      const locked = await this.#bookingRepository.lockById(id, connection);
      if (!locked) throw new NotFoundError('Booking not found.');
      await this.#assertOwnerOrPermission(
        principal,
        locked.partnerId,
        CONFIRM_PERMISSION,
      );
      return this.#applyTransition(
        locked,
        'COMPLETED',
        { changedBy: principal.userId, timestampField: 'completedAt' },
        connection,
      );
    });
    await this.#publishBookingEvent(
      EVENT_TYPES.BOOKING_COMPLETED,
      principal,
      booking,
    );
    return booking;
  }

  /**
   * Phase 16 (Payment Infrastructure) — the ONE narrow integration point
   * between the new Payments module and Bookings: writes only
   * `bookings.payment_status_id`, the coarse booking-facing payment
   * summary column that has existed since Sprint 5 for exactly this
   * purpose. `bookings.status_id` (the vendor-confirmation workflow) is
   * completely untouched by online payment outcomes — this method never
   * calls `#applyTransition`. `BookingService` still exclusively owns the
   * write (mirrors the class header's "no module other than bookings
   * mutates status directly" rule); `PaymentService` calls this the same
   * way Reviews/AI already depend on Booking's public Service interface,
   * never a second Repository over `bookings`. No principal is required —
   * payment truth is established server-side by `PaymentService`/the
   * provider, never by a caller's claim, so this is system-callable by
   * design. Accepts the caller's transaction `connection` so a payment's
   * status write and this booking update commit atomically together.
   */
  async recordPaymentOutcome(
    bookingId,
    paymentStatusCode,
    { connection } = {},
  ) {
    const paymentStatusId =
      await this.#bookingRepository.findPaymentStatusIdByCode(
        paymentStatusCode,
        connection,
      );
    if (!paymentStatusId) {
      throw new ValidationError(
        `Unknown payment status code "${paymentStatusCode}".`,
      );
    }
    await this.#bookingRepository.updatePaymentStatus(
      bookingId,
      paymentStatusId,
      connection,
    );
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
