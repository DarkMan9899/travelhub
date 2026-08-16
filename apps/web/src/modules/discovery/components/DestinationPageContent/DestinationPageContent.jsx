/**
 * DestinationPageContent — `/:locale/destinations/:citySlug` (Phase 20,
 * SEO). Real, indexable per-city landing page — mirrors
 * `CategoryPageContent`'s exact structure and data-reuse discipline for
 * the destination equivalent (`useDestinationsQuery` instead of
 * `useCategoriesQuery`, `cityId` instead of `categoryId`).
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
  useDestinationsQuery,
  useSearchListingsQuery,
  SearchResultCard,
} from '../../../search/index.js';

export default function DestinationPageContent() {
  const { t } = useTranslation();
  const { locale, citySlug } = useParams();
  const navigate = useNavigate();

  const {
    data: destinations,
    isPending,
    isError,
    refetch,
  } = useDestinationsQuery({ locale });
  const destination = destinations?.find(
    (candidate) => candidate.slug === citySlug,
  );

  const { data: listingsData, isPending: isListingsPending } =
    useSearchListingsQuery({ cityId: destination?.id }, { locale });
  const listings = listingsData?.pages[0]?.results ?? [];

  const canonicalPath = `destinations/${citySlug}`;
  const breadcrumbItems = destination
    ? [
        { label: t('nav.home'), href: `/${locale}` },
        { label: destination.name, href: `/${locale}/${canonicalPath}` },
      ]
    : [];

  useSeo({
    title: destination
      ? t('seo.destination.title', { city: destination.name })
      : undefined,
    description: destination
      ? t('seo.destination.description', { city: destination.name })
      : undefined,
    locale,
    path: destination ? canonicalPath : undefined,
    noindex: !destination,
    skipHreflang: !destination,
    jsonLd: destination
      ? [buildBreadcrumbListSchema(breadcrumbItems)]
      : undefined,
  });

  if (isPending) {
    return (
      <Stack
        gap="6"
        aria-busy="true"
        aria-label={t('discovery.destination.loading')}
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
        title={t('discovery.destination.errorTitle')}
        retryLabel={t('discovery.destination.retry')}
        onRetry={refetch}
      />
    );
  }

  if (!destination) {
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
      <PageHeader title={destination.name} breadcrumbs={breadcrumbItems} />

      <p>{t('seo.destination.description', { city: destination.name })}</p>

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
          title={t('discovery.destination.emptyTitle')}
          description={t('discovery.destination.emptyDescription')}
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
