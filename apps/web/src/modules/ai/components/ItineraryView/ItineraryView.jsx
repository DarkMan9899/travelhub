/**
 * ItineraryView (Stage 15.1) — renders a real, grounded trip plan:
 * the AI-authored narrative plus the day-by-day listing breakdown
 * `tripPlannerService.planTrip` computed deterministically. Every
 * listing shown here is a real, currently published marketplace
 * listing — never fabricated.
 */

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Card } from '@travelhub/ui/components/primitives';
import { Stack, Section } from '@travelhub/ui/components/layout';
import { PriceTag } from '@travelhub/ui/components/data-display';
import { EmptyState } from '@travelhub/ui/components/feedback-overlays';

export default function ItineraryView({ plan }) {
  const { t } = useTranslation();

  return (
    <Stack gap="6">
      <Card as="div" padding="lg">
        <Stack gap="2">
          <h2>
            {t('ai.tripPlanner.result.heading', {
              days: plan.days,
              destination:
                plan.destination ??
                t('ai.tripPlanner.result.unknownDestination'),
            })}
          </h2>
          <p>{plan.narrative}</p>
          <PriceTag
            amount={plan.total_estimated_budget}
            currencyCode={plan.currency}
            suffix={t('ai.tripPlanner.result.estimatedTotalSuffix')}
          />
        </Stack>
      </Card>

      {plan.daily_plan.map((day) => (
        <Section key={day.day} spacing="none">
          <h3>{t('ai.tripPlanner.result.dayHeading', { day: day.day })}</h3>
          {day.listings.length === 0 ? (
            <EmptyState
              title={t('ai.tripPlanner.result.emptyDayTitle')}
              description={t('ai.tripPlanner.result.emptyDayDescription')}
            />
          ) : (
            <Stack gap="3">
              {day.listings.map((listing) => (
                <Card key={listing.id} as="div" padding="md">
                  <Stack gap="1">
                    <strong>{listing.title}</strong>
                    <span>{listing.city_name}</span>
                    <PriceTag
                      amount={listing.price_per_night}
                      currencyCode={listing.currency}
                      suffix={t('ai.tripPlanner.result.perNightSuffix')}
                      size="sm"
                    />
                  </Stack>
                </Card>
              ))}
            </Stack>
          )}
        </Section>
      ))}
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
