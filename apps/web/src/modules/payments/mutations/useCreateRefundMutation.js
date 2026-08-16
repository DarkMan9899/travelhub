/**
 * `useCreateRefundMutation` — wraps `POST /payments/:id/refunds`. Admin-
 * only server-side (`payment.refund`); the UI never renders the trigger
 * for this mutation to a customer or partner (permission-gated in
 * `AdminPaymentDetailContent`, mirroring every other admin write action's
 * `permissions.includes(...)` pattern).
 *
 * `onSuccess` invalidates the specific payment's detail key and its
 * booking-scoped key (both the admin detail view and the customer's
 * booking-detail payment section must reflect the refund immediately).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createRefund } from '../../../api/payments.js';
import paymentKeys from '../constants/queryKeys.js';

export function useCreateRefundMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ paymentId, amount, reason }) =>
      createRefund(paymentId, {
        amount,
        reason,
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: (_response, variables) => {
      queryClient.invalidateQueries({
        queryKey: paymentKeys.detail(variables.paymentId),
      });
      queryClient.invalidateQueries({ queryKey: paymentKeys.all });
    },
  });
}

export default useCreateRefundMutation;
