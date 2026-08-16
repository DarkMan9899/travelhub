/**
 * ContactPageContent — `/:locale/contact` (Phase 10 redesign).
 * Deliberately static support info (email/hours), not a submission
 * form — no backend endpoint exists to receive contact messages, and a
 * form that silently drops submissions would be dishonest. See the
 * Phase 10 plan's "explicit scope decisions" for the reasoning.
 */

import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Mail, Phone, Clock } from 'lucide-react';
import { Section, Stack, Inline } from '@travelhub/ui/components/layout';
import { Icon } from '@travelhub/ui/components/primitives';
import PageHeader from '../../../../components/PageHeader/PageHeader.jsx';
import useSeo from '../../../../seo/useSeo.js';
import { buildBreadcrumbListSchema } from '../../../../seo/structuredData.js';
import styles from './ContactPageContent.module.scss';

export default function ContactPageContent() {
  const { t } = useTranslation();
  const { locale } = useParams();

  const breadcrumbItems = [
    { label: t('nav.home'), href: `/${locale}` },
    { label: t('cms.contact.title'), href: `/${locale}/contact` },
  ];

  useSeo({
    title: `${t('cms.contact.title')} | ${t('app.name')}`,
    description: t('cms.contact.lead'),
    locale,
    path: 'contact',
    jsonLd: [buildBreadcrumbListSchema(breadcrumbItems)],
  });

  return (
    <Section spacing="default">
      <PageHeader
        title={t('cms.contact.title')}
        breadcrumbs={breadcrumbItems}
      />
      <Stack gap="6">
        <p className={styles.lead}>{t('cms.contact.lead')}</p>
        <Stack gap="4" className={styles.detailsList}>
          <Inline gap="3" align="center">
            <Icon icon={Mail} />
            <a href="mailto:support@desavii.com" className={styles.link}>
              support@desavii.com
            </a>
          </Inline>
          <Inline gap="3" align="center">
            <Icon icon={Phone} />
            <a href="tel:+37410000000" className={styles.link}>
              +374 10 000 000
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
