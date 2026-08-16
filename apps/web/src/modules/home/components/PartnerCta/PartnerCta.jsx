/**
 * PartnerCta — partner-acquisition banner, linking to the existing
 * (auth-gated) `/:locale/partner` route. No onboarding functionality
 * here, per the brief's explicit scope limit.
 */

import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { Section } from '@travelhub/ui/components/layout';
import { Button } from '@travelhub/ui/components/primitives';
import ScrollReveal from '../ScrollReveal/ScrollReveal.jsx';
import styles from './PartnerCta.module.scss';

export default function PartnerCta() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { locale } = useParams();

  return (
    <Section aria-labelledby="partner-cta-heading">
      <ScrollReveal className={styles.banner}>
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
