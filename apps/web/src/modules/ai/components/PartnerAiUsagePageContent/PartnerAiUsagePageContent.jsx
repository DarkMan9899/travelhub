/**
 * PartnerAiUsagePageContent — `/:locale/partner/ai/usage` (Phase 15 "AI
 * Polish" sprint). Reads `GET /ai/partner/usage`, scoped to the active
 * partnership (`usePartnerContext`), and renders the same shared
 * `AiUsageDashboardContent` the Admin AI Usage page uses — "reuse existing
 * usage infrastructure," never a second dashboard implementation.
 */

import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { usePartnerContext } from '../../../../contexts/PartnerContext.jsx';
import { usePartnerAiUsageQuery } from '../../queries/usePartnerAiUsageQuery.js';
import AiUsageDashboardContent from '../AiUsageDashboardContent/AiUsageDashboardContent.jsx';

export default function PartnerAiUsagePageContent() {
  const { t } = useTranslation();
  const { locale } = useParams();
  const { activePartnerId } = usePartnerContext();
  const { data, isPending, isError, refetch } =
    usePartnerAiUsageQuery(activePartnerId);

  return (
    <AiUsageDashboardContent
      heading={t('partner.aiUsage.heading')}
      breadcrumbs={[
        { label: t('nav.home'), href: `/${locale}` },
        { label: t('partner.nav.dashboard'), href: `/${locale}/partner` },
        {
          label: t('partner.aiUsage.heading'),
          href: `/${locale}/partner/ai/usage`,
        },
      ]}
      data={data}
      isPending={isPending}
      isError={isError}
      onRetry={refetch}
    />
  );
}
