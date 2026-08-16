/**
 * MySQL-backed AI usage log repository (Phase 15). Append-only —
 * written once per `AiService` call (success or failure), read by the
 * Admin AI usage dashboard (`GET /admin/ai/usage`, Stage 15.6).
 */

import { getMysqlPool } from '../../../infrastructure/database/mysqlPool.js';

function toUsageDomain(row) {
  return {
    id: row.id,
    userId: row.user_id,
    partnerId: row.partner_id,
    featureCode: row.feature_code,
    providerCode: row.provider_code,
    model: row.model,
    promptTokens: row.prompt_tokens,
    completionTokens: row.completion_tokens,
    totalTokens: row.total_tokens,
    latencyMs: row.latency_ms,
    cacheHit: Boolean(row.cache_hit),
    succeeded: Boolean(row.succeeded),
    createdAt: row.created_at,
  };
}

export class MySqlAiUsageRepository {
  #pool;

  constructor(pool = getMysqlPool()) {
    this.#pool = pool;
  }

  async record({
    userId = null,
    partnerId = null,
    featureCode,
    providerCode,
    model = null,
    promptTokens = 0,
    completionTokens = 0,
    latencyMs = 0,
    cacheHit = false,
    succeeded = true,
  }) {
    await this.#pool.query(
      `INSERT INTO ai_usage_logs
         (user_id, partner_id, feature_code, provider_code, model,
          prompt_tokens, completion_tokens, total_tokens, latency_ms,
          cache_hit, succeeded)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        partnerId,
        featureCode,
        providerCode,
        model,
        promptTokens,
        completionTokens,
        promptTokens + completionTokens,
        latencyMs,
        cacheHit ? 1 : 0,
        succeeded ? 1 : 0,
      ],
    );
  }

  /**
   * Aggregate stats grouped by feature, for the Admin AI usage dashboard
   * (`since`-only) and the Partner AI Usage page (`partnerId`-scoped,
   * Phase 15 "AI Polish" sprint — reuses this same query/DTO shape, just
   * adds one more `WHERE` condition against the `partner_id` column
   * every row has already carried since `0023_ai_platform.up.sql`).
   */
  async getAggregateStats({ since, partnerId } = {}) {
    const conditions = [];
    const params = [];
    if (since) {
      conditions.push('created_at >= ?');
      params.push(since);
    }
    if (partnerId !== undefined) {
      conditions.push('partner_id = ?');
      params.push(partnerId);
    }
    const whereClause = conditions.length
      ? `WHERE ${conditions.join(' AND ')}`
      : '';
    const [rows] = await this.#pool.query(
      `SELECT feature_code, provider_code,
              COUNT(*) AS call_count,
              SUM(total_tokens) AS total_tokens,
              SUM(cache_hit) AS cache_hits,
              SUM(CASE WHEN succeeded = 0 THEN 1 ELSE 0 END) AS failure_count,
              AVG(latency_ms) AS avg_latency_ms
       FROM ai_usage_logs
       ${whereClause}
       GROUP BY feature_code, provider_code
       ORDER BY call_count DESC`,
      params,
    );
    return rows.map((row) => ({
      featureCode: row.feature_code,
      providerCode: row.provider_code,
      callCount: Number(row.call_count),
      totalTokens: Number(row.total_tokens ?? 0),
      cacheHits: Number(row.cache_hits ?? 0),
      failureCount: Number(row.failure_count ?? 0),
      avgLatencyMs: Math.round(Number(row.avg_latency_ms ?? 0)),
    }));
  }

  async listRecent({ limit = 50, partnerId } = {}) {
    const conditions = [];
    const params = [];
    if (partnerId !== undefined) {
      conditions.push('partner_id = ?');
      params.push(partnerId);
    }
    const whereClause = conditions.length
      ? `WHERE ${conditions.join(' AND ')}`
      : '';
    params.push(limit);
    const [rows] = await this.#pool.query(
      `SELECT * FROM ai_usage_logs ${whereClause} ORDER BY created_at DESC, id DESC LIMIT ?`,
      params,
    );
    return rows.map(toUsageDomain);
  }
}

export default MySqlAiUsageRepository;
