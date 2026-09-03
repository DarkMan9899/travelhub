import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ListingCompletenessWidget from './ListingCompletenessWidget.jsx';
import { useListingCompletenessQuery } from '../../queries/useListingCompletenessQuery.js';

vi.mock('../../queries/useListingCompletenessQuery.js', () => ({
  useListingCompletenessQuery: vi.fn(),
}));

describe('ListingCompletenessWidget', () => {
  test('shows a loading state while the completeness query is pending', () => {
    useListingCompletenessQuery.mockReturnValue({
      data: undefined,
      isPending: true,
    });
    render(<ListingCompletenessWidget listingId={7} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  test('renders the percent, a progressbar, and the required-missing list with resolved labels', () => {
    useListingCompletenessQuery.mockReturnValue({
      data: {
        is_publish_ready: false,
        percent_complete: 55,
        required_missing: ['media', 'attributeValues.max_group_size'],
        recommended_missing: ['highlights'],
      },
      isPending: false,
    });
    render(<ListingCompletenessWidget listingId={7} />);

    expect(screen.getByText('55%')).toBeInTheDocument();
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '55');

    // 'media' resolves through completeness.fields.media
    expect(screen.getByText('Առնվազն մեկ լուսանկար')).toBeInTheDocument();
    // 'attributeValues.max_group_size' resolves through the *same*
    // partner.listingWizard.attributes.max_group_size label
    // MetadataFieldRenderer already uses for this exact attribute code —
    // proves the dynamic-code resolution path reuses that label, not a
    // second copy of it.
    expect(screen.getByText('Խմբի առավելագույն չափ')).toBeInTheDocument();
    // 'highlights' resolves through completeness.fields.highlights
    expect(
      screen.getByText('Մի քանի առանձնահատկություններ'),
    ).toBeInTheDocument();
  });

  test('shows the all-done message once publish-ready with nothing recommended missing', () => {
    useListingCompletenessQuery.mockReturnValue({
      data: {
        is_publish_ready: true,
        percent_complete: 100,
        required_missing: [],
        recommended_missing: [],
      },
      isPending: false,
    });
    render(<ListingCompletenessWidget listingId={7} />);
    expect(
      screen.getByText('Ձեր հայտարարությունը պատրաստ է հրապարակման։'),
    ).toBeInTheDocument();
  });
});
