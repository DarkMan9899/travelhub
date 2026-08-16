import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AmenitiesStep from './AmenitiesStep.jsx';
import { useListingMetadataQuery } from '../../../queries/useListingMetadataQuery.js';
import { useUpdateListingMutation } from '../../../mutations/useUpdateListingMutation.js';

vi.mock('../../../queries/useListingMetadataQuery.js', () => ({
  useListingMetadataQuery: vi.fn(),
}));
vi.mock('../../../mutations/useUpdateListingMutation.js', () => ({
  useUpdateListingMutation: vi.fn(),
}));

const AMENITY_GROUPS = [
  {
    code: 'GENERAL',
    amenities: [
      { value: 1, code: 'WiFi' },
      { value: 2, code: 'Parking' },
    ],
  },
  {
    code: 'OUTDOOR',
    amenities: [{ value: 3, code: 'Pool' }],
  },
];

describe('AmenitiesStep (PartnerListingWizard)', () => {
  let mutateAsync;

  beforeEach(() => {
    mutateAsync = vi.fn().mockResolvedValue({ data: {} });
    useUpdateListingMutation.mockReturnValue({
      mutateAsync,
      isPending: false,
      error: null,
    });
  });

  test('renders a loading spinner while metadata is pending', () => {
    useListingMetadataQuery.mockReturnValue({ isPending: true });
    render(<AmenitiesStep listingId={7} categoryId={3} onNext={vi.fn()} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  test('renders every amenity, grouped, with the amenity name shown as-is', () => {
    useListingMetadataQuery.mockReturnValue({
      isPending: false,
      isError: false,
      data: { amenity_groups: AMENITY_GROUPS },
    });
    render(<AmenitiesStep listingId={7} categoryId={3} onNext={vi.fn()} />);
    expect(screen.getByText('WiFi')).toBeInTheDocument();
    expect(screen.getByText('Parking')).toBeInTheDocument();
    expect(screen.getByText('Pool')).toBeInTheDocument();
  });

  test('the search box filters amenities across groups', async () => {
    const user = userEvent.setup();
    useListingMetadataQuery.mockReturnValue({
      isPending: false,
      isError: false,
      data: { amenity_groups: AMENITY_GROUPS },
    });
    render(<AmenitiesStep listingId={7} categoryId={3} onNext={vi.fn()} />);

    await user.type(screen.getByLabelText('Փնտրել հարմարություններ'), 'wifi');
    expect(screen.getByText('WiFi')).toBeInTheDocument();
    expect(screen.queryByText('Parking')).not.toBeInTheDocument();
    expect(screen.queryByText('Pool')).not.toBeInTheDocument();
  });

  test('a group header toggles collapse/expand of its amenities', async () => {
    const user = userEvent.setup();
    useListingMetadataQuery.mockReturnValue({
      isPending: false,
      isError: false,
      data: { amenity_groups: AMENITY_GROUPS },
    });
    render(<AmenitiesStep listingId={7} categoryId={3} onNext={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Ընդհանուր' }));
    expect(screen.queryByText('WiFi')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ընդհանուր' }));
    expect(screen.getByText('WiFi')).toBeInTheDocument();
  });

  test('pre-selected amenities (editing a draft) start checked', () => {
    useListingMetadataQuery.mockReturnValue({
      isPending: false,
      isError: false,
      data: { amenity_groups: AMENITY_GROUPS },
    });
    render(
      <AmenitiesStep
        listingId={7}
        categoryId={3}
        initialValues={[1]}
        onNext={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('WiFi')).toBeChecked();
    expect(screen.getByLabelText('Parking')).not.toBeChecked();
  });

  test('toggling amenities and continuing calls updateListing with amenityIds', async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();
    useListingMetadataQuery.mockReturnValue({
      isPending: false,
      isError: false,
      data: { amenity_groups: AMENITY_GROUPS },
    });
    render(
      <AmenitiesStep
        listingId={7}
        categoryId={3}
        initialValues={[1]}
        onNext={onNext}
      />,
    );

    await user.click(screen.getByLabelText('Pool'));
    await user.click(screen.getByRole('button', { name: 'Շարունակել' }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    const call = mutateAsync.mock.calls[0][0];
    expect(call.id).toBe(7);
    expect(call.payload.amenityIds.sort()).toEqual([1, 3]);
    expect(onNext).toHaveBeenCalled();
  });
});
