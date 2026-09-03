/**
 * TripPlannerPageContent (Stage 15.1) — the AI Trip Planner's page
 * orchestrator, mirroring every other module's `*PageContent` shape
 * (form -> mutation -> result, `ErrorState`/`Skeleton` for the async
 * states). Reused as-is at `/:locale/account/trip-planner`.
 *
 * 2026 Customer Account redesign: a dark gradient-navy-royal intro band
 * (brief: "more futuristic spatial treatment than the other account
 * pages") replaces the previous plain heading/paragraph, with
 * `TripPlannerForm` floating over it in an elevated card. The form
 * itself, the mutation, and `ItineraryView` are unchanged — only the
 * surrounding chrome is new.
 */

import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';
import { Section, Stack } from '@desavii/ui/components/layout';
import { Card } from '@desavii/ui/components/primitives';
import { ErrorState } from '@desavii/ui/components/feedback-overlays';
import PageHeader from '../../../../components/PageHeader/PageHeader.jsx';
import TripPlannerForm from '../TripPlannerForm/TripPlannerForm.jsx';
import ItineraryView from '../ItineraryView/ItineraryView.jsx';
import { usePlanTripMutation } from '../../mutations/usePlanTripMutation.js';
import styles from './TripPlannerPageContent.module.scss';

export default function TripPlannerPageContent() {
  const { t } = useTranslation();
  const [plan, setPlan] = useState(null);
  const mutation = usePlanTripMutation();

  const handleSubmit = useCallback(
    (input) => {
      mutation.mutate(input, {
        onSuccess: (response) => setPlan(response.data),
      });
    },
    [mutation],
  );

  return (
    <Section spacing="default">
      <PageHeader title={t('ai.tripPlanner.heading')} />
      <Stack gap="8">
        <div className={styles.intro}>
          <span className={styles.introIcon} aria-hidden="true">
            <Sparkles />
          </span>
          <p className={styles.introText}>{t('ai.tripPlanner.description')}</p>
        </div>

        <Card as="div" padding="lg" elevated className={styles.formCard}>
          <TripPlannerForm
            onSubmit={handleSubmit}
            isSubmitting={mutation.isPending}
          />
        </Card>

        {mutation.isError && (
          <ErrorState
            title={t('ai.tripPlanner.error.title')}
            description={
              mutation.error?.message ?? t('ai.tripPlanner.error.description')
            }
            retryLabel={t('ai.tripPlanner.error.retry')}
            onRetry={mutation.reset}
          />
        )}
        {plan && <ItineraryView plan={plan} />}
      </Stack>
    </Section>
  );
}
