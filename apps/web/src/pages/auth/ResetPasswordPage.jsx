/**
 * ResetPasswordPage — thin route-entry, same shape as LoginPage.jsx.
 */

import { useTranslation } from 'react-i18next';
import { ResetPasswordForm } from '../../modules/auth/index.js';
import styles from './AuthPages.module.scss';

export default function ResetPasswordPage() {
  const { t } = useTranslation();

  return (
    <div className={styles.card}>
      <h1 className={styles.title}>{t('auth.resetPassword.title')}</h1>
      <ResetPasswordForm />
    </div>
  );
}
