/**
 * Phase 13: the bus's whole reason to exist is multi-subscriber
 * independence — publishers never know who's listening, subscribers
 * never know about each other, and one subscriber's failure must never
 * affect another subscriber or the publisher. These tests prove that
 * capability directly rather than just asserting it in a comment.
 */

import { describe, test, expect, jest } from '@jest/globals';
import { DomainEventBus } from '../../../../src/core/events/domainEventBus.js';
import { createDomainEvent } from '../../../../src/core/events/createDomainEvent.js';

function makeEvent(overrides = {}) {
  return createDomainEvent({
    eventType: 'booking.created',
    resourceType: 'booking',
    resourceId: 1,
    ...overrides,
  });
}

describe('DomainEventBus', () => {
  test('publish() with zero subscribers is a safe no-op', async () => {
    const bus = new DomainEventBus();
    await expect(bus.publish(makeEvent())).resolves.toBeUndefined();
  });

  test('every independently-registered subscriber for the event type is invoked', async () => {
    const bus = new DomainEventBus();
    const first = jest.fn();
    const second = jest.fn();
    const third = jest.fn();

    bus.subscribe('booking.created', first);
    bus.subscribe('booking.created', second);
    bus.subscribe('booking.confirmed', third);

    const event = makeEvent();
    await bus.publish(event);

    expect(first).toHaveBeenCalledWith(event);
    expect(second).toHaveBeenCalledWith(event);
    expect(third).not.toHaveBeenCalled();
  });

  test('one subscriber throwing does not prevent another subscriber from running', async () => {
    const bus = new DomainEventBus();
    const failing = jest.fn(() => {
      throw new Error('listener boom');
    });
    const succeeding = jest.fn();

    bus.subscribe('booking.created', failing);
    bus.subscribe('booking.created', succeeding);

    await bus.publish(makeEvent());

    expect(failing).toHaveBeenCalled();
    expect(succeeding).toHaveBeenCalled();
  });

  test('one subscriber rejecting does not prevent another subscriber from running', async () => {
    const bus = new DomainEventBus();
    const failing = jest.fn(() => Promise.reject(new Error('async boom')));
    const succeeding = jest.fn(() => Promise.resolve());

    bus.subscribe('booking.created', failing);
    bus.subscribe('booking.created', succeeding);

    await bus.publish(makeEvent());

    expect(failing).toHaveBeenCalled();
    expect(succeeding).toHaveBeenCalled();
  });

  test('publish() never throws back to the caller, even when every subscriber fails', async () => {
    const bus = new DomainEventBus();
    bus.subscribe('booking.created', () => {
      throw new Error('boom 1');
    });
    bus.subscribe('booking.created', () => Promise.reject(new Error('boom 2')));

    await expect(bus.publish(makeEvent())).resolves.toBeUndefined();
  });

  test('subscribe() returns an unsubscribe function that stops further delivery', async () => {
    const bus = new DomainEventBus();
    const handler = jest.fn();
    const unsubscribe = bus.subscribe('booking.created', handler);

    await bus.publish(makeEvent());
    expect(handler).toHaveBeenCalledTimes(1);

    unsubscribe();
    await bus.publish(makeEvent());
    expect(handler).toHaveBeenCalledTimes(1);
  });

  test('subscribers for a different event type are never invoked', async () => {
    const bus = new DomainEventBus();
    const bookingHandler = jest.fn();
    const reviewHandler = jest.fn();
    bus.subscribe('booking.created', bookingHandler);
    bus.subscribe('review.submitted', reviewHandler);

    await bus.publish(
      makeEvent({
        eventType: 'booking.created',
        resourceType: 'booking',
        resourceId: 1,
      }),
    );

    expect(bookingHandler).toHaveBeenCalledTimes(1);
    expect(reviewHandler).not.toHaveBeenCalled();
  });

  test('subscribe() rejects a non-function handler', () => {
    const bus = new DomainEventBus();
    expect(() => bus.subscribe('booking.created', 'not-a-function')).toThrow(
      TypeError,
    );
  });

  test('subscribe() rejects an empty eventType', () => {
    const bus = new DomainEventBus();
    expect(() => bus.subscribe('', () => {})).toThrow(TypeError);
  });
});
