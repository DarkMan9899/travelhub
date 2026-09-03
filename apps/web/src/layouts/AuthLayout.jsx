/**
 * AuthLayout — FRONTEND_ARCHITECTURE.md §5.2: minimal chrome (logo only,
 * no primary nav, no footer) — the login/register/forgot/reset-password
 * form is the only focal point. One shared layout for all four Auth
 * pages (`LoginPage`/`RegisterPage`/`ForgotPasswordPage`/
 * `ResetPasswordPage` each just compose it via the route tree, unchanged
 * by the 2026 public-frontend audit's Auth redesign) — so redesigning
 * this one file brings the whole family into the Desavii identity at
 * once, without touching any page/form component's own logic.
 *
 * Split composition (desktop+): a dark editorial brand panel (the same
 * `DestinationArt` + `scrim-navy-glow` treatment `EditorialPageHero`
 * already uses, seeded `"auth"` for a stable distinct mesh) carrying the
 * logo and Home's own real hero copy (`home.hero.eyebrow`/`subtitle` —
 * reused verbatim, no new marketing copy invented) — paired with a
 * plain, maximally legible white form card, unchanged in substance. On
 * mobile the brand panel drops out entirely (a form is what a phone
 * visitor needs first) and the logo moves inline above the form.
 */

import { Outlet, Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Container } from '@desavii/ui/components/layout';
import DestinationArt from '../components/DestinationArt/DestinationArt.jsx';
import useNoIndex from '../seo/useNoIndex.js';
import styles from './AuthLayout.module.scss';

export default function AuthLayout() {
  const { t } = useTranslation();
  const { locale } = useParams();
  useNoIndex();

  return (
    <div className={styles.authLayout}>
      <aside className={styles.brandPanel}>
        <DestinationArt seed="auth" className={styles.brandArt} />
        <div className={styles.brandContent}>
          <Link to={`/${locale}`} className={styles.logo}>
            {t('app.name')}
          </Link>
          <div className={styles.brandMessage}>
            <span className={styles.eyebrow}>{t('home.hero.eyebrow')}</span>
            <p className={styles.tagline}>{t('home.hero.subtitle')}</p>
          </div>
        </div>
      </aside>
      <div className={styles.formPanel}>
        <Container size="narrow" className={styles.content}>
          <Link to={`/${locale}`} className={styles.mobileLogo}>
            {t('app.name')}
          </Link>
          <Outlet />
        </Container>
      </div>
    </div>
  );
}
