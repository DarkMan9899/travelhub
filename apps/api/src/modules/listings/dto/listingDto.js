/**
 * Listings module response DTOs (BACKEND_ARCHITECTURE.md Ch.9).
 *
 * Listings' domain shape (nested translations/location/categories/
 * amenities/media) is richer than Users', so — like `modules/auth/dto/
 * authDto.js` — the mapping lives in its own file rather than inlined in
 * the Controller.
 */

export function toTranslationResponse(translation) {
  return {
    language_id: translation.languageId,
    title: translation.title,
    summary: translation.summary,
    description: translation.description,
    seo_title: translation.seoTitle,
    seo_description: translation.seoDescription,
  };
}

export function toLocationResponse(location) {
  if (!location) return null;
  return {
    address_id: location.addressId,
    city_id: location.cityId,
    latitude: location.latitude,
    longitude: location.longitude,
  };
}

export function toMediaResponse(media) {
  return {
    id: media.id,
    media_type: media.mediaTypeCode,
    url: media.url,
    thumbnail_url: media.thumbnailUrl,
    position: media.position,
    is_cover: media.isCover,
    moderation_status: media.moderationStatusCode,
    mime_type: media.mimeType,
    file_size_bytes: media.fileSizeBytes,
    created_at: media.createdAt,
  };
}

export function toListingResponse(listing) {
  return {
    id: listing.id,
    partner_id: listing.partnerId,
    listing_type: listing.listingTypeCode,
    slug: listing.slug,
    status: listing.statusCode,
    moderation_status: listing.moderationStatusCode,
    is_contact_visible: listing.isContactVisible,
    is_featured: listing.isFeatured,
    published_at: listing.publishedAt,
    unpublished_at: listing.unpublishedAt,
    canonical_url: listing.canonicalUrl,
    og_image_media_id: listing.ogImageMediaId,
    is_indexable: listing.isIndexable,
    is_sitemap_included: listing.isSitemapIncluded,
    translations: listing.translations.map(toTranslationResponse),
    location: toLocationResponse(listing.location),
    category_ids: listing.categoryIds,
    amenity_ids: listing.amenityIds,
    media: listing.media.map(toMediaResponse),
    created_at: listing.createdAt,
    updated_at: listing.updatedAt,
  };
}

export function toListingSummaryResponse(listing) {
  return {
    id: listing.id,
    partner_id: listing.partnerId,
    listing_type: listing.listingTypeCode,
    slug: listing.slug,
    status: listing.statusCode,
    is_featured: listing.isFeatured,
    created_at: listing.createdAt,
    updated_at: listing.updatedAt,
  };
}
