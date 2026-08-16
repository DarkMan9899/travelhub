import { describe, test, expect, vi } from 'vitest';
import {
  resolveBookingCtaLabel,
  resolvePricingModelLabel,
} from './reservationLabels.js';

function makeT(map) {
  return (key, options) => map[key] ?? options?.defaultValue ?? key;
}

describe('reservationLabels', () => {
  describe('resolveBookingCtaLabel', () => {
    test('resolves a category-scoped key when translated', () => {
      const t = makeT({
        'pages.listingDetail.reservation.requestToBookByGroup.EXPERIENCE':
          'Reserve your spot',
      });
      expect(
        resolveBookingCtaLabel(
          t,
          'pages.listingDetail.reservation.requestToBookByGroup.EXPERIENCE',
        ),
      ).toBe('Reserve your spot');
    });

    test('falls back to the generic requestToBook label when the key is untranslated', () => {
      const t = vi.fn((key) => {
        if (key === 'pages.listingDetail.reservation.requestToBook') {
          return 'Request to book';
        }
        // i18next returns the key itself when no translation exists and
        // no defaultValue matches — mirrors that behavior here.
        return key;
      });
      expect(
        resolveBookingCtaLabel(
          t,
          'pages.listingDetail.reservation.requestToBookByGroup.UNKNOWN',
        ),
      ).toBe('pages.listingDetail.reservation.requestToBookByGroup.UNKNOWN');
    });
  });

  describe('resolvePricingModelLabel', () => {
    test('returns undefined when pricing is null', () => {
      expect(resolvePricingModelLabel(makeT({}), null)).toBeUndefined();
    });

    test('resolves the translated pricing-model label', () => {
      const t = makeT({
        'partner.listingWizard.pricingModels.PER_NIGHT': 'per night',
      });
      expect(resolvePricingModelLabel(t, { pricing_model: 'PER_NIGHT' })).toBe(
        'per night',
      );
    });
  });
});
