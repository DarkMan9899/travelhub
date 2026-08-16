/**
 * DomainEventBus — in-process pub/sub for domain events (Phase 13).
 *
 * Business modules publish events; they never know (or care) who is
 * subscribed. Subscribers register independently and never know about
 * each other. One subscriber throwing/rejecting must never affect
 * another subscriber or the publisher — `publish()` never throws.
 *
 * This is intentionally a simple in-process `Map`-of-`Set`s, not a
 * message broker: BullMQ+Redis is this platform's only existing async
 * infrastructure (`infrastructure/queue/connection.js`), and nothing in
 * this codebase needs cross-process event delivery yet. A subscriber
 * that needs to do slow/unreliable I/O (e.g. sending an email) is
 * expected to enqueue a BullMQ job itself rather than doing that work
 * inline inside its handler — see `notifications/jobs/
 * notificationDeliveryQueue.js`.
 *
 * A single instance is constructed once in the composition root
 * (`routes/v1.js`) and injected into any module container that needs to
 * publish or subscribe — the same shared-singleton lifecycle already
 * used for `AuditLogger`.
 */

import { getModuleLogger } from '../../logging/logger.js';

const log = getModuleLogger('core:events');

export class DomainEventBus {
  #listeners = new Map();

  /**
   * @param {string} eventType
   * @param {(event: object) => void|Promise<void>} handler
   * @returns {() => void} unsubscribe function
   */
  subscribe(eventType, handler) {
    if (typeof eventType !== 'string' || eventType.trim().length === 0) {
      throw new TypeError(
        'DomainEventBus.subscribe requires a non-empty "eventType".',
      );
    }
    if (typeof handler !== 'function') {
      throw new TypeError(
        'DomainEventBus.subscribe requires a function "handler".',
      );
    }

    if (!this.#listeners.has(eventType)) {
      this.#listeners.set(eventType, new Set());
    }
    this.#listeners.get(eventType).add(handler);

    return () => {
      this.#listeners.get(eventType)?.delete(handler);
    };
  }

  /**
   * Invokes every subscriber registered for `event.eventType`
   * independently (`Promise.allSettled`) and never throws — a rejected
   * subscriber is logged and otherwise has no effect on the publisher
   * or on any other subscriber.
   *
   * @param {object} event - the envelope produced by `createDomainEvent`
   */
  async publish(event) {
    const handlers = this.#listeners.get(event.eventType);
    if (!handlers || handlers.size === 0) {
      return;
    }

    const results = await Promise.allSettled(
      [...handlers].map((handler) =>
        // Wrapped in `Promise.resolve().then(...)` rather than calling
        // `handler(event)` directly in the `.map()` callback: a
        // synchronously-throwing handler would otherwise throw out of
        // `.map()` itself, before `Promise.allSettled` ever gets a
        // chance to catch it — defeating the one guarantee this bus
        // exists to provide (one subscriber's failure can never affect
        // another subscriber or the publisher).
        Promise.resolve().then(() => handler(event)),
      ),
    );

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const handler = [...handlers][index];
        log.error(
          {
            eventId: event.eventId,
            eventType: event.eventType,
            handlerName: handler.name || '(anonymous)',
            err: result.reason,
          },
          'Domain event subscriber failed',
        );
      }
    });
  }
}

/** A bus with no subscribers — the default for services' optional `eventBus` constructor param, so business logic never has to null-check. */
export function createNoOpEventBus() {
  return new DomainEventBus();
}

export default DomainEventBus;
