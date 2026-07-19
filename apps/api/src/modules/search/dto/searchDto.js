/**
 * Search module response DTOs (BACKEND_ARCHITECTURE.md Ch.9).
 *
 * Search results are a list/card view, not the full listing detail —
 * matching `modules/listings/dto/listingDto.js`'s `toListingSummaryResponse`
 * precedent ("summary, not full detail" for list endpoints).
 */

export function toSearchResultResponse(result) {
  return {
    id: result.id,
    partner_id: result.partnerId,
    listing_type: result.listingTypeCode,
    slug: result.slug,
    status: result.statusCode,
    title: result.title,
    summary: result.summary,
    city_id: result.cityId,
    city_name: result.cityName,
    country_id: result.countryId,
    cover_image_url: result.coverImageUrl,
    created_at: result.createdAt,
  };
}

export function toCategoryResultResponse(category) {
  return {
    id: category.id,
    parent_id: category.parentId,
    slug: category.slug,
    name: category.name,
    listing_count: category.listingCount,
  };
}

export function toSuggestionResponse(suggestion) {
  return {
    id: suggestion.id,
    title: suggestion.title,
    slug: suggestion.slug,
  };
}
