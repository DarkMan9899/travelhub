/** AI Recommendations response DTO (Stage 15.4). */

function toListingSummaryResponse(listing) {
  return {
    id: listing.id,
    title: listing.title,
    slug: listing.slug,
    city_name: listing.cityName,
    price_amount: listing.priceAmount,
    currency_code: listing.priceCurrencyCode,
  };
}

export function toRecommendationsResponse(result) {
  return {
    listings: result.listings.map(toListingSummaryResponse),
    blurb: result.blurb,
    based_on: result.basedOn
      ? {
          category: result.basedOn.category,
          city: result.basedOn.city,
          typical_budget: result.basedOn.typicalBudget
            ? {
                amount: result.basedOn.typicalBudget.amount,
                currency: result.basedOn.typicalBudget.currency,
              }
            : null,
        }
      : null,
  };
}

export default toRecommendationsResponse;
