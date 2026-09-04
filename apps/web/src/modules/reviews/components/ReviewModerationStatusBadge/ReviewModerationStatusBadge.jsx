/**
 * ReviewModerationStatusBadge — the single sanctioned mapping of a
 * `moderation_statuses.code` (the same shared lookup table Listings'
 * moderation status uses) to a `Badge` variant for a review. Extracted
 * from `AdminReviewModerationPageContent`'s own inline map (Admin Sprint
 * 4) to match the precedent `BookingStatusBadge` already established —
 * one real, reusable component instead of a map re-declared per screen.
 */

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Badge } from '@desavii/ui/components/primitives';

const STATUS_VARIANTS = Object.freeze({
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  FLAGGED: 'danger',
});

export default function ReviewModerationStatusBadge({ status, size = 'md' }) {
  const { t } = useTranslation();
  const variant = STATUS_VARIANTS[status] ?? 'neutral';
  const label = t(`admin.reviewModeration.moderationStatus.${status}`, {
    defaultValue: status,
  });

  return <Badge variant={variant} size={size} label={label} />;
}

ReviewModerationStatusBadge.propTypes = {
  status: PropTypes.string.isRequired,
  size: PropTypes.oneOf(['sm', 'md']),
};
