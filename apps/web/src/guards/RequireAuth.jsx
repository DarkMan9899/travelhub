/**
 * RequireAuth — FRONTEND_ARCHITECTURE.md §12: renders its children if
 * `isAuthenticated`; otherwise redirects to `/auth/login`, preserving
 * the intended destination as a `redirect` query param for the
 * post-login return. Renders `PageLoader` while `isBootstrapping` is
 * true so a logged-in user refreshing the page never sees a flash
 * redirect to login before the silent session-restore has resolved.
 *
 * Guards are UX, not security (§12's own words) — the actual
 * authorization boundary is `requireAuth`/`req.principal` on the API
 * side; this only avoids showing unreachable UI.
 */

import { Navigate, useLocation, useParams } from 'react-router-dom';
import PropTypes from 'prop-types';
import { useAuth } from '../contexts/AuthContext.jsx';
import PageLoader from '../components/PageLoader/PageLoader.jsx';

export default function RequireAuth({ children }) {
  const { isAuthenticated, isBootstrapping } = useAuth();
  const location = useLocation();
  const { locale } = useParams();

  if (isBootstrapping) {
    return <PageLoader />;
  }

  if (!isAuthenticated) {
    const redirectTarget = encodeURIComponent(
      `${location.pathname}${location.search}`,
    );
    return (
      <Navigate
        to={`/${locale}/auth/login?redirect=${redirectTarget}`}
        replace
      />
    );
  }

  return children;
}

RequireAuth.propTypes = {
  children: PropTypes.node.isRequired,
};
