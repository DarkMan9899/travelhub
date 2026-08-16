/** Trip Planner response DTOs (Stage 15.1). */

function toDailyPlanEntryResponse(day) {
  return {
    day: day.day,
    estimated_cost: day.estimatedCost,
    listings: day.listings.map((listing) => ({
      id: listing.id,
      title: listing.title,
      slug: listing.slug,
      city_name: listing.cityName,
      price_per_night: listing.pricePerNight,
      currency: listing.currency,
    })),
  };
}

export function toTripPlanResponse(plan) {
  return {
    conversation_id: plan.conversationId,
    destination: plan.destination,
    days: plan.days,
    budget: plan.budget,
    currency: plan.currency,
    interests: plan.interests,
    daily_plan: plan.dailyPlan.map(toDailyPlanEntryResponse),
    total_estimated_budget: plan.totalEstimatedBudget,
    narrative: plan.narrative,
  };
}

export function toAiConversationResponse(conversation) {
  return {
    id: conversation.id,
    feature_code: conversation.featureCode,
    title: conversation.title,
    created_at: conversation.createdAt,
    updated_at: conversation.updatedAt,
    messages: conversation.messages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      created_at: message.createdAt,
    })),
  };
}
