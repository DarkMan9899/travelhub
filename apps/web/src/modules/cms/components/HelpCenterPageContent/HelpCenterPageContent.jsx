/**
 * HelpCenterPageContent — `/:locale/help` (Phase 10 redesign). A hub of
 * links into the other real support surfaces (FAQ, Contact) — not a
 * ticketing/search system, since no backend exists for one.
 *
 * P1.6 (Master Roadmap): title/lead now come from the real CMS backend
 * (see `AboutPageContent.jsx`'s identical comment for the fallback
 * reasoning). The links grid stays static: it's navigation, not content.
 */

import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { HelpCircle, Mail } from 'lucide-react';
import { Section, Stack } from '@travelhub/ui/components/layout';
import { Card, Icon } from '@travelhub/ui/components/primitives';
import PageHeader from '../../../../components/PageHeader/PageHeader.jsx';
import RouterLink from '../../../../components/RouterLink.jsx';
import useSeo from '../../../../seo/useSeo.js';
import { buildBreadcrumbListSchema } from '../../../../seo/structuredData.js';
import { useCmsPageQuery } from '../../queries/useCmsPageQuery.js';
import styles from './HelpCenterPageContent.module.scss';

export default function HelpCenterPageContent() {
  const { t, i18n } = useTranslation();
  const { locale } = useParams();
  const { data: cmsPage } = useCmsPageQuery('help', i18n.language);
  const title = cmsPage?.title ?? t('cms.help.title');
  const lead = cmsPage?.content ?? t('cms.help.lead');

  const links = [
    {
      key: 'faq',
      href: `/${locale}/faq`,
      icon: HelpCircle,
    },
    {
      key: 'contact',
      href: `/${locale}/contact`,
      icon: Mail,
    },
  ];

  const breadcrumbItems = [
    { label: t('nav.home'), href: `/${locale}` },
    { label: title, href: `/${locale}/help` },
  ];

  useSeo({
    title: `${title} | ${t('app.name')}`,
    description: lead,
    locale,
    path: 'help',
    jsonLd: [buildBreadcrumbListSchema(breadcrumbItems)],
  });

  return (
    <Section spacing="default">
      <PageHeader title={title} breadcrumbs={breadcrumbItems} />
      <Stack gap="6">
        <p className={styles.lead}>{lead}</p>
        <div className={styles.linksGrid}>
          {links.map(({ key, href, icon }) => (
            <Card
              key={key}
              as={RouterLink}
              href={href}
              interactive
              padding="lg"
              className={styles.linkCard}
            >
              <Icon icon={icon} />
              <span className={styles.linkTitle}>
                {t(`cms.help.links.${key}.title`)}
              </span>
              <span className={styles.linkDescription}>
                {t(`cms.help.links.${key}.description`)}
              </span>
            </Card>
          ))}
        </div>
      </Stack>
    </Section>
  );
}
