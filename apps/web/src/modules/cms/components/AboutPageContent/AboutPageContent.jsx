/**
 * AboutPageContent — `/:locale/about` (Phase 10 redesign). Static
 * marketing content only — no CMS/database backs this yet (`modules/cms`
 * was an empty Sprint 1 scaffold until this phase), so every string is a
 * plain i18n key, not fetched data.
 */

import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { ShieldCheck, Compass, Headset } from 'lucide-react';
import { Section, Stack } from '@travelhub/ui/components/layout';
import { Icon } from '@travelhub/ui/components/primitives';
import PageHeader from '../../../../components/PageHeader/PageHeader.jsx';
import useSeo from '../../../../seo/useSeo.js';
import { buildBreadcrumbListSchema } from '../../../../seo/structuredData.js';
import styles from './AboutPageContent.module.scss';

// Phase 12 (Product Polish): a per-value icon, matching the pattern
// `BecomePartnerPageContent`'s own benefits grid already established —
// previously this was the one CMS page with no icon at all, making it
// read as a plainer restatement of its siblings' template.
const VALUE_KEYS = [
  { key: 'trust', icon: ShieldCheck },
  { key: 'variety', icon: Compass },
  { key: 'support', icon: Headset },
];

export default function AboutPageContent() {
  const { t } = useTranslation();
  const { locale } = useParams();

  const breadcrumbItems = [
    { label: t('nav.home'), href: `/${locale}` },
    { label: t('cms.about.title'), href: `/${locale}/about` },
  ];

  useSeo({
    title: t('cms.about.title'),
    description: t('cms.about.lead'),
    locale,
    path: 'about',
    jsonLd: [buildBreadcrumbListSchema(breadcrumbItems)],
  });

  return (
    <Section spacing="default">
      <PageHeader title={t('cms.about.title')} breadcrumbs={breadcrumbItems} />
      <Stack gap="8">
        <p className={styles.lead}>{t('cms.about.lead')}</p>
        <div className={styles.valuesGrid}>
          {VALUE_KEYS.map(({ key, icon }) => (
            <Stack key={key} gap="2" as="article" align="flex-start">
              <Icon icon={icon} />
              <h2 className={styles.valueTitle}>
                {t(`cms.about.values.${key}.title`)}
              </h2>
              <p className={styles.valueDescription}>
                {t(`cms.about.values.${key}.description`)}
              </p>
            </Stack>
          ))}
        </div>
      </Stack>
    </Section>
  );
}
