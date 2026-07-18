/**
 * Sprint 1's ONE placeholder route (SPRINT_0_IMPLEMENTATION_PLAN.md's
 * "one real, working route" acceptance criterion, and
 * FRONTEND_ARCHITECTURE.md §2's Deliverables). Proves the routing,
 * locale-prefix, i18next, and build pipeline all work end-to-end.
 *
 * NOT a real page — no business content, no data fetching. Deleted
 * outright once Sprint 2 (or whichever sprint implements the Home
 * module) adds the real homepage.
 */

import { useTranslation } from 'react-i18next';

export default function ComingSoonPage() {
  const { t } = useTranslation();
  return (
    <div style={{ padding: '4rem 2rem', textAlign: 'center' }}>
      <h1>{t('app.name')}</h1>
      <p>{t('status.comingSoon')}</p>
    </div>
  );
}
