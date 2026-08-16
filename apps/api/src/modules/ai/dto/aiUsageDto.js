/** Admin AI usage-dashboard response DTO (Stage 15.6). */

function toStatRowResponse(row) {
  return {
    feature_code: row.featureCode,
    provider_code: row.providerCode,
    call_count: row.callCount,
    total_tokens: row.totalTokens,
    cache_hits: row.cacheHits,
    failure_count: row.failureCount,
    avg_latency_ms: row.avgLatencyMs,
  };
}

function toRecentLogResponse(log) {
  return {
    id: log.id,
    user_id: log.userId,
    partner_id: log.partnerId,
    feature_code: log.featureCode,
    provider_code: log.providerCode,
    model: log.model,
    total_tokens: log.totalTokens,
    latency_ms: log.latencyMs,
    cache_hit: log.cacheHit,
    succeeded: log.succeeded,
    created_at: log.createdAt,
  };
}

export function toUsageDashboardResponse({ stats, recent }) {
  return {
    stats: stats.map(toStatRowResponse),
    recent: recent.map(toRecentLogResponse),
  };
}
