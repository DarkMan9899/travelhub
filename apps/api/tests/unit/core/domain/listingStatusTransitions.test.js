/**
 * Sprint 7: "Publish / Unpublish listing, Draft support, Listing status
 * management." Validates the pure transition-rule function against the
 * seeded `listing_statuses` vocabulary (seeds/001_lookups.js).
 */

import { describe, test, expect } from '@jest/globals';
import {
  LISTING_STATUSES,
  isValidListingStatusTransition,
  isTerminalListingStatus,
} from '../../../../src/core/domain/listingStatusTransitions.js';

describe('Listing status transitions (Sprint 7 draft/publish/unpublish lifecycle)', () => {
  test('a draft listing can be published directly', () => {
    expect(isValidListingStatusTransition('DRAFT', 'PUBLISHED')).toBe(true);
  });

  test('a published listing can be unpublished', () => {
    expect(isValidListingStatusTransition('PUBLISHED', 'UNPUBLISHED')).toBe(
      true,
    );
  });

  test('an unpublished listing can be republished', () => {
    expect(isValidListingStatusTransition('UNPUBLISHED', 'PUBLISHED')).toBe(
      true,
    );
  });

  test('a draft listing cannot be unpublished (it was never published)', () => {
    expect(isValidListingStatusTransition('DRAFT', 'UNPUBLISHED')).toBe(false);
  });

  test('a published listing cannot be published again via this transition table', () => {
    expect(isValidListingStatusTransition('PUBLISHED', 'PUBLISHED')).toBe(
      false,
    );
  });

  test('ARCHIVED is terminal — no outgoing transitions', () => {
    expect(isTerminalListingStatus('ARCHIVED')).toBe(true);
    LISTING_STATUSES.forEach((target) => {
      expect(isValidListingStatusTransition('ARCHIVED', target)).toBe(false);
    });
  });

  test('an unknown status throws rather than silently allowing the transition', () => {
    expect(() => isValidListingStatusTransition('NOPE', 'PUBLISHED')).toThrow(
      TypeError,
    );
    expect(() => isValidListingStatusTransition('DRAFT', 'NOPE')).toThrow(
      TypeError,
    );
  });

  test('LISTING_STATUSES exactly matches the 5 statuses seeded in migration 0005/seed 001', () => {
    expect([...LISTING_STATUSES].sort()).toEqual(
      [
        'DRAFT',
        'PENDING_REVIEW',
        'PUBLISHED',
        'UNPUBLISHED',
        'ARCHIVED',
      ].sort(),
    );
  });
});
