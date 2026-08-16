/**
 * AuthLayout — FRONTEND_ARCHITECTURE.md §5.2: minimal chrome (logo only,
 * no primary nav, no footer) — a single centered Narrow container so the
 * login/register form is the only focal point.
 */

import { Outlet, Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Container } from '@travelhub/ui/components/layout';
import useNoIndex from '../seo/useNoIndex.js';
import styles from './AuthLayout.module.scss';

export default function AuthLayout() {
  const { t } = useTranslation();
  const { locale } = useParams();
  useNoIndex();

  return (
    <div className={styles.authLayout}>
      <Container size="narrow" className={styles.content}>
        <Link to={`/${locale}`} className={styles.logo}>
          {t('app.name')}
        </Link>
        <Outlet />
      </Container>
    </div>
  );
}
