/**
 * LoginPage — thin route-entry composing `AuthLayout` (route level) with
 * the `auth` module's real `LoginForm` (FRONTEND_ARCHITECTURE.md §3.1's
 * `pages/` contract: no `useQuery`/`useMutation` of its own).
 */

import { useTranslation } from 'react-i18next';
import { LoginForm } from '../../modules/auth/index.js';
import styles from './AuthPages.module.scss';

export default function LoginPage() {
  const { t } = useTranslation();

  return (
    <div className={styles.card}>
      <h1 className={styles.title}>{t('auth.login.title')}</h1>
      <LoginForm />
    </div>
  );
}
