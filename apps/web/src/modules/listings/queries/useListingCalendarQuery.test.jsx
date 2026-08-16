import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import PropTypes from 'prop-types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useListingCalendarQuery } from './useListingCalendarQuery.js';
import { getListingCalendar } from '../../../api/availability.js';

vi.mock('../../../api/availability.js', () => ({
  getListingCalendar: vi.fn(),
}));

function Harness({
  listingId = undefined,
  unitId = undefined,
  from = undefined,
  to = undefined,
}) {
  const { data, isPending } = useListingCalendarQuery(listingId, unitId, {
    from,
    to,
  });
  return (
    <div>
      <p data-testid="status">{isPending ? 'pending' : 'success'}</p>
      <p data-testid="count">{data?.length ?? ''}</p>
    </div>
  );
}

Harness.propTypes = {
  listingId: PropTypes.number,
  unitId: PropTypes.number,
  from: PropTypes.string,
  to: PropTypes.string,
};

function renderHarness(props) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Harness
        listingId={props.listingId}
        unitId={props.unitId}
        from={props.from}
        to={props.to}
      />
    </QueryClientProvider>,
  );
}

describe('useListingCalendarQuery (apps/web/src/modules/listings)', () => {
  beforeEach(() => {
    getListingCalendar.mockReset();
  });

  test('resolves the calendar with an explicit unitId', async () => {
    getListingCalendar.mockResolvedValue({
      data: [
        {
          date: '2026-08-01',
          status: 'AVAILABLE',
          price_amount: '100.00',
          price_currency: 'AMD',
        },
      ],
    });
    renderHarness({
      listingId: 10,
      unitId: 3,
      from: '2026-08-01',
      to: '2026-08-10',
    });

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('success'),
    );
    expect(screen.getByTestId('count')).toHaveTextContent('1');
    expect(getListingCalendar).toHaveBeenCalledWith(10, {
      from: '2026-08-01',
      to: '2026-08-10',
      unitId: 3,
    });
  });

  test('stays disabled when unitId is not yet selected', () => {
    renderHarness({
      listingId: 10,
      unitId: undefined,
      from: '2026-08-01',
      to: '2026-08-10',
    });
    expect(getListingCalendar).not.toHaveBeenCalled();
  });
});
