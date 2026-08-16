/**
 * Audit Log module response DTO — Stage 11.7 Admin Platform.
 */

export function toAuditLogResponse(entry) {
  return {
    id: entry.id,
    actor_id: entry.actorId,
    actor_name: entry.actorName,
    action: entry.action,
    target_type: entry.targetType,
    target_id: entry.targetId,
    before_snapshot: entry.beforeSnapshot,
    after_snapshot: entry.afterSnapshot,
    ip_address: entry.ipAddress,
    created_at: entry.createdAt,
  };
}
