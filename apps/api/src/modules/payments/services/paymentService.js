/**
 * PaymentService — the single gateway for the Payments module (Phase 16).
 *
 * Owns Payment creation, provider-result application, and Refunds — both
 * live in this one Service because a refund always mutates the SAME
 * `payments` row (its `refunded_amount` rollup + status) inside the SAME
 * transaction as the new `refunds` row, so splitting them into two
 * services would only add indirection without a real seam (they share one
 * aggregate). Ledger reads are a separate, independent concern —
 * `ledgerService.js` owns those.
 *
 * CRITICAL invariant (Phase 16 spec §7): payment truth is established
 * HERE, from the provider's response or a verified webhook — never from
 * a client-supplied "it succeeded" claim. `bookingService.recordPaymentOutcome`
 * is only ever called with a status this Service itself resolved.
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
import {
  generatePaymentReference,
  generateRefundReference,
} from '../../../core/domain/bookingReference.js';
import { isValidPaymentStatusTransition } from '../../../core/domain/paymentStatusTransitions.js';
import { isValidRefundStatusTransition } from '../../../core/domain/refundStatusTransitions.js';
import { createNoOpEventBus } from '../../../core/events/domainEventBus.js';
import { createDomainEvent } from '../../../core/events/createDomainEvent.js';
import { EVENT_TYPES } from '../../../core/events/eventTypes.js';

const VIEW_PERMISSION = 'payment.view';
const REFUND_PERMISSION = 'payment.refund';

// Payment intent status -> the coarse, booking-facing payment_statuses
// code (migration 0008's lookup, extended in seed 011).
const BOOKING_PAYMENT_STATUS_BY_INTENT_STATUS = Object.freeze({
  CREATED: 'AWAITING_PAYMENT',
  REQUIRES_ACTION: 'AWAITING_PAYMENT',
  PROCESSING: 'AWAITING_PAYMENT',
  AUTHORIZED: 'AWAITING_PAYMENT',
  SUCCEEDED: 'PAID_ONLINE',
  FAILED: 'PAYMENT_FAILED',
  CANCELLED: 'PAYMENT_FAILED',
});

const PAYABLE_BOOKING_STATUSES = Object.freeze(['PENDING_VENDOR', 'CONFIRMED']);

export class PaymentService {
  #paymentRepository;

  #refundRepository;

  #providerEventRepository;

  #ledgerRepository;

  #providerRegistry;

  #bookingService;

  #permissionResolver;

  #auditLogger;

  #eventBus;

  #settlementScheduler;

  constructor({
    paymentRepository,
    refundRepository,
    providerEventRepository,
    ledgerRepository,
    providerRegistry,
    bookingService,
    permissionResolver,
    auditLogger,
    eventBus = createNoOpEventBus(),
    // Optional: `(paymentId) => void` — schedules the delayed local-
    // settlement job. Defaults to a no-op so unit tests (and any provider
    // that never resolves to PROCESSING) never need to supply one.
    settlementScheduler = () => {},
  }) {
    this.#paymentRepository = paymentRepository;
    this.#refundRepository = refundRepository;
    this.#providerEventRepository = providerEventRepository;
    this.#ledgerRepository = ledgerRepository;
    this.#providerRegistry = providerRegistry;
    this.#bookingService = bookingService;
    this.#permissionResolver = permissionResolver;
    this.#auditLogger = auditLogger;
    this.#eventBus = eventBus;
    this.#settlementScheduler = settlementScheduler;
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

  async #hydrate(payment, connection) {
    const [attempts, transactions, refunds] = await Promise.all([
      this.#paymentRepository.listAttemptsForPayment(payment.id, connection),
      this.#paymentRepository.listTransactionsForPayment(
        payment.id,
        connection,
      ),
      this.#refundRepository.listForPayment(payment.id, connection),
    ]);
    return { ...payment, attempts, transactions, refunds };
  }

  /**
   * Applies a provider's resolved outcome to a locked payment row —
   * shared by the synchronous path (`createPaymentIntent`) and the
   * asynchronous webhook path (`handleProviderWebhook`), so both go
   * through IDENTICAL status-transition validation, booking integration,
   * and ledger writes. `payment` must already be row-locked by the caller
   * (`FOR UPDATE`) within `connection`'s transaction.
   */
  async #applyProviderResult(
    payment,
    { status, providerPaymentId, failureCode, failureMessage },
    { actorId, connection },
  ) {
    if (status === payment.statusCode) {
      // Idempotent no-op — the same outcome was already applied (e.g. a
      // redelivered webhook after this app already processed it once).
      return payment;
    }
    if (!isValidPaymentStatusTransition(payment.statusCode, status)) {
      throw new ConflictError(
        `Cannot transition a payment from ${payment.statusCode} to ${status}.`,
        'INVALID_PAYMENT_TRANSITION',
      );
    }

    const statusId = await this.#paymentRepository.findIntentStatusIdByCode(
      status,
      connection,
    );
    const now = new Date();
    const isSucceeded = status === 'SUCCEEDED';
    await this.#paymentRepository.updateStatus(
      payment.id,
      {
        statusId,
        ...(providerPaymentId !== undefined ? { providerPaymentId } : {}),
        ...(isSucceeded ? { capturedAmount: payment.totalAmount } : {}),
        ...(failureCode !== undefined ? { failureCode } : {}),
        ...(failureMessage !== undefined ? { failureMessage } : {}),
        ...(status === 'AUTHORIZED' ? { authorizedAt: now } : {}),
        ...(isSucceeded ? { succeededAt: now } : {}),
        ...(status === 'FAILED' ? { failedAt: now } : {}),
        ...(status === 'CANCELLED' ? { cancelledAt: now } : {}),
      },
      connection,
    );

    const transactionTypeByStatus = {
      AUTHORIZED: 'PAYMENT_AUTHORIZED',
      SUCCEEDED: 'PAYMENT_CAPTURED',
      FAILED: 'PAYMENT_FAILED',
      CANCELLED: 'PAYMENT_CANCELLED',
    };
    if (transactionTypeByStatus[status]) {
      await this.#paymentRepository.createTransaction(
        {
          paymentId: payment.id,
          type: transactionTypeByStatus[status],
          amount: isSucceeded ? payment.totalAmount : null,
          currencyId: isSucceeded
            ? (await findCurrencyByCode(payment.currencyCode, connection)).id
            : null,
          actorId: actorId ?? null,
          metadata: failureCode ? { failureCode, failureMessage } : null,
        },
        connection,
      );
    }

    const bookingPaymentStatus =
      BOOKING_PAYMENT_STATUS_BY_INTENT_STATUS[status];
    if (bookingPaymentStatus) {
      await this.#bookingService.recordPaymentOutcome(
        payment.bookingId,
        bookingPaymentStatus,
        { connection },
      );
    }

    if (isSucceeded) {
      const currency = await findCurrencyByCode(
        payment.currencyCode,
        connection,
      );
      await this.#ledgerRepository.create(
        {
          entryType: 'CUSTOMER_PAYMENT_RECEIVED',
          paymentId: payment.id,
          bookingId: payment.bookingId,
          partnerId: null,
          amount: payment.totalAmount,
          currencyId: currency.id,
          description: `Payment received for booking #${payment.bookingId}`,
        },
        connection,
      );
      // No commission/fee engine exists anywhere in this codebase yet
      // (documented limitation) — the partner is accrued the full
      // payment amount as payable, honestly matching what actually
      // happened rather than fabricating a platform-fee split.
      await this.#ledgerRepository.create(
        {
          entryType: 'PARTNER_PAYABLE_ACCRUED',
          paymentId: payment.id,
          bookingId: payment.bookingId,
          partnerId: payment.partnerId,
          amount: payment.totalAmount,
          currencyId: currency.id,
          description: `Payable accrued for booking #${payment.bookingId}`,
        },
        connection,
      );
    }

    return this.#paymentRepository.findById(payment.id, connection);
  }

  /**
   * Creates a new Payment for a booking. Idempotent: a repeated call with
   * the same `idempotencyKey` returns the original payment rather than
   * creating a second one; at most one non-terminal payment may exist per
   * booking at a time (enforced under a row lock — see
   * `mysqlPaymentRepository#findActiveForBooking`).
   */
  async createPaymentIntent(
    principal,
    bookingId,
    { idempotencyKey, simulateScenario, metadata = {} } = {},
  ) {
    if (!principal) throw new AuthenticationError();

    if (idempotencyKey) {
      const existing =
        await this.#paymentRepository.findByIdempotencyKey(idempotencyKey);
      if (existing) return this.#hydrate(existing);
    }

    const booking = await this.#bookingService.getBooking(principal, bookingId);
    if (booking.customerUserId !== principal.userId) {
      throw new AuthorizationError();
    }
    if (!PAYABLE_BOOKING_STATUSES.includes(booking.statusCode)) {
      throw new ConflictError(
        'This booking cannot accept a payment in its current state.',
        'BOOKING_NOT_PAYABLE',
      );
    }

    const result = await withTransaction(async (connection) => {
      const active = await this.#paymentRepository.findActiveForBooking(
        bookingId,
        connection,
      );
      if (active.length > 0) {
        throw new ConflictError(
          'A payment is already in progress for this booking.',
          'PAYMENT_ALREADY_ACTIVE',
        );
      }

      const currency = await findCurrencyByCode(
        booking.currencyCode,
        connection,
      );
      const provider = this.#providerRegistry.getDefaultProvider();
      const createdStatusId =
        await this.#paymentRepository.findIntentStatusIdByCode(
          'CREATED',
          connection,
        );

      let payment = await this.#paymentRepository.create(
        {
          paymentReference: generatePaymentReference(),
          bookingId: booking.id,
          customerUserId: booking.customerUserId,
          partnerId: booking.partnerId,
          providerCode: provider.code,
          statusId: createdStatusId,
          baseAmount: booking.subtotalAmount,
          feesAmount: booking.feesAmount,
          taxAmount: '0.00',
          discountAmount: booking.discountAmount,
          totalAmount: booking.totalAmount,
          currencyId: currency.id,
          idempotencyKey: idempotencyKey ?? null,
          metadata: {
            ...metadata,
            simulateScenario: simulateScenario ?? 'SUCCESS',
          },
          createdBy: principal.userId,
        },
        connection,
      );

      await this.#paymentRepository.createTransaction(
        {
          paymentId: payment.id,
          type: 'PAYMENT_CREATED',
          amount: payment.totalAmount,
          currencyId: currency.id,
          actorId: principal.userId,
        },
        connection,
      );
      await this.#bookingService.recordPaymentOutcome(
        booking.id,
        'AWAITING_PAYMENT',
        { connection },
      );

      const providerResult = await provider.createPaymentIntent({
        amount: payment.totalAmount,
        currencyCode: payment.currencyCode,
        paymentReference: payment.paymentReference,
        bookingId: booking.id,
        metadata: payment.metadata,
      });

      await this.#paymentRepository.createAttempt(
        {
          paymentId: payment.id,
          attemptNumber: 1,
          providerCode: provider.code,
          statusId: await this.#paymentRepository.findIntentStatusIdByCode(
            providerResult.status,
            connection,
          ),
          failureCode: providerResult.failureCode,
          failureMessage: providerResult.failureMessage,
          rawProviderResponse: providerResult.raw,
        },
        connection,
      );

      payment = await this.#applyProviderResult(payment, providerResult, {
        actorId: principal.userId,
        connection,
      });

      await this.#auditLogger.record(
        {
          actorId: principal.userId,
          action: 'payment.created',
          targetType: 'payment',
          targetId: payment.id,
          afterSnapshot: {
            bookingId: booking.id,
            totalAmount: payment.totalAmount,
            status: payment.statusCode,
          },
        },
        connection,
      );

      return this.#hydrate(payment, connection);
    });

    await this.#eventBus.publish(
      createDomainEvent({
        eventType: EVENT_TYPES.PAYMENT_CREATED,
        actorId: principal.userId,
        resourceType: 'payment',
        resourceId: result.id,
        payload: {
          paymentReference: result.paymentReference,
          bookingId: result.bookingId,
          partnerId: result.partnerId,
          customerUserId: result.customerUserId,
          totalAmount: result.totalAmount,
          currency: result.currencyCode,
        },
      }),
    );
    await this.#publishOutcomeEvent(result, principal.userId);

    if (result.statusCode === 'PROCESSING') {
      this.#settlementScheduler(result.id);
    }

    return result;
  }

  async #publishOutcomeEvent(payment, actorId) {
    const eventTypeByStatus = {
      PROCESSING: EVENT_TYPES.PAYMENT_PROCESSING,
      SUCCEEDED: EVENT_TYPES.PAYMENT_SUCCEEDED,
      FAILED: EVENT_TYPES.PAYMENT_FAILED,
      CANCELLED: EVENT_TYPES.PAYMENT_CANCELLED,
    };
    const eventType = eventTypeByStatus[payment.statusCode];
    if (!eventType) return;
    await this.#eventBus.publish(
      createDomainEvent({
        eventType,
        actorId: actorId ?? null,
        resourceType: 'payment',
        resourceId: payment.id,
        payload: {
          paymentReference: payment.paymentReference,
          bookingId: payment.bookingId,
          partnerId: payment.partnerId,
          customerUserId: payment.customerUserId,
          totalAmount: payment.totalAmount,
          currency: payment.currencyCode,
          failureCode: payment.failureCode ?? null,
        },
      }),
    );
  }

  /**
   * Applies a normalized provider webhook event to the payment it
   * references. This is the ONLY entry point for asynchronous provider
   * truth — `LocalPaymentProvider`'s simulated `PROCESSING -> SUCCEEDED`
   * settlement (see `jobs/localProviderSettlementQueue.js`) goes through
   * this exact same path, so the real-provider code and the demo path are
   * genuinely the same code, not a parallel shortcut.
   *
   * Duplicate delivery is a safe no-op: `payment_provider_events`'
   * `UNIQUE(provider_code, provider_event_id)` constraint rejects a
   * redelivered event before any financial state is touched twice.
   */
  async handleProviderWebhook(
    providerCode,
    { rawBody, signatureHeader, parsedEvent },
  ) {
    const provider = this.#providerRegistry.getProvider(providerCode);
    const verified = await provider.verifyWebhook({ rawBody, signatureHeader });
    if (!verified) {
      throw new ValidationError('Invalid webhook signature.');
    }

    const normalized = provider.normalizeWebhookEvent(parsedEvent);

    let eventRow;
    try {
      eventRow = await this.#providerEventRepository.create({
        providerCode,
        providerEventId: normalized.providerEventId,
        eventType: normalized.eventType,
        normalizedEventType: normalized.normalizedEventType,
        payload: parsedEvent,
      });
    } catch (err) {
      if (err.code === 'CONFLICT') {
        return { duplicate: true };
      }
      throw err;
    }

    const result = await withTransaction(async (connection) => {
      const payment = await this.#paymentRepository.lockByProviderPaymentId(
        providerCode,
        normalized.providerPaymentId,
        connection,
      );
      if (!payment) {
        await this.#providerEventRepository.markFailed(
          eventRow.id,
          'No payment found for this provider_payment_id.',
          connection,
        );
        return null;
      }

      const updated = await this.#applyProviderResult(
        payment,
        {
          status: normalized.status,
          providerPaymentId: normalized.providerPaymentId,
          failureCode: normalized.failureCode,
          failureMessage: normalized.failureMessage,
        },
        { actorId: null, connection },
      );
      await this.#providerEventRepository.markProcessed(
        eventRow.id,
        connection,
      );
      return updated;
    });

    if (result) {
      await this.#publishOutcomeEvent(result, null);
    }
    return { duplicate: false, payment: result };
  }

  /**
   * System-internal read, no principal/visibility check — used only by
   * `jobs/localProviderSettlementQueue.js`'s worker, which runs outside
   * any authenticated request context. Never exposed via a route.
   */
  async getPaymentSystemInternal(id) {
    return this.#paymentRepository.findById(id);
  }

  /**
   * P0.2 (Master Roadmap) — system-internal, no principal: the one call
   * `BookingService#cancelBooking` makes into this module to find out
   * whether a booking it just cancelled has real, captured money still
   * needing a decision. Never exposed via any HTTP route.
   */
  async getRefundablePaymentForBookingSystemInternal(bookingId) {
    return this.#paymentRepository.findRefundableForBooking(bookingId);
  }

  /** 404-masked: visible to the payment's own customer, the booking's partner owner/staff, or `payment.view`. */
  async getPayment(principal, id) {
    const payment = await this.#paymentRepository.findById(id);
    if (!payment) throw new NotFoundError('Payment not found.');
    if (!principal) throw new NotFoundError('Payment not found.');

    const isCustomer = payment.customerUserId === principal.userId;
    if (!isCustomer) {
      const allowed = await this.#isOwnerOrHasPermission(
        principal,
        payment.partnerId,
        VIEW_PERMISSION,
      );
      if (!allowed) throw new NotFoundError('Payment not found.');
    }
    return this.#hydrate(payment);
  }

  /** Same 3-tier visibility pattern as `bookingService.listBookings`. */
  async listPayments(principal, filters = {}, paginationOpts = {}) {
    if (!principal) throw new AuthenticationError();
    const { partnerId, viewAll, status, bookingId } = filters;

    if (partnerId !== undefined) {
      await this.#assertOwnerOrPermission(
        principal,
        partnerId,
        VIEW_PERMISSION,
      );
      return this.#paymentRepository.list(
        { partnerId, bookingId, statusCode: status },
        paginationOpts,
      );
    }
    if (viewAll) {
      const isAdmin = await this.#permissionResolver.hasPermission(
        principal.roles,
        VIEW_PERMISSION,
      );
      if (!isAdmin) throw new AuthorizationError();
      return this.#paymentRepository.list(
        { bookingId, statusCode: status },
        paginationOpts,
      );
    }
    return this.#paymentRepository.list(
      { customerUserId: principal.userId, bookingId, statusCode: status },
      paginationOpts,
    );
  }

  /**
   * Admin-only (Phase 16 spec §17: "Admin: refund actions only with
   * explicit permission" — no owner-fallback like `payment.view` gets,
   * since a partner must never be able to move money out of a payment on
   * their own authority).
   */
  async createRefund(
    principal,
    paymentId,
    { amount, reason, idempotencyKey } = {},
  ) {
    if (!principal) throw new AuthenticationError();
    const canRefund = await this.#permissionResolver.hasPermission(
      principal.roles,
      REFUND_PERMISSION,
    );
    if (!canRefund) throw new AuthorizationError();
    return this.#executeRefund(principal.userId, paymentId, {
      amount,
      reason,
      idempotencyKey,
    });
  }

  /**
   * P0.2 (Master Roadmap) — trusted-caller-only, no principal/permission
   * check: `BookingService#cancelBooking` is the only caller, applying
   * `cancellationRefundPolicy.js`'s AUTO_REFUND_FULL outcome (a business
   * unilaterally cancelling owes a full refund; the customer didn't
   * choose to trigger this, so there is no permission for them to hold).
   * Never exposed via any HTTP route — mirrors `getPaymentSystemInternal`/
   * `AvailabilityService#applySystemExternalReservation`'s identical
   * "system-level, no principal" precedent elsewhere in this codebase.
   */
  async issueSystemRefund(paymentId, { amount, reason, idempotencyKey } = {}) {
    return this.#executeRefund(null, paymentId, {
      amount,
      reason,
      idempotencyKey,
    });
  }

  async #executeRefund(actorId, paymentId, { amount, reason, idempotencyKey }) {
    if (idempotencyKey) {
      const existing =
        await this.#refundRepository.findByIdempotencyKey(idempotencyKey);
      if (existing) return existing;
    }

    const refund = await withTransaction(async (connection) => {
      const payment = await this.#paymentRepository.lockById(
        paymentId,
        connection,
      );
      if (!payment) throw new NotFoundError('Payment not found.');
      if (!['SUCCEEDED', 'PARTIALLY_REFUNDED'].includes(payment.statusCode)) {
        throw new ConflictError(
          'This payment cannot be refunded in its current state.',
          'PAYMENT_NOT_REFUNDABLE',
        );
      }

      const currency = await findCurrencyByCode(
        payment.currencyCode,
        connection,
      );
      const captured = Money.fromDecimalString(
        payment.capturedAmount,
        payment.currencyCode,
      );
      const alreadyRefunded = Money.fromDecimalString(
        payment.refundedAmount,
        payment.currencyCode,
      );
      const refundable = captured.subtract(alreadyRefunded);
      const requested = Money.fromDecimalString(amount, payment.currencyCode);

      if (requested.isZero() || requested.isNegative()) {
        throw new ValidationError('Refund amount must be greater than zero.', [
          { field: 'amount', issue: 'INVALID_AMOUNT' },
        ]);
      }
      if (requested.isGreaterThan(refundable)) {
        throw new ValidationError(
          'Refund amount exceeds the refundable balance for this payment.',
          [{ field: 'amount', issue: 'REFUND_EXCEEDS_REFUNDABLE' }],
        );
      }

      const provider = this.#providerRegistry.getProvider(payment.providerCode);
      const createdRefundStatusId =
        await this.#refundRepository.findRefundStatusIdByCode(
          'CREATED',
          connection,
        );

      let refundRow = await this.#refundRepository.create(
        {
          refundReference: generateRefundReference(),
          paymentId: payment.id,
          amount: requested.toDecimalString(),
          currencyId: currency.id,
          reason,
          statusId: createdRefundStatusId,
          providerCode: provider.code,
          idempotencyKey: idempotencyKey ?? null,
          requestedBy: actorId,
        },
        connection,
      );
      await this.#paymentRepository.createTransaction(
        {
          paymentId: payment.id,
          refundId: refundRow.id,
          type: 'REFUND_CREATED',
          amount: requested.toDecimalString(),
          currencyId: currency.id,
          actorId,
        },
        connection,
      );

      const providerResult = await provider.refundPayment(
        payment.providerPaymentId,
        {
          amount: requested.toDecimalString(),
          currencyCode: payment.currencyCode,
          reason,
          refundReference: refundRow.refundReference,
        },
      );

      if (
        !isValidRefundStatusTransition(
          refundRow.statusCode,
          providerResult.status,
        )
      ) {
        throw new ConflictError(
          `Cannot transition a refund from ${refundRow.statusCode} to ${providerResult.status}.`,
          'INVALID_REFUND_TRANSITION',
        );
      }
      const resolvedRefundStatusId =
        await this.#refundRepository.findRefundStatusIdByCode(
          providerResult.status,
          connection,
        );
      const now = new Date();
      const isSucceeded = providerResult.status === 'SUCCEEDED';
      await this.#refundRepository.updateStatus(
        refundRow.id,
        {
          statusId: resolvedRefundStatusId,
          providerRefundId: providerResult.providerRefundId,
          failureCode: providerResult.failureCode,
          failureMessage: providerResult.failureMessage,
          ...(isSucceeded ? { succeededAt: now } : {}),
          ...(providerResult.status === 'FAILED' ? { failedAt: now } : {}),
        },
        connection,
      );
      refundRow = await this.#refundRepository.findById(
        refundRow.id,
        connection,
      );

      await this.#paymentRepository.createTransaction(
        {
          paymentId: payment.id,
          refundId: refundRow.id,
          type: isSucceeded ? 'REFUND_SUCCEEDED' : 'REFUND_FAILED',
          amount: requested.toDecimalString(),
          currencyId: currency.id,
          actorId,
          metadata: providerResult.failureCode
            ? { failureCode: providerResult.failureCode }
            : null,
        },
        connection,
      );

      if (isSucceeded) {
        const newRefundedTotal = alreadyRefunded.add(requested);
        const isFullyRefunded = newRefundedTotal.equals(captured);
        const newPaymentStatus = isFullyRefunded
          ? 'REFUNDED'
          : 'PARTIALLY_REFUNDED';
        const newPaymentStatusId =
          await this.#paymentRepository.findIntentStatusIdByCode(
            newPaymentStatus,
            connection,
          );
        await this.#paymentRepository.updateStatus(
          payment.id,
          {
            statusId: newPaymentStatusId,
            refundedAmount: newRefundedTotal.toDecimalString(),
          },
          connection,
        );
        await this.#bookingService.recordPaymentOutcome(
          payment.bookingId,
          isFullyRefunded ? 'REFUNDED_ONLINE' : 'PARTIALLY_REFUNDED_ONLINE',
          { connection },
        );
        await this.#ledgerRepository.create(
          {
            entryType: 'REFUND_ISSUED',
            paymentId: payment.id,
            refundId: refundRow.id,
            bookingId: payment.bookingId,
            partnerId: null,
            amount: `-${requested.toDecimalString()}`,
            currencyId: currency.id,
            description: `Refund issued for booking #${payment.bookingId}`,
          },
          connection,
        );
        await this.#ledgerRepository.create(
          {
            entryType: 'PARTNER_PAYABLE_REVERSED',
            paymentId: payment.id,
            refundId: refundRow.id,
            bookingId: payment.bookingId,
            partnerId: payment.partnerId,
            amount: `-${requested.toDecimalString()}`,
            currencyId: currency.id,
            description: `Payable reversed for booking #${payment.bookingId} refund`,
          },
          connection,
        );
      }

      await this.#auditLogger.record(
        {
          actorId,
          action: 'payment.refunded',
          targetType: 'payment',
          targetId: payment.id,
          afterSnapshot: {
            refundId: refundRow.id,
            amount: requested.toDecimalString(),
            status: refundRow.statusCode,
          },
        },
        connection,
      );

      // Carries the owning payment's routing data (bookingId/customerUserId/
      // partnerId) alongside the refund row itself — the notification
      // listener needs these to resolve a recipient, and no event payload
      // should require a second database read just to find out who to
      // notify (mirrors how `#publishBookingEvent` denormalizes the same
      // fields directly onto every booking event's payload).
      return {
        ...refundRow,
        bookingId: payment.bookingId,
        customerUserId: payment.customerUserId,
        partnerId: payment.partnerId,
      };
    });

    await this.#eventBus.publish(
      createDomainEvent({
        eventType: EVENT_TYPES.REFUND_CREATED,
        actorId,
        resourceType: 'refund',
        resourceId: refund.id,
        payload: {
          refundReference: refund.refundReference,
          paymentId: refund.paymentId,
          bookingId: refund.bookingId,
          customerUserId: refund.customerUserId,
          partnerId: refund.partnerId,
          amount: refund.amount,
          currency: refund.currencyCode,
        },
      }),
    );
    if (refund.statusCode === 'SUCCEEDED' || refund.statusCode === 'FAILED') {
      await this.#eventBus.publish(
        createDomainEvent({
          eventType:
            refund.statusCode === 'SUCCEEDED'
              ? EVENT_TYPES.REFUND_SUCCEEDED
              : EVENT_TYPES.REFUND_FAILED,
          actorId,
          resourceType: 'refund',
          resourceId: refund.id,
          payload: {
            refundReference: refund.refundReference,
            paymentId: refund.paymentId,
            bookingId: refund.bookingId,
            customerUserId: refund.customerUserId,
            partnerId: refund.partnerId,
            amount: refund.amount,
            currency: refund.currencyCode,
          },
        }),
      );
    }

    return refund;
  }

  /** 404-masked, same visibility as `getPayment` (a refund is only ever reached through its payment). */
  async listRefundsForPayment(principal, paymentId) {
    await this.getPayment(principal, paymentId); // visibility check, discards the hydrated result
    return this.#refundRepository.listForPayment(paymentId);
  }
}

export default PaymentService;
