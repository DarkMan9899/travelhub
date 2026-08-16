import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import PropTypes from 'prop-types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useListingAvailabilitySummaryQuery } from './useListingAvailabilitySummaryQuery.js';
import { getListingAvailabilitySummary } from '../../../api/availability.js';

vi.mock('../../../api/availability.js', () => ({
  getListingAvailabilitySummary: vi.fn(),
}));

function Harness({ listingId = undefined }) {
  const { data, isPending } = useListingAvailabilitySummaryQuery(listingId);
  return (
    <div>
      <p data-testid="status">{isPending ? 'pending' : 'success'}</p>
      <p data-testid="count">{data?.length}</p>
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

describe('useListingAvailabilitySummaryQuery (apps/web/src/modules/listings)', () => {
  beforeEach(() => {
    getListingAvailabilitySummary.mockReset();
  });

  test('resolves the bucketed summary for the listing', async () => {
    getListingAvailabilitySummary.mockResolvedValue({
      data: [
        {
          unit_id: 1,
          bookable_unit_type: 'HOTEL_ROOM',
          availability_status: 'AVAILABLE',
          remaining_count: null,
        },
      ],
    });
    renderHarness(3);

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('success'),
    );
    expect(screen.getByTestId('count')).toHaveTextContent('1');
    expect(getListingAvailabilitySummary).toHaveBeenCalledWith(
      3,
      expect.objectContaining({
        from: expect.any(String),
        to: expect.any(String),
      }),
    );
  });

  test('stays disabled (never calls the API) when no listingId is selected yet', () => {
    renderHarness(undefined);
    expect(getListingAvailabilitySummary).not.toHaveBeenCalled();
  });
});
