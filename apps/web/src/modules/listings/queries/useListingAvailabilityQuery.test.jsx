import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import PropTypes from 'prop-types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useListingAvailabilityQuery } from './useListingAvailabilityQuery.js';
import {
  getListingCalendar,
  getListingPublicRanges,
} from '../../../api/availability.js';

vi.mock('../../../api/availability.js', () => ({
  getListingCalendar: vi.fn(),
  getListingPublicRanges: vi.fn(),
}));

function Harness({ listingId = undefined }) {
  const { data, isPending } = useListingAvailabilityQuery(listingId);
  return (
    <div>
      <p data-testid="status">{isPending ? 'pending' : 'success'}</p>
      <p data-testid="kind">{data?.kind}</p>
      <p data-testid="count">
        {data?.kind === 'calendar' ? data.days.length : data?.ranges?.length}
      </p>
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

describe('useListingAvailabilityQuery (apps/web/src/modules/listings)', () => {
  beforeEach(() => {
    getListingCalendar.mockReset();
    getListingPublicRanges.mockReset();
  });

  test('resolves the day-by-day calendar for a single-unit listing', async () => {
    getListingCalendar.mockResolvedValue({
      data: [
        { date: '2026-08-01', status: 'AVAILABLE' },
        { date: '2026-08-02', status: 'BLOCKED' },
      ],
    });
    renderHarness(3);

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('success'),
    );
    expect(screen.getByTestId('kind')).toHaveTextContent('calendar');
    expect(screen.getByTestId('count')).toHaveTextContent('2');
    expect(getListingPublicRanges).not.toHaveBeenCalled();
  });

  test('falls back to blackout ranges when the listing has an ambiguous multi-unit calendar', async () => {
    const ambiguousError = Object.assign(new Error('Ambiguous unit'), {
      code: 'VALIDATION_FAILED',
      details: [{ field: 'unitId', issue: 'AMBIGUOUS_UNIT' }],
    });
    getListingCalendar.mockRejectedValue(ambiguousError);
    getListingPublicRanges.mockResolvedValue({
      data: [{ date_from: '2026-08-05', date_to: '2026-08-10' }],
    });
    renderHarness(9);

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('success'),
    );
    expect(screen.getByTestId('kind')).toHaveTextContent('ranges');
    expect(screen.getByTestId('count')).toHaveTextContent('1');
  });

  test('a genuine, non-ambiguity error is not swallowed', async () => {
    const networkError = Object.assign(new Error('Network down'), {
      code: 'NETWORK_ERROR',
    });
    getListingCalendar.mockRejectedValue(networkError);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { useListingAvailabilityQuery: hook } =
      await import('./useListingAvailabilityQuery.js');

    function ErrorHarness() {
      const { isError, error } = hook(9);
      return <p data-testid="error">{isError ? error.code : 'no-error'}</p>;
    }

    render(
      <QueryClientProvider client={queryClient}>
        <ErrorHarness />
      </QueryClientProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('error')).toHaveTextContent('NETWORK_ERROR'),
    );
    expect(getListingPublicRanges).not.toHaveBeenCalled();
  });

  test('stays disabled (never calls the API) when no listingId is selected yet', () => {
    renderHarness(undefined);
    expect(getListingCalendar).not.toHaveBeenCalled();
  });
});
