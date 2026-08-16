/**
 * RequirePartner — FRONTEND_ARCHITECTURE.md §12, mirroring
 * `RequireRole.jsx`'s shape exactly: renders children if the
 * authenticated user has at least one entry in `AuthContext`'s
 * `partnerships` (populated from `GET /partners/mine`, Phase 5);
 * otherwise renders `ForbiddenPage`. Reads exclusively from
 * `AuthContext` — never its own API call, per §12.
 *
 * Must be composed inside `RequireAuth` (this component assumes
 * `isAuthenticated` — it doesn't itself redirect an anonymous visitor to
 * login, that's `RequireAuth`'s job).
 *
 * Replaces the "RequireAuth only" placeholder `PartnerLayout.jsx`
 * previously flagged — that comment predates the `partners` backend
 * module (Phase 5), which is what now makes a real partner-scoped check
 * possible.
 */

import PropTypes from 'prop-types';
import { useAuth } from '../contexts/AuthContext.jsx';
import ForbiddenPage from '../pages/ForbiddenPage.jsx';

export default function RequirePartner({ children }) {
  const { partnerships } = useAuth();
  const isPartner = partnerships.length > 0;

  if (!isPartner) {
    return <ForbiddenPage />;
  }

  return children;
}

RequirePartner.propTypes = {
  children: PropTypes.node.isRequired,
};
