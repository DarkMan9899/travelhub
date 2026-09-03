/**
 * ForgotPasswordPage — thin route-entry, same shape as LoginPage.jsx.
 */

import { useTranslation } from 'react-i18next';
import { ForgotPasswordForm } from '../../modules/auth/index.js';
import styles from './AuthPages.module.scss';

export default function ForgotPasswordPage() {
  const { t } = useTranslation();

  return (
    <div className={styles.card}>
      <h1 className={styles.title}>{t('auth.forgotPassword.title')}</h1>
      <ForgotPasswordForm />
    </div>
  );
}
