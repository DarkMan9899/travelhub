/**
 * FaqPageContent — `/:locale/faq` (Phase 10 redesign). Accordion-style
 * Q&A built on native `<details>/<summary>` — no dedicated Accordion
 * primitive exists in packages/ui yet, and native disclosure elements
 * already give correct keyboard/screen-reader behavior for free.
 */

import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { Section, Stack } from '@travelhub/ui/components/layout';
import { Icon } from '@travelhub/ui/components/primitives';
import PageHeader from '../../../../components/PageHeader/PageHeader.jsx';
import useSeo from '../../../../seo/useSeo.js';
import {
  buildBreadcrumbListSchema,
  buildFaqPageSchema,
} from '../../../../seo/structuredData.js';
import styles from './FaqPageContent.module.scss';

const QUESTION_KEYS = [
  'booking',
  'payment',
  'cancellation',
  'becomePartner',
  'contactSupport',
];

export default function FaqPageContent() {
  const { t } = useTranslation();
  const { locale } = useParams();

  const breadcrumbItems = [
    { label: t('nav.home'), href: `/${locale}` },
    { label: t('cms.faq.title'), href: `/${locale}/faq` },
  ];

  const faqs = QUESTION_KEYS.map((key) => ({
    question: t(`cms.faq.questions.${key}.question`),
    answer: t(`cms.faq.questions.${key}.answer`),
  }));

  useSeo({
    title: `${t('cms.faq.title')} | ${t('app.name')}`,
    description: t('cms.faq.description'),
    locale,
    path: 'faq',
    jsonLd: [
      buildBreadcrumbListSchema(breadcrumbItems),
      buildFaqPageSchema(faqs),
    ],
  });

  return (
    <Section spacing="default">
      <PageHeader title={t('cms.faq.title')} breadcrumbs={breadcrumbItems} />
      <Stack gap="3" className={styles.list}>
        {QUESTION_KEYS.map((key) => (
          <details key={key} className={styles.item}>
            <summary className={styles.question}>
              <span>{t(`cms.faq.questions.${key}.question`)}</span>
              <Icon icon={ChevronDown} size="sm" className={styles.chevron} />
            </summary>
            <p className={styles.answer}>
              {t(`cms.faq.questions.${key}.answer`)}
            </p>
          </details>
        ))}
      </Stack>
    </Section>
  );
}
