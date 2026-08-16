/**
 * Payments module response DTOs (BACKEND_ARCHITECTURE.md Ch.9).
 */

function toRefundableAmount(payment) {
  // Simple decimal subtraction is safe here (display-only, never used for
  // a write) — `PaymentService` itself always uses `Money` for anything
  // that persists.
  const refundable =
    Number(payment.capturedAmount) - Number(payment.refundedAmount);
  return refundable.toFixed(2);
}

export function toPaymentTransactionResponse(transaction) {
  return {
    id: transaction.id,
    type: transaction.type,
    amount: transaction.amount,
    currency: transaction.currencyCode,
    refund_id: transaction.refundId,
    actor_id: transaction.actorId,
    created_at: transaction.createdAt,
  };
}

export function toPaymentAttemptResponse(attempt) {
  return {
    id: attempt.id,
    attempt_number: attempt.attemptNumber,
    provider: attempt.providerCode,
    status: attempt.statusCode,
    failure_code: attempt.failureCode,
    failure_message: attempt.failureMessage,
    created_at: attempt.createdAt,
  };
}

export function toRefundResponse(refund) {
  return {
    id: refund.id,
    refund_reference: refund.refundReference,
    payment_id: refund.paymentId,
    amount: refund.amount,
    currency: refund.currencyCode,
    reason: refund.reason,
    status: refund.statusCode,
    provider: refund.providerCode,
    failure_code: refund.failureCode,
    failure_message: refund.failureMessage,
    requested_by: refund.requestedBy,
    created_at: refund.createdAt,
    succeeded_at: refund.succeededAt,
    failed_at: refund.failedAt,
  };
}

export function toPaymentResponse(payment) {
  return {
    id: payment.id,
    payment_reference: payment.paymentReference,
    booking_id: payment.bookingId,
    customer_user_id: payment.customerUserId,
    partner_id: payment.partnerId,
    provider: payment.providerCode,
    provider_payment_id: payment.providerPaymentId,
    // The UI's "Development/Demo Payment — no real money was charged"
    // badge keys off this flag, never a string-compare scattered across
    // components.
    is_simulated: payment.providerCode === 'local',
    status: payment.statusCode,
    base_amount: payment.baseAmount,
    fees_amount: payment.feesAmount,
    tax_amount: payment.taxAmount,
    discount_amount: payment.discountAmount,
    total_amount: payment.totalAmount,
    currency: payment.currencyCode,
    captured_amount: payment.capturedAmount,
    refunded_amount: payment.refundedAmount,
    refundable_amount: toRefundableAmount(payment),
    failure_code: payment.failureCode,
    failure_message: payment.failureMessage,
    created_at: payment.createdAt,
    updated_at: payment.updatedAt,
    authorized_at: payment.authorizedAt,
    succeeded_at: payment.succeededAt,
    failed_at: payment.failedAt,
    cancelled_at: payment.cancelledAt,
    attempts: (payment.attempts ?? []).map(toPaymentAttemptResponse),
    transactions: (payment.transactions ?? []).map(
      toPaymentTransactionResponse,
    ),
    refunds: (payment.refunds ?? []).map(toRefundResponse),
  };
}

export function toPaymentSummaryResponse(payment) {
  return {
    id: payment.id,
    payment_reference: payment.paymentReference,
    booking_id: payment.bookingId,
    partner_id: payment.partnerId,
    provider: payment.providerCode,
    is_simulated: payment.providerCode === 'local',
    status: payment.statusCode,
    total_amount: payment.totalAmount,
    currency: payment.currencyCode,
    refunded_amount: payment.refundedAmount,
    created_at: payment.createdAt,
  };
}

export function toLedgerEntryResponse(entry) {
  return {
    id: entry.id,
    entry_type: entry.entryType,
    payment_id: entry.paymentId,
    refund_id: entry.refundId,
    booking_id: entry.bookingId,
    partner_id: entry.partnerId,
    amount: entry.amount,
    currency: entry.currencyCode,
    description: entry.description,
    created_at: entry.createdAt,
  };
}

export function toPartnerBalanceResponse(balanceRows) {
  return {
    balances: balanceRows.map((row) => ({
      currency: row.currencyCode,
      balance: row.balance,
    })),
  };
}
