/**
 * TripPlannerPageContent (Stage 15.1) — the AI Trip Planner's page
 * orchestrator, mirroring every other module's `*PageContent` shape
 * (form -> mutation -> result, `ErrorState`/`Skeleton` for the async
 * states). Reused as-is at `/:locale/account/trip-planner`.
 */

import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Section, Stack } from '@desavii/ui/components/layout';
import { ErrorState } from '@desavii/ui/components/feedback-overlays';
import PageHeader from '../../../../components/PageHeader/PageHeader.jsx';
import TripPlannerForm from '../TripPlannerForm/TripPlannerForm.jsx';
import ItineraryView from '../ItineraryView/ItineraryView.jsx';
import { usePlanTripMutation } from '../../mutations/usePlanTripMutation.js';

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
        <p>{t('ai.tripPlanner.description')}</p>
        <TripPlannerForm
          onSubmit={handleSubmit}
          isSubmitting={mutation.isPending}
        />
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
