/**
 * Root route tree.
 *
 * Implements FRONTEND_ARCHITECTURE.md §4: locale-prefixed paths
 * (/hy/, /ru/, /en/ — §4.1's SEO-driven decision), lazy-loaded route
 * components (§4.3), with a validated locale segment (an unrecognized
 * prefix falls through to the 404 route, never a silent fallback).
 *
 * Sprint 1 scope: the routing SHAPE only — one real placeholder route
 * under PublicLayout, proving the locale-prefix + layout + lazy-loading
 * pipeline all work together. The full route tree in
 * FRONTEND_ARCHITECTURE.md §4.2 (Customer Account, Partner, Admin,
 * Checkout, Auth route groups, and their RequireAuth/RequireRole guards
 * per §4.4) is added incrementally, module by module, in future sprints
 * — see each module's own README.md for its current status.
 */

import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import PropTypes from 'prop-types';
import PublicLayout from '../layouts/PublicLayout.jsx';

const ComingSoonPage = lazy(() => import('../pages/ComingSoonPage.jsx'));
const NotFoundPage = lazy(() => import('../pages/NotFoundPage.jsx'));

const SUPPORTED_LOCALES = ['hy', 'ru', 'en'];
const DEFAULT_LOCALE = 'hy';

function LocaleValidator({ children }) {
  const { locale } = useParams();
  if (!SUPPORTED_LOCALES.includes(locale)) {
    return <NotFoundPage />;
  }
  return children;
}

LocaleValidator.propTypes = {
  children: PropTypes.node.isRequired,
};

export default function AppRoutes() {
  return (
    <Suspense fallback={<div>…</div>}>
      <Routes>
        {/* Root — redirect to the default locale.
            A future sprint upgrades this to an Accept-Language-aware
            redirect (FRONTEND_ARCHITECTURE.md §4.1); a fixed default is
            the correct, honest Sprint 1 behavior in the meantime. */}
        <Route
          path="/"
          element={<Navigate to={`/${DEFAULT_LOCALE}`} replace />}
        />

        <Route
          path="/:locale"
          element={
            <LocaleValidator>
              <PublicLayout />
            </LocaleValidator>
          }
        >
          <Route index element={<ComingSoonPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
