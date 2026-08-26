/**
 * SimulatedPaymentNotice — Phase 16 spec §5/§20's required disclosure:
 * "Make it visually obvious in development/demo environments that this
 * is simulated payment infrastructure and no real charge occurs." Keys
 * off the backend's own `is_simulated` flag
 * (`apps/api/src/modules/payments/dto/paymentDto.js`'s
 * `providerCode === 'local'` computation) — never a string-compare
 * scattered across components. Renders nothing once a real provider
 * (e.g. Stripe) is configured and used.
 */

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Alert } from '@desavii/ui/components/feedback-overlays';

export default function SimulatedPaymentNotice({ compact = false }) {
  const { t } = useTranslation();

  return (
    <Alert
      variant="info"
      title={compact ? undefined : t('payments.simulated.title')}
    >
      {t('payments.simulated.description')}
    </Alert>
  );
}

SimulatedPaymentNotice.propTypes = {
  compact: PropTypes.bool,
};
