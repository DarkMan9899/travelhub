/**
 * BlogPageContent — `/:locale/blog` (Phase 10 redesign). An honest
 * "coming soon" placeholder — no blog/article backend exists, so this
 * deliberately shows no fake posts.
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
import { Section } from '@travelhub/ui/components/layout';
import { EmptyState } from '@travelhub/ui/components/feedback-overlays';
import PageHeader from '../../../../components/PageHeader/PageHeader.jsx';
import useSeo from '../../../../seo/useSeo.js';
import { buildBreadcrumbListSchema } from '../../../../seo/structuredData.js';
import { useCmsPageQuery } from '../../queries/useCmsPageQuery.js';

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
    <Section spacing="default">
      <PageHeader title={title} breadcrumbs={breadcrumbItems} />
      <EmptyState title={t('status.comingSoon')} description={description} />
    </Section>
  );
}
