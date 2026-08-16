/**
 * Phase 17 §14 — the partner-employee-role capability matrix. Pure
 * function, no mocking needed.
 */

import { describe, test, expect } from '@jest/globals';
import {
  roleHasCapability,
  PARTNER_CAPABILITIES,
} from '../../../../src/core/domain/partnerCapabilities.js';

describe('roleHasCapability', () => {
  test('a receptionist-style BOOKING_MANAGER can manage availability/blocks/external reservations', () => {
    expect(
      roleHasCapability(
        'BOOKING_MANAGER',
        PARTNER_CAPABILITIES.MANAGE_AVAILABILITY,
      ),
    ).toBe(true);
    expect(
      roleHasCapability(
        'BOOKING_MANAGER',
        PARTNER_CAPABILITIES.MANAGE_EXTERNAL_RESERVATIONS,
      ),
    ).toBe(true);
    expect(
      roleHasCapability(
        'BOOKING_MANAGER',
        PARTNER_CAPABILITIES.MANAGE_MANUAL_BLOCKS,
      ),
    ).toBe(true);
  });

  test('BOOKING_MANAGER never gets connector/connection management (kept OWNER/MANAGER-only)', () => {
    expect(
      roleHasCapability(
        'BOOKING_MANAGER',
        PARTNER_CAPABILITIES.MANAGE_CONNECTIONS,
      ),
    ).toBe(false);
  });

  test('MANAGER gets every capability, matching OWNER-level operational trust', () => {
    Object.values(PARTNER_CAPABILITIES).forEach((capability) => {
      expect(roleHasCapability('MANAGER', capability)).toBe(true);
    });
  });

  test('EDITOR and ANALYTICS_VIEWER are read-only — no write capability at all', () => {
    const writeCapabilities = [
      PARTNER_CAPABILITIES.MANAGE_AVAILABILITY,
      PARTNER_CAPABILITIES.MANAGE_EXTERNAL_RESERVATIONS,
      PARTNER_CAPABILITIES.MANAGE_MANUAL_BLOCKS,
      PARTNER_CAPABILITIES.MANAGE_CONNECTIONS,
    ];
    writeCapabilities.forEach((capability) => {
      expect(roleHasCapability('EDITOR', capability)).toBe(false);
      expect(roleHasCapability('ANALYTICS_VIEWER', capability)).toBe(false);
    });
    expect(
      roleHasCapability('EDITOR', PARTNER_CAPABILITIES.VIEW_AVAILABILITY),
    ).toBe(true);
    expect(
      roleHasCapability(
        'ANALYTICS_VIEWER',
        PARTNER_CAPABILITIES.VIEW_SYNC_LOGS,
      ),
    ).toBe(true);
  });

  test('an unknown or missing role code grants nothing', () => {
    expect(
      roleHasCapability(null, PARTNER_CAPABILITIES.VIEW_AVAILABILITY),
    ).toBe(false);
    expect(
      roleHasCapability(undefined, PARTNER_CAPABILITIES.VIEW_AVAILABILITY),
    ).toBe(false);
    expect(
      roleHasCapability(
        'NOT_A_REAL_ROLE',
        PARTNER_CAPABILITIES.VIEW_AVAILABILITY,
      ),
    ).toBe(false);
  });
});
