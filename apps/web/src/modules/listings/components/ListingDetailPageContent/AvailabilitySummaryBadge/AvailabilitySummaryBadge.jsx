/**
 * AvailabilitySummaryBadge — the single sanctioned mapping of a Phase 17
 * public `availability_status` code ('AVAILABLE'/'LOW'/'SOLD_OUT') to a
 * `Badge` variant + customer-facing label, mirroring
 * `BookingStatusBadge.jsx`'s established status→badge pattern. Never
 * shows the exact `remaining_count` for `AVAILABLE` (the backend DTO
 * already omits it — see `availabilityDto.js#toPublicAvailabilitySummaryResponse`),
 * only for `LOW`/`SOLD_OUT`, so this component simply renders whatever
 * the server decided is safe to reveal.
 *
 * `lowByType` keys cover every `bookable_unit_types` code generically
 * (rooms/units/tables/seats/vehicles) — a display-noun lookup, not
 * category business logic, so no bookable-unit-type branching lives here
 * beyond picking the right noun.
 */

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Badge } from '@desavii/ui/components/primitives';

const STATUS_VARIANTS = Object.freeze({
  AVAILABLE: 'success',
  LOW: 'warning',
  SOLD_OUT: 'danger',
});

export default function AvailabilitySummaryBadge({
  status,
  remainingCount = null,
  bookableUnitType,
}) {
  const { t } = useTranslation();
  const variant = STATUS_VARIANTS[status] ?? 'neutral';

  let label;
  if (status === 'SOLD_OUT') {
    label = t('pages.listingDetail.availability.status.soldOut');
  } else if (status === 'LOW') {
    const genericLabel = t(
      'pages.listingDetail.availability.status.lowGeneric',
      {
        count: remainingCount,
      },
    );
    label = t(
      `pages.listingDetail.availability.status.lowByType.${bookableUnitType}`,
      { count: remainingCount, defaultValue: genericLabel },
    );
  } else {
    label = t('pages.listingDetail.availability.status.available');
  }

  return <Badge variant={variant} label={label} />;
}

AvailabilitySummaryBadge.propTypes = {
  status: PropTypes.oneOf(['AVAILABLE', 'LOW', 'SOLD_OUT']).isRequired,
  remainingCount: PropTypes.number,
  bookableUnitType: PropTypes.string.isRequired,
};
