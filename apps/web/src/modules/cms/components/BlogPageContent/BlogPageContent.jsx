/**
 * BlogPageContent — `/:locale/blog` (Phase 10 redesign; editorial
 * redesign in the 2026 public-frontend audit's static-page pass — see
 * `EditorialPageHero`'s own file header for the shared shell this now
 * uses). An honest "coming soon" placeholder — no blog/article backend
 * exists, so this deliberately shows no fake posts; the redesign here is
 * purely presentational (a proper hero instead of a bare title, the same
 * `EmptyState` content inside an elevated card instead of sitting bare
 * on the page) — not a fabricated article grid.
 *
 * P1.6 (Master Roadmap): title/description now check the real CMS
 * backend first (see `AboutPageContent.jsx`'s identical comment for the
 * fallback reasoning) — currently a no-op in practice, since this page's
 * seeded CMS row is `isPublished: false` (404s, falls straight back to
 * the static i18n copy below), but an admin publishing real content for
 * this slug via the CMS editor now takes effect immediately, with zero
 * further code changes, exactly like the other five pages.
 */

import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Newspaper } from 'lucide-react';
import { EmptyState } from '@desavii/ui/components/feedback-overlays';
import EditorialPageHero from '../../../../components/EditorialPageHero/EditorialPageHero.jsx';
import useSeo from '../../../../seo/useSeo.js';
import { buildBreadcrumbListSchema } from '../../../../seo/structuredData.js';
import { useCmsPageQuery } from '../../queries/useCmsPageQuery.js';
import styles from './BlogPageContent.module.scss';

export default function BlogPageContent() {
  const { t, i18n } = useTranslation();
  const { locale } = useParams();
  const { data: cmsPage } = useCmsPageQuery('blog', i18n.language);
  const title = cmsPage?.title ?? t('cms.blog.title');
  const description = cmsPage?.content ?? t('cms.blog.description');

  const breadcrumbItems = [
    { label: t('nav.home'), href: `/${locale}` },
    { label: title, href: `/${locale}/blog` },
  ];

  useSeo({
    title: `${title} | ${t('app.name')}`,
    description,
    locale,
    path: 'blog',
    jsonLd: [buildBreadcrumbListSchema(breadcrumbItems)],
  });

  return (
    <div className={styles.page}>
      <EditorialPageHero
        breadcrumbItems={breadcrumbItems}
        heroSeed="blog"
        icon={Newspaper}
        title={title}
      />
      <div className={styles.comingSoon}>
        <EmptyState title={t('status.comingSoon')} description={description} />
      </div>
    </div>
  );
}
