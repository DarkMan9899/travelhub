/**
 * ContactPageContent — `/:locale/contact` (Phase 10 redesign; editorial
 * redesign in the 2026 public-frontend audit's static-page pass — see
 * `EditorialPageHero`'s own file header for the shared shell this now
 * uses). Deliberately static support info (email/hours), not a
 * submission form — no backend endpoint exists to receive contact
 * messages, and a form that silently drops submissions would be
 * dishonest. See the Phase 10 plan's "explicit scope decisions" for the
 * reasoning.
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
import { Mail, Clock, MessageCircle } from 'lucide-react';
import EditorialPageHero from '../../../../components/EditorialPageHero/EditorialPageHero.jsx';
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
    <div className={styles.page}>
      <EditorialPageHero
        breadcrumbItems={breadcrumbItems}
        heroSeed="contact"
        icon={MessageCircle}
        title={title}
        lead={lead}
      />
      <div className={styles.methods}>
        <a href="mailto:support@desavii.com" className={styles.emailCard}>
          <span className={styles.methodIcon} aria-hidden="true">
            <Mail size={22} />
          </span>
          <span className={styles.methodBody}>
            <span className={styles.methodLabel}>support@desavii.com</span>
          </span>
        </a>
        <div className={styles.hoursCard}>
          <span className={styles.methodIcon} aria-hidden="true">
            <Clock size={22} />
          </span>
          <span className={styles.methodBody}>
            <span className={styles.methodLabel}>{t('cms.contact.hours')}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
