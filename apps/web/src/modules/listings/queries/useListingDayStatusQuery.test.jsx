import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import PropTypes from 'prop-types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useListingDayStatusQuery } from './useListingDayStatusQuery.js';
import { getListingDayStatus } from '../../../api/availability.js';

vi.mock('../../../api/availability.js', () => ({
  getListingDayStatus: vi.fn(),
}));

function Harness({
  listingId = undefined,
  unitId = undefined,
  from = undefined,
  to = undefined,
}) {
  const { data, isPending } = useListingDayStatusQuery(listingId, unitId, {
    from,
    to,
  });
  return (
    <div>
      <p data-testid="status">{isPending ? 'pending' : 'success'}</p>
      <p data-testid="count">{data?.length}</p>
    </div>
  );
}

Harness.propTypes = {
  listingId: PropTypes.number,
  unitId: PropTypes.number,
  from: PropTypes.string,
  to: PropTypes.string,
};

function renderHarness({ listingId, unitId, from, to }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Harness listingId={listingId} unitId={unitId} from={from} to={to} />
    </QueryClientProvider>,
  );
}

describe('useListingDayStatusQuery (apps/web/src/modules/listings)', () => {
  beforeEach(() => {
    getListingDayStatus.mockReset();
  });

  test('resolves the per-day status list once listingId, unitId, from, and to are all present', async () => {
    getListingDayStatus.mockResolvedValue({
      data: [
        { date: '2026-10-01', availability_status: 'AVAILABLE' },
        { date: '2026-10-02', availability_status: 'SOLD_OUT' },
      ],
    });
    renderHarness({
      listingId: 7,
      unitId: 3,
      from: '2026-10-01',
      to: '2026-10-02',
    });

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('success'),
    );
    expect(screen.getByTestId('count')).toHaveTextContent('2');
    expect(getListingDayStatus).toHaveBeenCalledWith(7, {
      from: '2026-10-01',
      to: '2026-10-02',
      unitId: 3,
    });
  });

  test('stays disabled until a single unit and both date bounds are resolved', () => {
    renderHarness({
      listingId: 7,
      unitId: undefined,
      from: '2026-10-01',
      to: '2026-10-02',
    });
    expect(getListingDayStatus).not.toHaveBeenCalled();
  });
});
