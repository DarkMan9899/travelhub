/**
 * PageLoader — the route-level loading state (FRONTEND_ARCHITECTURE.md
 * §4.3: "Each lazy boundary renders the route-level Skeleton as its
 * Suspense fallback, never a bare spinner" — used here both as
 * `routes/index.jsx`'s `Suspense` fallback, replacing Sprint 1's bare
 * `<div>…</div>`, and as `RequireAuth`'s "still checking" state, §12).
 *
 * Centered full-viewport-height placement so it never causes a layout
 * jump relative to the content it's standing in for.
 */

import { useTranslation } from 'react-i18next';
import { Spinner } from '@travelhub/ui/components/feedback-overlays';
import styles from './PageLoader.module.scss';

export default function PageLoader() {
  const { t } = useTranslation();
  return (
    <div className={styles.pageLoader}>
      <Spinner size="lg" label={t('status.loading')} />
    </div>
  );
}
