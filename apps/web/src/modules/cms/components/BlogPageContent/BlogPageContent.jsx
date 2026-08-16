/**
 * BlogPageContent — `/:locale/blog` (Phase 10 redesign). An honest
 * "coming soon" placeholder — no blog/CMS backend exists, so this
 * deliberately shows no fake posts.
 */

import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Section } from '@travelhub/ui/components/layout';
import { EmptyState } from '@travelhub/ui/components/feedback-overlays';
import PageHeader from '../../../../components/PageHeader/PageHeader.jsx';
import useSeo from '../../../../seo/useSeo.js';
import { buildBreadcrumbListSchema } from '../../../../seo/structuredData.js';

export default function BlogPageContent() {
  const { t } = useTranslation();
  const { locale } = useParams();

  const breadcrumbItems = [
    { label: t('nav.home'), href: `/${locale}` },
    { label: t('cms.blog.title'), href: `/${locale}/blog` },
  ];

  useSeo({
    title: `${t('cms.blog.title')} | ${t('app.name')}`,
    description: t('cms.blog.description'),
    locale,
    path: 'blog',
    jsonLd: [buildBreadcrumbListSchema(breadcrumbItems)],
  });

  return (
    <Section spacing="default">
      <PageHeader title={t('cms.blog.title')} breadcrumbs={breadcrumbItems} />
      <EmptyState
        title={t('status.comingSoon')}
        description={t('cms.blog.description')}
      />
    </Section>
  );
}
