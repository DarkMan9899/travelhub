/**
 * ListingPoliciesSection — Phase 18 (Premium Listing Detail): redesigned
 * onto the shared `PolicyList` primitive (one card per policy, icon +
 * title + description), replacing the earlier plain `<dl>` label/value
 * stack. Still reuses `fromPolicyValuesResponse` (Phase 5's own wizard
 * mapping utility) and `formatMetadataValue` (extracted from
 * `MetadataValueDisplay.jsx` for exactly this reuse) so the value
 * formatting itself is identical to before — only the presentation
 * changed.
 *
 * P2.1 integrity check: `cancellation_policy`'s bare enum label
 * (Flexible/Moderate/Strict) is the one policy value here that could
 * read as a concrete, automatically-enforced refund promise — it isn't;
 * `cancellationRefundPolicy.js` confirms this value is collected and
 * displayed only, never consulted by the actual refund decision (every
 * customer-initiated cancellation is reviewed manually regardless of
 * the stated policy). The `cancellation_policy` card below appends one
 * honest, non-numeric clarifying sentence — no refund percentage/window
 * is invented here; real policy-driven enforcement is a later, dedicated
 * P2 slice.
 */

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { PolicyList } from '@travelhub/ui/components/data-display';
import { Section } from '@travelhub/ui/components/layout';
import { fromPolicyValuesResponse } from '../../../utils/policyValueMapping.js';
import { formatMetadataValue } from '../MetadataValueDisplay.jsx';
import resolvePolicyIcon from '../../../utils/policyIcons.js';

export default function ListingPoliciesSection({
  policies = [],
  listing,
  sectionId = undefined,
}) {
  const { t } = useTranslation();

  if (!policies || policies.length === 0) return null;

  const valuesByCode = fromPolicyValuesResponse(
    policies,
    listing.policy_values,
  );
  const cards = policies
    .map((definition) => ({
      definition,
      value: valuesByCode[definition.code],
    }))
    .filter(
      ({ value }) => value !== undefined && value !== null && value !== '',
    )
    .map(({ definition, value }) => {
      const formatted = formatMetadataValue(definition, value, t);
      return {
        icon: resolvePolicyIcon(definition.code),
        title: t(`partner.listingWizard.policies.${definition.code}`, {
          defaultValue: definition.code,
        }),
        description:
          definition.code === 'cancellation_policy'
            ? `${formatted} — ${t('pages.listingDetail.policies.cancellationDisclaimer')}`
            : formatted,
      };
    });

  if (cards.length === 0) return null;

  return (
    <Section
      spacing="none"
      aria-label={t('pages.listingDetail.policies.heading')}
    >
      <h2 id={sectionId}>{t('pages.listingDetail.policies.heading')}</h2>
      <PolicyList policies={cards} />
    </Section>
  );
}

const optionShape = PropTypes.shape({
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  code: PropTypes.string.isRequired,
});

ListingPoliciesSection.propTypes = {
  policies: PropTypes.arrayOf(
    PropTypes.shape({
      code: PropTypes.string.isRequired,
      data_type: PropTypes.string.isRequired,
      unit: PropTypes.string,
      options: PropTypes.arrayOf(optionShape),
    }),
  ),
  listing: PropTypes.shape({
    policy_values: PropTypes.arrayOf(
      PropTypes.shape({
        code: PropTypes.string.isRequired,
        value: PropTypes.string,
      }),
    ),
  }).isRequired,
  sectionId: PropTypes.string,
};
