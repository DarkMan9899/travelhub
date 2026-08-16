import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import PropTypes from 'prop-types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useListingBookableUnitsQuery } from './useListingBookableUnitsQuery.js';
import { getListingBookableUnits } from '../../../api/availability.js';

vi.mock('../../../api/availability.js', () => ({
  getListingBookableUnits: vi.fn(),
}));

function Harness({ listingId = undefined }) {
  const { data, isPending } = useListingBookableUnitsQuery(listingId);
  return (
    <div>
      <p data-testid="status">{isPending ? 'pending' : 'success'}</p>
      <p data-testid="count">{data?.length ?? ''}</p>
    </div>
  );
}

Harness.propTypes = { listingId: PropTypes.number };

function renderHarness(listingId) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Harness listingId={listingId} />
    </QueryClientProvider>,
  );
}

describe('useListingBookableUnitsQuery (apps/web/src/modules/listings)', () => {
  beforeEach(() => {
    getListingBookableUnits.mockReset();
  });

  test('resolves a listing public bookable units', async () => {
    getListingBookableUnits.mockResolvedValue({
      data: [{ id: 1, bookable_unit_type: 'HOTEL_ROOM', capacity: 2 }],
    });
    renderHarness(10);

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('success'),
    );
    expect(screen.getByTestId('count')).toHaveTextContent('1');
    expect(getListingBookableUnits).toHaveBeenCalledWith(10);
  });

  test('stays disabled (never calls the API) when no listingId is selected yet', () => {
    renderHarness(undefined);
    expect(getListingBookableUnits).not.toHaveBeenCalled();
  });
});
