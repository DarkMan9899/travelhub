/**
 * 404 page (FRONTEND_ARCHITECTURE.md §4.5/§27) — rendered both by the
 * router's catch-all route and by an invalid locale segment
 * (`routes/index.jsx`'s `LocaleValidator`). Composed with `ErrorLayout`
 * at the route level, not here, so this stays the pure content piece.
 */

import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { EmptyState } from '@desavii/ui/components/feedback-overlays';
import useNoIndex from '../seo/useNoIndex.js';

export default function NotFoundPage() {
  const { t } = useTranslation();
  const { locale } = useParams();
  const navigate = useNavigate();
  useNoIndex();

  return (
    <EmptyState
      title={t('errors.notFound.title')}
      description={t('errors.notFound.description')}
      actionLabel={t('errors.notFound.action')}
      onAction={() => navigate(locale ? `/${locale}` : '/')}
    />
  );
}
