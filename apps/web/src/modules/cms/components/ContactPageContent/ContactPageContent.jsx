/**
 * ContactPageContent — `/:locale/contact` (Phase 10 redesign).
 * Deliberately static support info (email/hours), not a submission
 * form — no backend endpoint exists to receive contact messages, and a
 * form that silently drops submissions would be dishonest. See the
 * Phase 10 plan's "explicit scope decisions" for the reasoning.
 *
 * P1.6 (Master Roadmap): title/lead now come from the real CMS backend
 * (see `AboutPageContent.jsx`'s identical comment for the fallback
 * reasoning). Also removes the phone contact row entirely — it was a
 * fabricated placeholder number (`+374 10 000 000`, an obviously fake
 * trailing-zeros number), which is worse than no phone option at all;
 * email is the one real, working contact channel until a real support
 * line exists.
 */

import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Mail, Clock } from 'lucide-react';
import { Section, Stack, Inline } from '@travelhub/ui/components/layout';
import { Icon } from '@travelhub/ui/components/primitives';
import PageHeader from '../../../../components/PageHeader/PageHeader.jsx';
import useSeo from '../../../../seo/useSeo.js';
import { buildBreadcrumbListSchema } from '../../../../seo/structuredData.js';
import { useCmsPageQuery } from '../../queries/useCmsPageQuery.js';
import styles from './ContactPageContent.module.scss';

export default function ContactPageContent() {
  const { t, i18n } = useTranslation();
  const { locale } = useParams();
  const { data: cmsPage } = useCmsPageQuery('contact', i18n.language);
  const title = cmsPage?.title ?? t('cms.contact.title');
  const lead = cmsPage?.content ?? t('cms.contact.lead');

  const breadcrumbItems = [
    { label: t('nav.home'), href: `/${locale}` },
    { label: title, href: `/${locale}/contact` },
  ];

  useSeo({
    title: `${title} | ${t('app.name')}`,
    description: lead,
    locale,
    path: 'contact',
    jsonLd: [buildBreadcrumbListSchema(breadcrumbItems)],
  });

  return (
    <Section spacing="default">
      <PageHeader title={title} breadcrumbs={breadcrumbItems} />
      <Stack gap="6">
        <p className={styles.lead}>{lead}</p>
        <Stack gap="4" className={styles.detailsList}>
          <Inline gap="3" align="center">
            <Icon icon={Mail} />
            <a href="mailto:support@desavii.com" className={styles.link}>
              support@desavii.com
            </a>
          </Inline>
          <Inline gap="3" align="center">
            <Icon icon={Clock} />
            <span>{t('cms.contact.hours')}</span>
          </Inline>
        </Stack>
      </Stack>
    </Section>
  );
}
