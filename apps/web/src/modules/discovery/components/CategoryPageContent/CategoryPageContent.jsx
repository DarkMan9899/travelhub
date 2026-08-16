/**
 * CategoryPageContent — `/:locale/categories/:categorySlug` (Phase 20,
 * SEO). A real, indexable landing page per marketplace category (Hotels,
 * Apartments, Tours, etc.) — the Search page's crawl-trap query params
 * (§9) mean Search itself is `noindex`, so category pages are the actual
 * crawlable entry point into each category's inventory, discoverable via
 * the sitemap and internal links (Home, Header nav, Footer).
 *
 * Reuses exactly the same real data sources every other public page
 * already uses — `useCategoriesQuery` (already returns `slug`/`name`/
 * `listing_count`, Phase 4's real taxonomy) and `useSearchListingsQuery`
 * + `SearchResultCard` (the same listing-grid `RelatedListings`/
 * `CompanyProfilePageContent` already reuse) — no new listing-fetch path,
 * no fabricated content.
 */

import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Skeleton,
  ErrorState,
  EmptyState,
} from '@travelhub/ui/components/feedback-overlays';
import { Stack, Grid } from '@travelhub/ui/components/layout';
import PageHeader from '../../../../components/PageHeader/PageHeader.jsx';
import useSeo from '../../../../seo/useSeo.js';
import { buildBreadcrumbListSchema } from '../../../../seo/structuredData.js';
import {
  useCategoriesQuery,
  useSearchListingsQuery,
  SearchResultCard,
} from '../../../search/index.js';

export default function CategoryPageContent() {
  const { t } = useTranslation();
  const { locale, categorySlug } = useParams();
  const navigate = useNavigate();

  const {
    data: categories,
    isPending,
    isError,
    refetch,
  } = useCategoriesQuery({
    locale,
  });
  const category = categories?.find(
    (candidate) => candidate.slug === categorySlug,
  );

  const { data: listingsData, isPending: isListingsPending } =
    useSearchListingsQuery({ categoryId: category?.id }, { locale });
  const listings = listingsData?.pages[0]?.results ?? [];

  const canonicalPath = `categories/${categorySlug}`;
  const breadcrumbItems = category
    ? [
        { label: t('nav.home'), href: `/${locale}` },
        { label: category.name, href: `/${locale}/${canonicalPath}` },
      ]
    : [];

  useSeo({
    title: category
      ? t('seo.category.title', { category: category.name })
      : undefined,
    description: category
      ? t('seo.category.description', { category: category.name })
      : undefined,
    locale,
    path: category ? canonicalPath : undefined,
    noindex: !category,
    skipHreflang: !category,
    jsonLd: category ? [buildBreadcrumbListSchema(breadcrumbItems)] : undefined,
  });

  if (isPending) {
    return (
      <Stack
        gap="6"
        aria-busy="true"
        aria-label={t('discovery.category.loading')}
      >
        <Skeleton variant="text" width="40%" height={32} />
        <Grid columns="auto" gap="4">
          {Array.from({ length: 6 }, (_, index) => (
            // eslint-disable-next-line react/no-array-index-key -- fixed-count skeleton placeholders, no stable identity to key by
            <Skeleton key={index} variant="rect" height={280} />
          ))}
        </Grid>
      </Stack>
    );
  }

  if (isError) {
    return (
      <ErrorState
        title={t('discovery.category.errorTitle')}
        retryLabel={t('discovery.category.retry')}
        onRetry={refetch}
      />
    );
  }

  if (!category) {
    return (
      <EmptyState
        title={t('errors.notFound.title')}
        description={t('errors.notFound.description')}
        actionLabel={t('errors.notFound.action')}
        onAction={() => navigate(`/${locale}`)}
      />
    );
  }

  return (
    <Stack gap="6">
      <PageHeader title={category.name} breadcrumbs={breadcrumbItems} />

      <p>{t('seo.category.description', { category: category.name })}</p>

      {isListingsPending && (
        <Grid columns="auto" gap="4">
          {Array.from({ length: 6 }, (_, index) => (
            // eslint-disable-next-line react/no-array-index-key -- fixed-count skeleton placeholders, no stable identity to key by
            <Skeleton key={index} variant="rect" height={280} />
          ))}
        </Grid>
      )}

      {!isListingsPending && listings.length === 0 && (
        <EmptyState
          title={t('discovery.category.emptyTitle')}
          description={t('discovery.category.emptyDescription')}
        />
      )}

      {!isListingsPending && listings.length > 0 && (
        <Grid columns="auto" gap="4">
          {listings.map((listing) => (
            <SearchResultCard key={listing.id} result={listing} />
          ))}
        </Grid>
      )}
    </Stack>
  );
}
