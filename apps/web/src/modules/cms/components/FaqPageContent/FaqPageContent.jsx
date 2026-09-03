/**
 * FaqPageContent — `/:locale/faq` (Phase 10 redesign; editorial redesign
 * in the 2026 public-frontend audit's static-page pass — see
 * `EditorialPageHero`'s own file header for the shared shell this now
 * uses). Accordion-style Q&A built on native `<details>/<summary>` — no
 * dedicated Accordion primitive exists in packages/ui yet, and native
 * disclosure elements already give correct keyboard/screen-reader
 * behavior for free.
 *
 * P1.6 (Master Roadmap): title/lead now come from the real CMS backend
 * (see `AboutPageContent.jsx`'s identical comment for the fallback
 * reasoning). This page previously had no visible lead paragraph at
 * all — `cms.faq.description` was rendered only into the SEO meta
 * description, invisible on the page itself — so this is also a small,
 * genuine content gap closed alongside the CMS wiring, not just a
 * source swap. The Q&A list itself stays static i18n content: the CMS
 * only stores one title+body per page, not structured question/answer
 * pairs.
 */

import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { ChevronDown, HelpCircle } from 'lucide-react';
import EditorialPageHero from '../../../../components/EditorialPageHero/EditorialPageHero.jsx';
import useSeo from '../../../../seo/useSeo.js';
import {
  buildBreadcrumbListSchema,
  buildFaqPageSchema,
} from '../../../../seo/structuredData.js';
import { useCmsPageQuery } from '../../queries/useCmsPageQuery.js';
import styles from './FaqPageContent.module.scss';

const QUESTION_KEYS = [
  'booking',
  'payment',
  'cancellation',
  'becomePartner',
  'contactSupport',
];

export default function FaqPageContent() {
  const { t, i18n } = useTranslation();
  const { locale } = useParams();
  const { data: cmsPage } = useCmsPageQuery('faq', i18n.language);
  const title = cmsPage?.title ?? t('cms.faq.title');
  const lead = cmsPage?.content ?? t('cms.faq.description');

  const breadcrumbItems = [
    { label: t('nav.home'), href: `/${locale}` },
    { label: title, href: `/${locale}/faq` },
  ];

  const faqs = QUESTION_KEYS.map((key) => ({
    question: t(`cms.faq.questions.${key}.question`),
    answer: t(`cms.faq.questions.${key}.answer`),
  }));

  useSeo({
    title: `${title} | ${t('app.name')}`,
    description: lead,
    locale,
    path: 'faq',
    jsonLd: [
      buildBreadcrumbListSchema(breadcrumbItems),
      buildFaqPageSchema(faqs),
    ],
  });

  return (
    <div className={styles.page}>
      <EditorialPageHero
        breadcrumbItems={breadcrumbItems}
        heroSeed="faq"
        icon={HelpCircle}
        title={title}
        lead={lead}
      />
      <div className={styles.list}>
        {QUESTION_KEYS.map((key) => (
          <details key={key} className={styles.item}>
            <summary className={styles.question}>
              <span>{t(`cms.faq.questions.${key}.question`)}</span>
              <ChevronDown
                size={18}
                aria-hidden="true"
                className={styles.chevron}
              />
            </summary>
            <p className={styles.answer}>
              {t(`cms.faq.questions.${key}.answer`)}
            </p>
          </details>
        ))}
      </div>
    </div>
  );
}
