/** AI Search response DTO (Stage 15.2). */

export function toParsedSearchResponse(parsed) {
  return {
    keyword: parsed.keyword,
    category_id: parsed.categoryId,
    category_name: parsed.categoryName,
    amenity_ids: parsed.amenityIds,
  };
}

export default toParsedSearchResponse;
