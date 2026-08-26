/**
 * 403 page (FRONTEND_ARCHITECTURE.md §4.5/§27) — rendered whenever a
 * `RequireRole`/`RequirePermission` guard fails, or a query resolves a
 * `FORBIDDEN` API error (that second trigger is future-page work; the
 * guard trigger is wired now, in `guards/RequireRole.jsx`).
 */

import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { EmptyState } from '@desavii/ui/components/feedback-overlays';

export default function ForbiddenPage() {
  const { t } = useTranslation();
  const { locale } = useParams();
  const navigate = useNavigate();

  return (
    <EmptyState
      title={t('errors.forbidden.title')}
      description={t('errors.forbidden.description')}
      actionLabel={t('errors.forbidden.action')}
      onAction={() => navigate(locale ? `/${locale}` : '/')}
    />
  );
}
