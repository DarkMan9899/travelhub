/**
 * Domain event envelope factory (Phase 13 — Notifications).
 *
 * Every event published on `DomainEventBus` MUST have this exact,
 * stable shape so any current or future subscriber can rely on it
 * without knowing which module published the event:
 *   eventId, eventType, occurredAt, actorId, resourceType, resourceId,
 *   payload, metadata.
 *
 * The thrown error here is a plain `TypeError` (a programmer-contract
 * violation caught in development/tests), not an `AppError` subclass —
 * this factory is only ever called from trusted internal service code,
 * never from request input, so there is no HTTP boundary to translate
 * the failure for.
 */

import { v4 as uuidv4 } from 'uuid';

export function createDomainEvent({
  eventType,
  actorId = null,
  resourceType,
  resourceId,
  payload = {},
  metadata = {},
}) {
  if (typeof eventType !== 'string' || eventType.trim().length === 0) {
    throw new TypeError('createDomainEvent requires a non-empty "eventType".');
  }
  if (typeof resourceType !== 'string' || resourceType.trim().length === 0) {
    throw new TypeError(
      'createDomainEvent requires a non-empty "resourceType".',
    );
  }
  if (!Number.isInteger(resourceId)) {
    throw new TypeError('createDomainEvent requires an integer "resourceId".');
  }

  return Object.freeze({
    eventId: uuidv4(),
    eventType,
    occurredAt: new Date().toISOString(),
    actorId,
    resourceType,
    resourceId,
    payload,
    metadata,
  });
}

export default createDomainEvent;
