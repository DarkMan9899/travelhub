/**
 * Application root component.
 * Per FRONTEND_ARCHITECTURE.md §3's folder contract: app/ composes
 * infrastructure (providers, routes) — it does not know about individual
 * features/pages directly.
 */

import AppProviders from '../providers/AppProviders.jsx';
import ErrorBoundary from '../errors/ErrorBoundary.jsx';
import AppRoutes from '../routes/index.jsx';

export default function App() {
  return (
    <ErrorBoundary>
      <AppProviders>
        <AppRoutes />
      </AppProviders>
    </ErrorBoundary>
  );
}
