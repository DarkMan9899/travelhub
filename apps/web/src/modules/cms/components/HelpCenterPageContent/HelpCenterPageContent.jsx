/**
 * HelpCenterPageContent — `/:locale/help` (Phase 10 redesign; editorial
 * redesign in the 2026 public-frontend audit's static-page pass — see
 * `EditorialPageHero`'s own file header for the shared shell this now
 * uses). A hub of links into the other real support surfaces (FAQ,
 * Contact) — not a ticketing/search system, since no backend exists for
 * one. Exactly two real support paths, so this gives each one strong,
 * deliberate hierarchy rather than padding out a list.
 *
 * P1.6 (Master Roadmap): title/lead now come from the real CMS backend
 * (see `AboutPageContent.jsx`'s identical comment for the fallback
 * reasoning). The links grid stays static: it's navigation, not content.
 */

import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { ArrowRight, HelpCircle, LifeBuoy, Mail } from 'lucide-react';
import RouterLink from '../../../../components/RouterLink.jsx';
import EditorialPageHero from '../../../../components/EditorialPageHero/EditorialPageHero.jsx';
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
    <div className={styles.page}>
      <EditorialPageHero
        breadcrumbItems={breadcrumbItems}
        heroSeed="help"
        icon={LifeBuoy}
        title={title}
        lead={lead}
      />
      <div className={styles.linksGrid}>
        {links.map(({ key, href, icon: LinkIcon }) => (
          <RouterLink key={key} href={href} className={styles.linkCard}>
            <span className={styles.linkIcon} aria-hidden="true">
              <LinkIcon size={26} />
            </span>
            <ArrowRight
              size={18}
              aria-hidden="true"
              className={styles.linkArrow}
            />
            <span className={styles.linkTitle}>
              {t(`cms.help.links.${key}.title`)}
            </span>
            <span className={styles.linkDescription}>
              {t(`cms.help.links.${key}.description`)}
            </span>
          </RouterLink>
        ))}
      </div>
    </div>
  );
}
