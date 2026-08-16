/**
 * ErrorLayout — FRONTEND_ARCHITECTURE.md §5.7: minimal chrome (logo + a
 * link home) for the 403/404/500 pages, deliberately lightweight so an
 * error page never depends on the same data-fetching that may have just
 * failed.
 */

import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import { Container } from '@travelhub/ui/components/layout';
import styles from './ErrorLayout.module.scss';

export default function ErrorLayout({ children }) {
  const { t } = useTranslation();
  const { locale } = useParams();
  const homeHref = locale ? `/${locale}` : '/';

  return (
    <div className={styles.errorLayout}>
      <Container size="narrow" className={styles.content}>
        <Link to={homeHref} className={styles.logo}>
          {t('app.name')}
        </Link>
        {children}
      </Container>
    </div>
  );
}

ErrorLayout.propTypes = {
  children: PropTypes.node.isRequired,
};
