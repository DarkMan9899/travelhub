/**
 * `useCreatePaymentMutation` — wraps `POST /payments`
 * (FRONTEND_ARCHITECTURE.md §14.5). `PayNowPanel` calls this when the
 * customer confirms payment for their booking.
 *
 * Generates a client-side `idempotencyKey` (a UUID, `crypto.randomUUID`)
 * once per mount and reuses it across retries of the SAME mutation call —
 * `client.js`'s own header comment flags idempotency-key generation as a
 * mutation-hook-owned concern once a mutation needs one; this is that
 * mutation. A double-click ("Pay Now" pressed twice before the first
 * response returns) or a network-retry both resolve to the same payment
 * record server-side, never a duplicate charge attempt.
 *
 * `onSuccess` invalidates `paymentKeys.forBooking(bookingId)` (so the
 * booking detail page's payment section immediately reflects the new
 * payment) and `paymentKeys.lists()` (the account payment-history page).
 */

import { useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createPayment } from '../../../api/payments.js';
import paymentKeys from '../constants/queryKeys.js';

export function useCreatePaymentMutation() {
  const queryClient = useQueryClient();
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);

  return useMutation({
    mutationFn: ({ bookingId, simulateScenario }) =>
      createPayment({ bookingId, simulateScenario, idempotencyKey }),
    onSuccess: (_response, variables) => {
      queryClient.invalidateQueries({
        queryKey: paymentKeys.forBooking(variables.bookingId),
      });
      queryClient.invalidateQueries({ queryKey: paymentKeys.lists() });
    },
  });
}

export default useCreatePaymentMutation;
