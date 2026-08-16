/**
 * BecomePartnerPageContent — `/:locale/become-a-partner` (Phase 10
 * redesign). Marketing content with a single CTA. No self-service
 * "create a partner org" flow exists in the backend, so the CTA
 * honestly routes to account registration (existing, real) rather than
 * a fabricated application flow — see the Phase 10 plan's scope notes.
 */

import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { TrendingUp, Users, ShieldCheck } from 'lucide-react';
import { Section, Stack } from '@travelhub/ui/components/layout';
import { Button, Icon } from '@travelhub/ui/components/primitives';
import PageHeader from '../../../../components/PageHeader/PageHeader.jsx';
import useSeo from '../../../../seo/useSeo.js';
import { buildBreadcrumbListSchema } from '../../../../seo/structuredData.js';
import styles from './BecomePartnerPageContent.module.scss';

const BENEFIT_KEYS = [
  { key: 'reach', icon: TrendingUp },
  { key: 'audience', icon: Users },
  { key: 'trust', icon: ShieldCheck },
];

export default function BecomePartnerPageContent() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { locale } = useParams();

  const breadcrumbItems = [
    { label: t('nav.home'), href: `/${locale}` },
    {
      label: t('cms.becomePartner.title'),
      href: `/${locale}/become-a-partner`,
    },
  ];

  useSeo({
    title: `${t('cms.becomePartner.title')} | ${t('app.name')}`,
    description: t('cms.becomePartner.lead'),
    locale,
    path: 'become-a-partner',
    jsonLd: [buildBreadcrumbListSchema(breadcrumbItems)],
  });

  return (
    <Section spacing="default">
      <PageHeader
        title={t('cms.becomePartner.title')}
        breadcrumbs={breadcrumbItems}
      />
      <Stack gap="8">
        <p className={styles.lead}>{t('cms.becomePartner.lead')}</p>
        <div className={styles.benefitsGrid}>
          {BENEFIT_KEYS.map(({ key, icon }) => (
            <Stack key={key} gap="2" as="article" align="flex-start">
              <Icon icon={icon} />
              <h2 className={styles.benefitTitle}>
                {t(`cms.becomePartner.benefits.${key}.title`)}
              </h2>
              <p className={styles.benefitDescription}>
                {t(`cms.becomePartner.benefits.${key}.description`)}
              </p>
            </Stack>
          ))}
        </div>
        <div className={styles.ctaRow}>
          <Button
            variant="primary"
            size="lg"
            onClick={() => navigate(`/${locale}/auth/register`)}
          >
            {t('cms.becomePartner.cta')}
          </Button>
        </div>
      </Stack>
    </Section>
  );
}
