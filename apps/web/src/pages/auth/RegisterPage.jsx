/**
 * RegisterPage — thin route-entry composing `AuthLayout` (route level)
 * with the `auth` module's real `RegisterForm`.
 */

import { useTranslation } from 'react-i18next';
import { RegisterForm } from '../../modules/auth/index.js';
import styles from './AuthPages.module.scss';

export default function RegisterPage() {
  const { t } = useTranslation();

  return (
    <div className={styles.card}>
      <h1 className={styles.title}>{t('auth.register.title')}</h1>
      <RegisterForm />
    </div>
  );
}
