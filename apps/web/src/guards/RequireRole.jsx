/**
 * RequireRole — FRONTEND_ARCHITECTURE.md §12: renders children if the
 * authenticated user's roles intersect `roles`; otherwise renders
 * `ForbiddenPage`. Reads exclusively from `AuthContext` (never its own
 * API call, per §12).
 *
 * Must be composed inside `RequireAuth` (this component assumes
 * `isAuthenticated` — it doesn't itself redirect an anonymous visitor to
 * login, that's `RequireAuth`'s job, keeping each guard single-purpose).
 */

import PropTypes from 'prop-types';
import { useAuth } from '../contexts/AuthContext.jsx';
import ForbiddenPage from '../pages/ForbiddenPage.jsx';

export default function RequireRole({ roles, children }) {
  const { roles: userRoles } = useAuth();
  const hasRole = userRoles.some((role) => roles.includes(role));

  if (!hasRole) {
    return <ForbiddenPage />;
  }

  return children;
}

RequireRole.propTypes = {
  roles: PropTypes.arrayOf(PropTypes.string).isRequired,
  children: PropTypes.node.isRequired,
};
