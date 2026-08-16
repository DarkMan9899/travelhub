/**
 * ListingDetailPageContent — the `listings` module's page-level content
 * for `/:locale/listings/:id`. Phase 18 (Premium Listing Detail):
 * replaces the old flat `PageHeader` + grid-only gallery with a real
 * hero (`ListingHero` — mosaic gallery, title, location, rating,
 * partner-authored highlights, Ask AI / Favorite / Share actions), a new
 * `ListingAboutSection` (the listing's description, previously rendered
 * nowhere on this page despite existing on every translation), and a
 * sticky `ListingSectionNav` for jumping around the now-longer page.
 * Every other section (Attributes/Amenities/Policies/Availability/
 * Location/Reviews/Related) is unchanged this stage — their own visual
 * redesign is a later Phase 18 stage — only gaining an `id` anchor for
 * the new section nav to target.
 *
 * Two distinct error states: a genuine 404 (an unpublished/deleted/
 * nonexistent listing — `ListingService.getListing`'s visibility rule
 * never leaks draft existence to the public) renders the same
 * `errors.notFound.*` `EmptyState` `NotFoundPage` itself uses, since
 * that's what this functionally is; any other failure (network, 500)
 * gets the generic retryable `ErrorState`.
 */

import { Fragment, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Skeleton,
  ErrorState,
  EmptyState,
} from '@travelhub/ui/components/feedback-overlays';
import { Section, Stack, Inline } from '@travelhub/ui/components/layout';
import { Breadcrumbs } from '@travelhub/ui/components/navigation';
import RouterLink from '../../../../components/RouterLink.jsx';
import ShareButton from '../../../../components/ShareButton/ShareButton.jsx';
import useSeo from '../../../../seo/useSeo.js';
import {
  buildBreadcrumbListSchema,
  buildListingSchema,
  buildFaqPageSchema,
} from '../../../../seo/structuredData.js';
import { useListingQuery } from '../../queries/useListingQuery.js';
import { useListingMetadataQuery } from '../../queries/useListingMetadataQuery.js';
import { useListingCategoriesQuery } from '../../queries/useListingCategoriesQuery.js';
import getLocalizedTranslation from '../../utils/getLocalizedTranslation.js';
import ListingHero from './ListingHero/ListingHero.jsx';
import ListingSectionNav from './ListingSectionNav/ListingSectionNav.jsx';
import ListingAboutSection from './ListingAboutSection/ListingAboutSection.jsx';
import ListingReservationWidget from './ListingReservationWidget/ListingReservationWidget.jsx';
import MobileBookingBar from './MobileBookingBar/MobileBookingBar.jsx';
import ListingAttributesSection from './ListingAttributesSection/ListingAttributesSection.jsx';
import ListingItinerarySection from './ListingItinerarySection/ListingItinerarySection.jsx';
import ListingIncludedSection from './ListingIncludedSection/ListingIncludedSection.jsx';
import ListingAmenitiesSection from './ListingAmenitiesSection/ListingAmenitiesSection.jsx';
import ListingPoliciesSection from './ListingPoliciesSection/ListingPoliciesSection.jsx';
import ListingAvailabilitySection from './ListingAvailabilitySection/ListingAvailabilitySection.jsx';
import ListingLocationSection from './ListingLocationSection/ListingLocationSection.jsx';
import ListingReviewsSection from './ListingReviewsSection/ListingReviewsSection.jsx';
import ListingFaqSection from './ListingFaqSection/ListingFaqSection.jsx';
import RelatedListings from './RelatedListings/RelatedListings.jsx';
import { FavoriteButton } from '../../../favorites/index.js';
import { AskAiButton } from '../../../ai/index.js';
import {
  resolvePresentationGroup,
  reorderSections,
  resolveBookingCtaKey,
} from '../../utils/categoryPresentation.js';
import styles from './ListingDetailPageContent.module.scss';

const SECTION_ABOUT = 'about';
const SECTION_ITINERARY = 'itinerary';
const SECTION_INCLUDED = 'included';
const SECTION_ATTRIBUTES = 'attributes';
const SECTION_AMENITIES = 'amenities';
const SECTION_POLICIES = 'policies';
const SECTION_AVAILABILITY = 'availability';
const SECTION_LOCATION = 'location';
const SECTION_REVIEWS = 'reviews';
const SECTION_FAQ = 'faq';

export default function ListingDetailPageContent() {
  const { t } = useTranslation();
  // `id` is the raw path segment — Phase 20 (SEO) route accepts either the
  // numeric id (legacy/still-shared links) or the listing's slug (the
  // canonical, indexable form); the backend resolves either the same way
  // (see `listingService.getListing`). Never coerced to Number here, since
  // a slug isn't numeric.
  const { locale, id } = useParams();
  const navigate = useNavigate();

  const {
    data: listing,
    isPending,
    isError,
    error,
    refetch,
  } = useListingQuery(id);

  const categoryId = listing?.category_ids?.[0];
  const {
    data: metadata,
    isPending: isMetadataPending,
    isError: isMetadataError,
    refetch: refetchMetadata,
  } = useListingMetadataQuery(categoryId, locale);
  const { data: categories } = useListingCategoriesQuery(locale);
  const category = (categories ?? []).find(
    (candidate) => candidate.id === categoryId,
  );

  const translation = listing
    ? getLocalizedTranslation(listing.translations, locale)
    : null;

  // Canonicalizes on the slug: a visit via the legacy numeric-id URL (or
  // any URL that no longer matches the listing's current slug, e.g. after
  // a partner renames it) is swapped to the slug URL once it's known —
  // `replace` so the numeric URL never lingers in browser history and a
  // shared old link converges on the one canonical URL, matching the
  // `<link rel="canonical">` this same page emits below.
  useEffect(() => {
    if (listing?.slug && listing.slug !== id) {
      navigate(`/${locale}/listings/${listing.slug}`, { replace: true });
    }
  }, [listing?.slug, id, locale, navigate]);

  const seoTitle = translation?.seo_title || translation?.title;
  const seoDescription =
    translation?.seo_description ??
    translation?.summary ??
    translation?.description;
  const canonicalPath = listing
    ? `listings/${listing.slug ?? listing.id}`
    : undefined;
  const listingJsonLd =
    listing && translation
      ? buildListingSchema({
          listing: {
            ...listing,
            title: translation.title,
            description: translation.summary ?? translation.description,
          },
          categoryCode: category?.slug,
          locale,
          path: canonicalPath,
        })
      : null;
  const faqJsonLd = listing ? buildFaqPageSchema(listing.faqs) : null;
  const breadcrumbItems = listing
    ? [
        { label: t('nav.home'), href: `/${locale}` },
        {
          label: translation?.title ?? listing.slug,
          href: `/${locale}/listings/${listing.slug ?? listing.id}`,
        },
      ]
    : [];

  const cityName = listing?.location?.city_name;
  let seoPageTitle;
  if (listing) {
    seoPageTitle = cityName
      ? t('seo.listingDetail.titleWithLocation', {
          title: seoTitle,
          location: cityName,
        })
      : t('seo.listingDetail.titleNoLocation', { title: seoTitle });
  }
  useSeo({
    title: seoPageTitle,
    description: seoDescription,
    locale,
    path: canonicalPath,
    noindex: listing
      ? !listing.is_indexable || listing.status !== 'PUBLISHED'
      : true,
    skipHreflang: !listing,
    jsonLd: listing
      ? [
          listingJsonLd,
          buildBreadcrumbListSchema(breadcrumbItems),
          faqJsonLd,
        ].filter(Boolean)
      : undefined,
  });

  if (isPending) {
    return (
      <Stack
        gap="6"
        role="status"
        aria-busy="true"
        aria-label={t('pages.listingDetail.loading')}
      >
        <Skeleton variant="text" width="30%" height={20} />
        <Skeleton variant="rect" height={420} />
        <Skeleton variant="text" width="50%" height={32} />
        <div className={styles.layout}>
          <div className={styles.main}>
            <Skeleton variant="text" width="30%" height={24} />
            <Skeleton variant="rect" height={160} />
            <Skeleton variant="rect" height={160} />
          </div>
          <div className={styles.sidebar}>
            <Skeleton variant="rect" height={280} />
          </div>
        </div>
      </Stack>
    );
  }

  if (isError) {
    if (error.status === 404) {
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
      <ErrorState
        title={t('pages.listingDetail.errorTitle')}
        retryLabel={t('pages.listingDetail.retry')}
        onRetry={refetch}
      />
    );
  }

  const title = translation?.title ?? listing.slug;
  const description = translation?.summary ?? translation?.description;

  const sections = [
    description && {
      id: SECTION_ABOUT,
      label: t('pages.listingDetail.about.heading'),
    },
    listing.itinerary_steps?.length > 0 && {
      id: SECTION_ITINERARY,
      label: t('pages.listingDetail.itinerary.heading'),
    },
    listing.included_items?.length > 0 && {
      id: SECTION_INCLUDED,
      label: t('pages.listingDetail.included.heading'),
    },
    metadata?.attributes?.length > 0 && {
      id: SECTION_ATTRIBUTES,
      label: t('pages.listingDetail.attributes.heading'),
    },
    metadata?.amenity_groups?.length > 0 &&
      listing.amenity_ids?.length > 0 && {
        id: SECTION_AMENITIES,
        label: t('pages.listingDetail.amenities.heading'),
      },
    metadata?.policies?.length > 0 && {
      id: SECTION_POLICIES,
      label: t('pages.listingDetail.policies.heading'),
    },
    {
      id: SECTION_AVAILABILITY,
      label: t('pages.listingDetail.availability.heading'),
    },
    listing.location && {
      id: SECTION_LOCATION,
      label: t('pages.listingDetail.location.heading'),
    },
    { id: SECTION_REVIEWS, label: t('pages.listingDetail.reviews.heading') },
    listing.faqs?.length > 0 && {
      id: SECTION_FAQ,
      label: t('pages.listingDetail.faq.heading'),
    },
  ].filter(Boolean);

  // Phase 18.7 (Category-Specific Detail Experiences) — same sections,
  // same components, no per-category markup fork: only the reading order
  // (and the reservation panel's CTA copy, see `bookingCtaKey` below)
  // adapts to what actually matters first for this listing's type.
  const presentationGroup = resolvePresentationGroup(listing.listing_type);
  const orderedSections = reorderSections(sections, presentationGroup);
  const bookingCtaKey = resolveBookingCtaKey(presentationGroup);

  const sectionElements = {
    [SECTION_ABOUT]: (
      <ListingAboutSection
        description={description}
        sectionId={SECTION_ABOUT}
      />
    ),
    [SECTION_ITINERARY]: (
      <ListingItinerarySection
        steps={listing.itinerary_steps}
        sectionId={SECTION_ITINERARY}
      />
    ),
    [SECTION_INCLUDED]: (
      <ListingIncludedSection
        items={listing.included_items}
        sectionId={SECTION_INCLUDED}
      />
    ),
    [SECTION_ATTRIBUTES]: metadata && (
      <ListingAttributesSection
        attributes={metadata.attributes}
        listing={listing}
        sectionId={SECTION_ATTRIBUTES}
      />
    ),
    [SECTION_AMENITIES]: metadata && (
      <ListingAmenitiesSection
        amenityGroups={metadata.amenity_groups}
        amenityIds={listing.amenity_ids}
        sectionId={SECTION_AMENITIES}
      />
    ),
    [SECTION_POLICIES]: metadata && (
      <ListingPoliciesSection
        policies={metadata.policies}
        listing={listing}
        sectionId={SECTION_POLICIES}
      />
    ),
    [SECTION_AVAILABILITY]: (
      <ListingAvailabilitySection
        listingId={listing.id}
        sectionId={SECTION_AVAILABILITY}
      />
    ),
    [SECTION_LOCATION]: (
      <ListingLocationSection
        location={listing.location}
        title={title}
        sectionId={SECTION_LOCATION}
      />
    ),
    [SECTION_REVIEWS]: (
      <ListingReviewsSection
        listingId={listing.id}
        ratingAverage={listing.rating_average}
        reviewCount={listing.review_count}
        sectionId={SECTION_REVIEWS}
      />
    ),
    [SECTION_FAQ]: (
      <ListingFaqSection faqs={listing.faqs} sectionId={SECTION_FAQ} />
    ),
  };

  return (
    <Stack gap="6">
      <Breadcrumbs items={breadcrumbItems} linkComponent={RouterLink} />

      <ListingHero
        media={listing.media}
        title={title}
        categoryLabel={category?.name ?? null}
        cityName={listing.location?.city_name ?? null}
        countryName={listing.location?.country_name ?? null}
        ratingAverage={listing.rating_average}
        reviewCount={listing.review_count}
        highlights={listing.highlights}
        reviewsAnchorId={SECTION_REVIEWS}
        actions={
          <Inline gap="2" align="center">
            <AskAiButton
              label={t('ai.contextButtons.askAboutListing')}
              contextType="listing"
              contextId={listing.id}
              initialMessage={t('ai.contextButtons.listingInitialMessage')}
              variant="ghost"
              size="sm"
            />
            <ShareButton title={title} />
            <FavoriteButton listingId={listing.id} />
          </Inline>
        }
      />

      <ListingSectionNav sections={orderedSections} />

      <div className={styles.layout}>
        <div className={styles.main}>
          {isMetadataPending && (
            <Section aria-label={t('pages.listingDetail.loading')}>
              <Skeleton variant="rect" height={160} />
            </Section>
          )}
          {isMetadataError && (
            <ErrorState
              title={t('pages.listingDetail.errorTitle')}
              retryLabel={t('pages.listingDetail.retry')}
              onRetry={refetchMetadata}
            />
          )}

          {orderedSections.map(({ id: sectionId }) => (
            <Fragment key={sectionId}>{sectionElements[sectionId]}</Fragment>
          ))}

          <RelatedListings
            categoryId={categoryId}
            excludeListingId={listing.id}
          />
        </div>

        <aside className={styles.sidebar}>
          <ListingReservationWidget
            listingId={listing.id}
            pricing={listing.pricing}
            bookingCtaKey={bookingCtaKey}
          />
        </aside>
      </div>

      <div className={styles.mobileBarSpacer} aria-hidden="true" />
      <MobileBookingBar
        listingId={listing.id}
        pricing={listing.pricing}
        bookingCtaKey={bookingCtaKey}
      />
    </Stack>
  );
}
