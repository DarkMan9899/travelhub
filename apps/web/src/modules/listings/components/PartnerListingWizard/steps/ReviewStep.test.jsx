import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReviewStep from './ReviewStep.jsx';
import { usePublishListingMutation } from '../../../mutations/usePublishListingMutation.js';

vi.mock('../../../mutations/usePublishListingMutation.js', () => ({
  usePublishListingMutation: vi.fn(),
}));

vi.mock('../../../../ai/index.js', () => ({
  PartnerAiToolsPanel: () => null,
  AskAiButton: () => null,
}));

vi.mock('../ListingCompletenessWidget.jsx', () => ({
  default: () => null,
}));

const LISTING = {
  id: 7,
  translations: [{ language_code: 'en', title: 'Boutique Yerevan Hotel' }],
  highlights: [],
  included_items: [],
  faqs: [],
  itinerary_steps: [],
  location: { latitude: 40.18, longitude: 44.5 },
  media: [{ id: 1 }, { id: 2 }],
  amenity_ids: [1, 2, 3],
  pricing: { amount: 150, currency: 'AMD', pricing_model: 'PER_NIGHT' },
};

describe('ReviewStep (PartnerListingWizard)', () => {
  let mutateAsync;

  beforeEach(() => {
    mutateAsync = vi.fn().mockResolvedValue({ data: { id: 7 } });
    usePublishListingMutation.mockReturnValue({
      mutateAsync,
      isPending: false,
      error: null,
    });
  });

  test('renders a read-only summary of the listing', () => {
    render(<ReviewStep listing={LISTING} onPublished={vi.fn()} />);
    expect(screen.getByText('Boutique Yerevan Hotel')).toBeInTheDocument();
    expect(screen.getByText('40.18, 44.5')).toBeInTheDocument();
  });

  test('renders the pricing model as its translated label, not the raw code', () => {
    render(<ReviewStep listing={LISTING} onPublished={vi.fn()} />);
    expect(screen.getByText('150 AMD (Գիշերվա համար)')).toBeInTheDocument();
    expect(screen.queryByText(/PER_NIGHT/)).not.toBeInTheDocument();
  });

  test('clicking Publish calls publishListing(id) and onPublished on success', async () => {
    const user = userEvent.setup();
    const onPublished = vi.fn();
    render(<ReviewStep listing={LISTING} onPublished={onPublished} />);

    await user.click(screen.getByRole('button', { name: 'Հրապարակել' }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith(7));
    expect(onPublished).toHaveBeenCalled();
  });

  test('a 422 publish-readiness rejection renders the itemized issues', async () => {
    const user = userEvent.setup();
    mutateAsync = vi.fn().mockRejectedValue(
      Object.assign(new Error('One or more fields are invalid.'), {
        details: [{ field: 'media', issue: 'AT_LEAST_ONE_IMAGE_REQUIRED' }],
      }),
    );
    usePublishListingMutation.mockReturnValue({
      mutateAsync,
      isPending: false,
      error: {
        message: 'One or more fields are invalid.',
        details: [{ field: 'media', issue: 'AT_LEAST_ONE_IMAGE_REQUIRED' }],
      },
    });
    const onPublished = vi.fn();
    render(<ReviewStep listing={LISTING} onPublished={onPublished} />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'One or more fields are invalid.',
    );
    expect(
      screen.getByText('Հրապարակելուց առաջ ավելացրեք առնվազն մեկ լուսանկար։'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Հրապարակել' }));
    expect(onPublished).not.toHaveBeenCalled();
  });

  test('renders "not set" placeholders when location/pricing are absent', () => {
    render(
      <ReviewStep
        listing={{ ...LISTING, location: null, pricing: null }}
        onPublished={vi.fn()}
      />,
    );
    expect(screen.getAllByText('Նշված չէ')).toHaveLength(2);
  });

  // 2026 Partner Workspace redesign (Sprint 3 closeout).
  describe('translation completeness', () => {
    test('shows a per-locale status distinct from the required-to-publish widget, using real authored data', () => {
      render(
        <ReviewStep
          listing={{
            ...LISTING,
            translations: [
              { language_code: 'en', title: 'Boutique Yerevan Hotel' },
              { language_code: 'hy', title: 'Բուտիկ հյուրանոց' },
            ],
            highlights: [{ language_code: 'en', text: 'Great location' }],
          }}
          onPublished={vi.fn()}
        />,
      );
      expect(
        screen.getByText('Թարգմանության ամբողջականություն'),
      ).toBeInTheDocument();
      // en has title + highlights (2/7) => "Մասնակի" (partial); hy has
      // only title (1/7) => also partial; ru has nothing => "Չսկսված".
      expect(screen.getAllByText('Մասնակի')).toHaveLength(2);
      expect(screen.getByText('Չսկսված')).toBeInTheDocument();
    });

    test('a locale missing every translated field never blocks the Publish action', async () => {
      const user = userEvent.setup();
      const onPublished = vi.fn();
      render(<ReviewStep listing={LISTING} onPublished={onPublished} />);
      // Two locales are completely untranslated in the base LISTING
      // fixture — the publish button must still be enabled and callable.
      await user.click(screen.getByRole('button', { name: 'Հրապարակել' }));
      await waitFor(() => expect(onPublished).toHaveBeenCalled());
    });
  });
});
