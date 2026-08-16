/**
 * Notifications module response DTOs (BACKEND_ARCHITECTURE.md Ch.9).
 */

export function toNotificationResponse(notification) {
  return {
    id: notification.id,
    event_type: notification.eventType,
    category: notification.categoryCode,
    priority: notification.priorityCode,
    actor_id: notification.actorId,
    resource_type: notification.resourceType,
    resource_id: notification.resourceId,
    payload: notification.payload,
    metadata: notification.metadata,
    is_read: notification.isRead,
    read_at: notification.readAt,
    is_archived: notification.isArchived,
    archived_at: notification.archivedAt,
    created_at: notification.createdAt,
    updated_at: notification.updatedAt,
  };
}

export function toPreferenceResponse(preference) {
  return {
    category: preference.categoryCode,
    in_app_enabled: preference.inAppEnabled,
    email_enabled: preference.emailEnabled,
  };
}

export function toUnreadCountResponse(count) {
  return { unread_count: count };
}
