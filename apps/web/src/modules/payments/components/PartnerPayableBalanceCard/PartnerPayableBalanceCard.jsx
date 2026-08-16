/**
 * PartnerPayableBalanceCard — Partner dashboard financial-visibility
 * widget (Phase 16 spec §21). Reads `GET /payments/partners/:id/balance`
 * — a value computed fresh from the ledger every time
 * (`LedgerService.getPartnerBalance`), never a cached number this
 * component could show stale. Explicitly labeled "Payable" (money owed
 * to the partner, not yet paid out) — never "Paid out" or "Available
 * balance," since no payout processing exists yet (Phase 16 spec §12:
 * "Do not pretend payouts have occurred when payout processing is not
 * implemented").
 */

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Card } from '@travelhub/ui/components/primitives';
import { Stack, Inline } from '@travelhub/ui/components/layout';
import { Skeleton } from '@travelhub/ui/components/feedback-overlays';
import { PriceTag } from '@travelhub/ui/components/data-display';
import { usePartnerBalanceQuery } from '../../queries/usePartnerBalanceQuery.js';

export default function PartnerPayableBalanceCard({ partnerId }) {
  const { t } = useTranslation();
  const { data, isPending, isError } = usePartnerBalanceQuery(partnerId);
  const balances = data?.balances ?? [];

  return (
    <Card as="div" padding="lg">
      <Stack gap="3">
        <h2>{t('payments.partnerBalance.heading')}</h2>
        {isPending && <Skeleton variant="text" width="40%" height={28} />}
        {!isPending && isError && <p>{t('payments.partnerBalance.error')}</p>}
        {!isPending && !isError && balances.length === 0 && (
          <p>{t('payments.partnerBalance.empty')}</p>
        )}
        {!isPending &&
          !isError &&
          balances.map((balance) => (
            <Inline
              key={balance.currency}
              gap="3"
              align="center"
              justify="space-between"
            >
              <span>{t('payments.partnerBalance.payableLabel')}</span>
              <PriceTag
                amount={balance.balance}
                currencyCode={balance.currency}
              />
            </Inline>
          ))}
      </Stack>
    </Card>
  );
}

PartnerPayableBalanceCard.propTypes = {
  partnerId: PropTypes.number.isRequired,
};
