/** Admin AI moderation response DTO (Stage 15.6). */

function toQueueEntryResponse(entry) {
  return {
    listing_id: entry.listingId,
    title: entry.title,
    partner_id: entry.partnerId,
    partner_display_name: entry.partnerDisplayName,
    score: entry.score,
    signals: entry.signals,
  };
}

export function toModerationQueueResponse(entries) {
  return { entries: entries.map(toQueueEntryResponse) };
}

export function toModerationScoreResponse(result) {
  return {
    listing_id: result.listingId,
    heuristic_score: result.heuristicScore,
    signals: result.signals,
    ai_note: result.aiNote,
  };
}
