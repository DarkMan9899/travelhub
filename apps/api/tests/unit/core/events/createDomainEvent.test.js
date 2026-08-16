/**
 * Phase 13: the event envelope factory must always produce the exact,
 * stable contract every current/future subscriber relies on —
 * eventId/eventType/occurredAt/actorId/resourceType/resourceId/payload/
 * metadata — and reject malformed input early (a programmer error, not
 * a request-input validation case).
 */

import { describe, test, expect } from '@jest/globals';
import { createDomainEvent } from '../../../../src/core/events/createDomainEvent.js';

describe('createDomainEvent', () => {
  test('produces the full stable envelope shape', () => {
    const event = createDomainEvent({
      eventType: 'booking.created',
      actorId: 42,
      resourceType: 'booking',
      resourceId: 7,
      payload: { bookingReference: 'BK-1' },
      metadata: { requestId: 'req-1' },
    });

    expect(event).toEqual({
      eventId: expect.any(String),
      eventType: 'booking.created',
      occurredAt: expect.any(String),
      actorId: 42,
      resourceType: 'booking',
      resourceId: 7,
      payload: { bookingReference: 'BK-1' },
      metadata: { requestId: 'req-1' },
    });
  });

  test('generates a distinct eventId per call', () => {
    const makeEvent = () =>
      createDomainEvent({
        eventType: 'booking.created',
        resourceType: 'booking',
        resourceId: 1,
      });
    const first = makeEvent();
    const second = makeEvent();
    expect(first.eventId).not.toBe(second.eventId);
  });

  test('occurredAt is a valid ISO timestamp', () => {
    const event = createDomainEvent({
      eventType: 'booking.created',
      resourceType: 'booking',
      resourceId: 1,
    });
    expect(new Date(event.occurredAt).toISOString()).toBe(event.occurredAt);
  });

  test('defaults actorId to null, payload/metadata to empty objects', () => {
    const event = createDomainEvent({
      eventType: 'favorite.added',
      resourceType: 'listing',
      resourceId: 3,
    });
    expect(event.actorId).toBeNull();
    expect(event.payload).toEqual({});
    expect(event.metadata).toEqual({});
  });

  test('throws on a missing eventType', () => {
    expect(() =>
      createDomainEvent({ resourceType: 'booking', resourceId: 1 }),
    ).toThrow(TypeError);
  });

  test('throws on a missing resourceType', () => {
    expect(() =>
      createDomainEvent({ eventType: 'booking.created', resourceId: 1 }),
    ).toThrow(TypeError);
  });

  test('throws on a non-integer resourceId', () => {
    expect(() =>
      createDomainEvent({
        eventType: 'booking.created',
        resourceType: 'booking',
        resourceId: 'not-a-number',
      }),
    ).toThrow(TypeError);
  });

  test('the returned envelope is frozen (immutable)', () => {
    const event = createDomainEvent({
      eventType: 'booking.created',
      resourceType: 'booking',
      resourceId: 1,
    });
    expect(Object.isFrozen(event)).toBe(true);
  });
});
