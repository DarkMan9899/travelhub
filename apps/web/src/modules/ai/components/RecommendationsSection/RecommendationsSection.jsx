/**
 * RecommendationsSection (Stage 15.4) — real, personalized picks built
 * entirely from the requester's own past behavior (`GET
 * /ai/recommendations`, grounded in `ai_user_memory`'s real
 * category/city affinity counters). Renders nothing for a user with no
 * affinity signal yet (a brand-new account, or one that hasn't booked/
 * favorited/reviewed anything) — an honest empty state, never a
 * fabricated "popular" placeholder grid on a dashboard that already has
 * plenty of other content.
 */

import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Card } from '@travelhub/ui/components/primitives';
import { PriceTag } from '@travelhub/ui/components/data-display';
import { Stack, Grid } from '@travelhub/ui/components/layout';
import { Skeleton } from '@travelhub/ui/components/feedback-overlays';
import RouterLink from '../../../../components/RouterLink.jsx';
import { useRecommendationsQuery } from '../../queries/useRecommendationsQuery.js';
import styles from './RecommendationsSection.module.scss';

export default function RecommendationsSection() {
  const { t, i18n } = useTranslation();
  const { locale } = useParams();
  const { data, isPending, isError } = useRecommendationsQuery();

  if (isPending) {
    return (
      <Card as="div" padding="lg">
        <Stack gap="3">
          <Skeleton variant="text" width="40%" />
          <Skeleton variant="rect" height={88} />
        </Stack>
      </Card>
    );
  }

  const listings = data?.data?.listings ?? [];
  if (isError || listings.length === 0) {
    return null;
  }

  const basedOn = data.data.based_on;
  const basedOnParts = [];
  if (basedOn?.category) {
    basedOnParts.push(
      t('ai.recommendations.basedOnCategory', { category: basedOn.category }),
    );
  }
  if (basedOn?.city) {
    basedOnParts.push(
      t('ai.recommendations.basedOnCity', { city: basedOn.city }),
    );
  }
  if (basedOn?.typical_budget) {
    basedOnParts.push(
      t('ai.recommendations.basedOnBudget', {
        amount: basedOn.typical_budget.amount,
        currency: basedOn.typical_budget.currency ?? '',
      }),
    );
  }

  return (
    <Card as="div" padding="lg">
      <Stack gap="3">
        <h2>{t('ai.recommendations.heading')}</h2>
        {basedOnParts.length > 0 && (
          <p className={styles.basedOn}>
            {t('ai.recommendations.basedOnPrefix')} {basedOnParts.join(' · ')}
          </p>
        )}
        {data.data.blurb && <p>{data.data.blurb}</p>}
        <Grid columns={2} gap="3">
          {listings.map((listing) => (
            <RouterLink
              key={listing.id}
              href={`/${locale}/listings/${listing.id}`}
              className={styles.card}
            >
              <span className={styles.title}>{listing.title}</span>
              {listing.city_name && (
                <span className={styles.city}>{listing.city_name}</span>
              )}
              {listing.price_amount && listing.currency_code && (
                <PriceTag
                  amount={listing.price_amount}
                  currencyCode={listing.currency_code}
                  locale={i18n.language}
                  size="sm"
                />
              )}
            </RouterLink>
          ))}
        </Grid>
      </Stack>
    </Card>
  );
}
