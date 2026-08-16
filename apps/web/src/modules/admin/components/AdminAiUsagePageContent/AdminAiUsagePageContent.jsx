/**
 * AdminAiUsagePageContent — `/:locale/admin/ai/usage` (Stage 15.6: Admin
 * AI). Reads `GET /ai/admin/usage`, backed by the `ai_usage_logs` table
 * every `AiService` call has written to since Stage 15.0. Rendering is
 * delegated to the shared `AiUsageDashboardContent` (Phase 15 "AI Polish"
 * sprint), the same component the Partner AI Usage page reuses — this
 * page supplies only the admin-scoped heading/breadcrumbs/data source.
 */

import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { AiUsageDashboardContent } from '../../../ai/index.js';
import { useAdminAiUsageQuery } from '../../queries/useAdminAiUsageQuery.js';

export default function AdminAiUsagePageContent() {
  const { t } = useTranslation();
  const { locale } = useParams();
  const { data, isPending, isError, refetch } = useAdminAiUsageQuery();

  return (
    <AiUsageDashboardContent
      heading={t('admin.aiUsage.heading')}
      breadcrumbs={[
        { label: t('nav.home'), href: `/${locale}` },
        { label: t('admin.nav.dashboard'), href: `/${locale}/admin` },
        {
          label: t('admin.aiUsage.heading'),
          href: `/${locale}/admin/ai/usage`,
        },
      ]}
      data={data}
      isPending={isPending}
      isError={isError}
      onRetry={refetch}
    />
  );
}
