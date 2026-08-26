/**
 * AboutPageContent — `/:locale/about` (Phase 10 redesign).
 *
 * P1.6 (Master Roadmap): title/lead now come from the real CMS backend
 * (`GET /cms/pages/about`, seeded and admin-editable since Stage 11.6,
 * but never actually fetched by this page until now) — falling back to
 * the original static i18n copy while the query is pending or if the
 * page is ever unpublished/deleted, so this never regresses to a blank
 * page. The values grid below stays static i18n content by design: the
 * CMS only stores one title+body per page, nothing structured enough to
 * back three distinct value cards.
 */

import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { ShieldCheck, Compass, Headset } from 'lucide-react';
import { Section, Stack } from '@desavii/ui/components/layout';
import { Icon } from '@desavii/ui/components/primitives';
import PageHeader from '../../../../components/PageHeader/PageHeader.jsx';
import useSeo from '../../../../seo/useSeo.js';
import { buildBreadcrumbListSchema } from '../../../../seo/structuredData.js';
import { useCmsPageQuery } from '../../queries/useCmsPageQuery.js';
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
  const { t, i18n } = useTranslation();
  const { locale } = useParams();
  const { data: cmsPage } = useCmsPageQuery('about', i18n.language);
  const title = cmsPage?.title ?? t('cms.about.title');
  const lead = cmsPage?.content ?? t('cms.about.lead');

  const breadcrumbItems = [
    { label: t('nav.home'), href: `/${locale}` },
    { label: title, href: `/${locale}/about` },
  ];

  useSeo({
    title,
    description: lead,
    locale,
    path: 'about',
    jsonLd: [buildBreadcrumbListSchema(breadcrumbItems)],
  });

  return (
    <Section spacing="default">
      <PageHeader title={title} breadcrumbs={breadcrumbItems} />
      <Stack gap="8">
        <p className={styles.lead}>{lead}</p>
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
