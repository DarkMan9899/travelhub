/**
 * PageHeader — the page layout system's shared title/breadcrumb/actions
 * pattern (Application Foundation phase). Lives in `components/` (used
 * by every module that owns a page — Bookings, Profile, Settings,
 * Partner — not one module's private concern, FRONTEND_ARCHITECTURE.md
 * §7). Renders the page's single `<h1>` — a page composes this once,
 * never its own separate heading.
 */

import PropTypes from 'prop-types';
import { Breadcrumbs } from '@travelhub/ui/components/navigation';
import { Inline } from '@travelhub/ui/components/layout';
import RouterLink from '../RouterLink.jsx';
import styles from './PageHeader.module.scss';

export default function PageHeader({
  title,
  breadcrumbs = [],
  actions = undefined,
}) {
  return (
    <div className={styles.pageHeader}>
      {breadcrumbs.length > 0 && (
        <Breadcrumbs items={breadcrumbs} linkComponent={RouterLink} />
      )}
      <Inline justify="space-between" align="center" gap="4">
        <h1 className={styles.title}>{title}</h1>
        {actions && <div className={styles.actions}>{actions}</div>}
      </Inline>
    </div>
  );
}

PageHeader.propTypes = {
  title: PropTypes.string.isRequired,
  breadcrumbs: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      href: PropTypes.string.isRequired,
    }),
  ),
  actions: PropTypes.node,
};
