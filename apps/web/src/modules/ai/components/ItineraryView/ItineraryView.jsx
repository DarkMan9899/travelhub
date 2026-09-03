/**
 * ItineraryView (Stage 15.1) — renders a real, grounded trip plan:
 * the AI-authored narrative plus the day-by-day listing breakdown
 * `tripPlannerService.planTrip` computed deterministically. Every
 * listing shown here is a real, currently published marketplace
 * listing — never fabricated.
 *
 * 2026 Customer Account redesign: each day renders as a node on a
 * connected vertical route (brief: "itinerary nodes... subtle animated
 * path") instead of a flat stack of `<h3>`+cards — purely a different
 * arrangement of the exact same `plan.daily_plan` data, no new fields.
 */

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Card } from '@desavii/ui/components/primitives';
import { Stack } from '@desavii/ui/components/layout';
import { PriceTag } from '@desavii/ui/components/data-display';
import { EmptyState } from '@desavii/ui/components/feedback-overlays';
import styles from './ItineraryView.module.scss';

export default function ItineraryView({ plan }) {
  const { t, i18n } = useTranslation();

  return (
    <Stack gap="6">
      <Card as="div" padding="lg" elevated className={styles.summaryCard}>
        <Stack gap="2">
          <h2 className={styles.summaryHeading}>
            {t('ai.tripPlanner.result.heading', {
              days: plan.days,
              destination:
                plan.destination ??
                t('ai.tripPlanner.result.unknownDestination'),
            })}
          </h2>
          <p className={styles.narrative}>{plan.narrative}</p>
          <PriceTag
            amount={plan.total_estimated_budget}
            currencyCode={plan.currency}
            locale={i18n.language}
            suffix={t('ai.tripPlanner.result.estimatedTotalSuffix')}
            size="lg"
          />
        </Stack>
      </Card>

      <ol className={styles.route}>
        {plan.daily_plan.map((day) => (
          <li key={day.day} className={styles.node}>
            <span className={styles.marker} aria-hidden="true">
              {day.day}
            </span>
            <div className={styles.nodeContent}>
              <h3 className={styles.dayHeading}>
                {t('ai.tripPlanner.result.dayHeading', { day: day.day })}
              </h3>
              {day.listings.length === 0 ? (
                <EmptyState
                  title={t('ai.tripPlanner.result.emptyDayTitle')}
                  description={t('ai.tripPlanner.result.emptyDayDescription')}
                />
              ) : (
                <div className={styles.dayListings}>
                  {day.listings.map((listing) => (
                    <Card
                      key={listing.id}
                      as="div"
                      padding="md"
                      className={styles.listingCard}
                    >
                      <Stack gap="1">
                        <strong>{listing.title}</strong>
                        <span className={styles.listingCity}>
                          {listing.city_name}
                        </span>
                        <PriceTag
                          amount={listing.price_per_night}
                          currencyCode={listing.currency}
                          locale={i18n.language}
                          suffix={t('ai.tripPlanner.result.perNightSuffix')}
                          size="sm"
                        />
                      </Stack>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </Stack>
  );
}

ItineraryView.propTypes = {
  plan: PropTypes.shape({
    destination: PropTypes.string,
    days: PropTypes.number.isRequired,
    currency: PropTypes.string.isRequired,
    narrative: PropTypes.string.isRequired,
    total_estimated_budget: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.number,
    ]).isRequired,
    daily_plan: PropTypes.arrayOf(
      PropTypes.shape({
        day: PropTypes.number.isRequired,
        listings: PropTypes.arrayOf(
          PropTypes.shape({
            id: PropTypes.number.isRequired,
            title: PropTypes.string.isRequired,
            city_name: PropTypes.string,
            price_per_night: PropTypes.oneOfType([
              PropTypes.string,
              PropTypes.number,
            ]),
            currency: PropTypes.string,
          }),
        ).isRequired,
      }),
    ).isRequired,
  }).isRequired,
};
