/**
 * AdminAiModerationPageContent — `/:locale/admin/ai/moderation` (Stage
 * 15.6: Admin AI). A real, key-independent heuristic queue (duplicate
 * titles, spam signals) from `GET /ai/admin/moderation-queue`; a "Score"
 * button per row calls `POST /ai/admin/moderation/:listingId/score` for a
 * richer single-listing read (adds an optional AI-generated note on top
 * of the same real heuristic score). One shared mutation instance drives
 * every row, matching `AdminListingModerationPageContent`'s established
 * pattern — per-row pending state is derived from `mutation.variables`.
 */

import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Section, Stack, Inline } from '@desavii/ui/components/layout';
import { DataTable } from '@desavii/ui/components/dashboard';
import { Button, Card } from '@desavii/ui/components/primitives';
import { ErrorState } from '@desavii/ui/components/feedback-overlays';
import PageHeader from '../../../../components/PageHeader/PageHeader.jsx';
import RouterLink from '../../../../components/RouterLink.jsx';
import { useAdminAiModerationQueueQuery } from '../../queries/useAdminAiModerationQueueQuery.js';
import { useScoreListingMutation } from '../../mutations/useScoreListingMutation.js';

export default function AdminAiModerationPageContent() {
  const { t } = useTranslation();
  const { locale } = useParams();
  const { data, isPending, isError, refetch } =
    useAdminAiModerationQueueQuery();
  const scoreMutation = useScoreListingMutation();

  const signalLabel = (code) =>
    t(`admin.aiModeration.signals.${code}`, { defaultValue: code });

  const columns = [
    { key: 'title', header: t('admin.aiModeration.table.title') },
    {
      key: 'partner_display_name',
      header: t('admin.aiModeration.table.partner'),
    },
    { key: 'score', header: t('admin.aiModeration.table.score') },
    {
      key: 'signals',
      header: t('admin.aiModeration.table.signals'),
      render: (entry) => entry.signals.map(signalLabel).join(', '),
    },
    {
      key: 'actions',
      header: '',
      render: (entry) => (
        <Inline gap="2">
          <Button
            type="button"
            size="sm"
            disabled={scoreMutation.isPending}
            onClick={() => scoreMutation.mutate(entry.listing_id)}
          >
            {scoreMutation.isPending &&
            scoreMutation.variables === entry.listing_id
              ? t('admin.aiModeration.scoring')
              : t('admin.aiModeration.scoreAction')}
          </Button>
          <RouterLink href={`/${locale}/admin/listings/${entry.listing_id}`}>
            {t('admin.aiModeration.reviewListingAction')}
          </RouterLink>
        </Inline>
      ),
    },
  ];

  const result = scoreMutation.data?.data;

  return (
    <Section spacing="default">
      <PageHeader
        title={t('admin.aiModeration.heading')}
        breadcrumbs={[
          { label: t('nav.home'), href: `/${locale}` },
          { label: t('admin.nav.dashboard'), href: `/${locale}/admin` },
          {
            label: t('admin.aiModeration.heading'),
            href: `/${locale}/admin/ai/moderation`,
          },
        ]}
      />

      {isError ? (
        <ErrorState
          title={t('admin.aiModeration.error.title')}
          retryLabel={t('admin.aiModeration.error.retry')}
          onRetry={refetch}
        />
      ) : (
        <Stack gap="4">
          <p>{t('admin.aiModeration.description')}</p>

          <DataTable
            columns={columns}
            rows={data ?? []}
            rowKey={(entry) => entry.listing_id}
            isLoading={isPending}
            emptyTitle={t('admin.aiModeration.empty.title')}
            emptyDescription={t('admin.aiModeration.empty.description')}
          />

          {scoreMutation.isError && (
            <span role="alert">
              {scoreMutation.error?.message ??
                t('admin.aiModeration.error.score')}
            </span>
          )}

          {result && (
            <Card as="div" padding="lg">
              <Stack gap="2">
                <h2>{t('admin.aiModeration.result.heading')}</h2>
                <Inline gap="2">
                  <strong>
                    {t('admin.aiModeration.result.heuristicScoreLabel')}
                  </strong>
                  <span>{result.heuristic_score}</span>
                </Inline>
                <Inline gap="2">
                  <strong>{t('admin.aiModeration.result.signalsLabel')}</strong>
                  <span>{result.signals.map(signalLabel).join(', ')}</span>
                </Inline>
                <Inline gap="2">
                  <strong>{t('admin.aiModeration.result.aiNoteLabel')}</strong>
                  <span>{result.ai_note}</span>
                </Inline>
                <Inline justify="flex-end">
                  <RouterLink
                    href={`/${locale}/admin/listings/${scoreMutation.variables}`}
                  >
                    {t('admin.aiModeration.reviewListingAction')}
                  </RouterLink>
                </Inline>
              </Stack>
            </Card>
          )}
        </Stack>
      )}
    </Section>
  );
}
