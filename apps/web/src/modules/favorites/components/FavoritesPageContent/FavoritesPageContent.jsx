/**
 * FavoritesPageContent — `/:locale/account/favorites` (Customer Account:
 * Favorites). Renders the shared `ListingCardBase` (`components/
 * ListingCardBase`) directly rather than reusing `search`'s
 * `SearchResultCard`: `search` already depends on `favorites` (every
 * `SearchResultCard` renders a `FavoriteButton`), so this page also
 * depending on `search` would close a real
 * `search -> favorites -> FavoritesPageContent -> search` import cycle.
 * `ListingCardBase` lives in module-agnostic shared `components/`, so
 * reusing it directly here has no such back-edge.
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { Grid, Section, Stack } from '@desavii/ui/components/layout';
import {
  Skeleton,
  EmptyState,
  ErrorState,
} from '@desavii/ui/components/feedback-overlays';
import { Button } from '@desavii/ui/components/primitives';
import PageHeader from '../../../../components/PageHeader/PageHeader.jsx';
import ListingCardBase from '../../../../components/ListingCardBase/ListingCardBase.jsx';
import FavoriteButton from '../FavoriteButton/FavoriteButton.jsx';
import { useFavoritesQuery } from '../../queries/useFavoritesQuery.js';

function FavoritesGridSkeleton() {
  return (
    <Grid columns={3} gap="4">
      {Array.from({ length: 6 }, (_, index) => (
        // eslint-disable-next-line react/no-array-index-key -- fixed skeleton count, no real data yet
        <Skeleton key={index} variant="rect" height={280} />
      ))}
    </Grid>
  );
}

export default function FavoritesPageContent() {
  const { t } = useTranslation();
  const { locale } = useParams();
  const navigate = useNavigate();

  const {
    data,
    isPending,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useFavoritesQuery();

  const favorites = useMemo(
    () => data?.pages.flatMap((page) => page.results) ?? [],
    [data],
  );

  return (
    <Section spacing="default">
      <PageHeader
        title={t('favorites.page.heading')}
        breadcrumbs={[
          { label: t('nav.home'), href: `/${locale}` },
          {
            label: t('favorites.page.heading'),
            href: `/${locale}/account/favorites`,
          },
        ]}
      />

      {isError ? (
        <ErrorState
          title={t('favorites.page.errorTitle')}
          retryLabel={t('favorites.page.errorRetry')}
          onRetry={() => refetch()}
        />
      ) : (
        <Stack gap="4">
          {isPending && <FavoritesGridSkeleton />}
          {!isPending && favorites.length === 0 && (
            <EmptyState
              title={t('favorites.page.emptyTitle')}
              description={t('favorites.page.emptyDescription')}
              actionLabel={t('favorites.page.emptyAction')}
              onAction={() => navigate(`/${locale}/search`)}
            />
          )}
          {!isPending && favorites.length > 0 && (
            <Grid columns={3} gap="4">
              {favorites.map((favorite) => (
                <ListingCardBase
                  key={favorite.favorite_id}
                  href={`/${locale}/listings/${favorite.listing_id}`}
                  imageUrl={favorite.cover_image_url}
                  typeLabel={t(`listings.type.${favorite.listing_type}`, {
                    defaultValue: favorite.listing_type,
                  })}
                  favoriteButton={
                    <FavoriteButton listingId={favorite.listing_id} />
                  }
                  title={favorite.title}
                  location={favorite.city_name && <p>{favorite.city_name}</p>}
                  ratingAverage={favorite.rating_average}
                  reviewCount={favorite.review_count}
                  priceAmount={favorite.price_amount}
                  priceCurrencyCode={favorite.price_currency_code}
                  locale={locale}
                />
              ))}
            </Grid>
          )}
          {hasNextPage && (
            <Button
              variant="ghost"
              onClick={() => fetchNextPage()}
              loading={isFetchingNextPage}
            >
              {t('favorites.page.loadMore')}
            </Button>
          )}
        </Stack>
      )}
    </Section>
  );
}
