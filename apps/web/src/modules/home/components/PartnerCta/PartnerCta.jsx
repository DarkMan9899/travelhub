/**
 * PartnerCta — partner-acquisition banner, linking to the existing
 * (auth-gated) `/:locale/partner` route. No onboarding functionality
 * here, per the brief's explicit scope limit.
 *
 * Redesign phase (2026) — the page's "cinematic final chapter": the same
 * deep-sky gradient + ring motif + grain family Hero opened the page
 * with, at a much quieter strength (`.ringEcho` in PartnerCta.module.scss),
 * so the page closes on its own visual identity rather than a fourth
 * unrelated dark treatment.
 */

import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { Section } from '@desavii/ui/components/layout';
import { Button } from '@desavii/ui/components/primitives';
import ScrollReveal from '../ScrollReveal/ScrollReveal.jsx';
import styles from './PartnerCta.module.scss';

export default function PartnerCta() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { locale } = useParams();

  return (
    <Section aria-labelledby="partner-cta-heading">
      <ScrollReveal variant="depth" className={styles.banner}>
        <svg
          className={styles.ringEcho}
          viewBox="0 0 400 400"
          aria-hidden="true"
          focusable="false"
        >
          <circle cx="200" cy="200" r="180" />
          <circle cx="200" cy="200" r="130" />
        </svg>
        <div className={styles.text}>
          <h2 id="partner-cta-heading" className={styles.title}>
            {t('home.partnerCta.title')}
          </h2>
          <p className={styles.description}>
            {t('home.partnerCta.description')}
          </p>
        </div>
        <Button
          variant="primary"
          size="lg"
          onClick={() => navigate(`/${locale}/partner`)}
        >
          {t('home.partnerCta.cta')}
        </Button>
      </ScrollReveal>
    </Section>
  );
}
