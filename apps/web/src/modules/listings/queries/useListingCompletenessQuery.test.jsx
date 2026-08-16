import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import PropTypes from 'prop-types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useListingCompletenessQuery } from './useListingCompletenessQuery.js';
import { getListingCompleteness } from '../../../api/listings.js';

vi.mock('../../../api/listings.js', () => ({
  getListingCompleteness: vi.fn(),
}));

function Harness({ listingId = undefined }) {
  const { data, isPending } = useListingCompletenessQuery(listingId);
  return (
    <div>
      <p data-testid="status">{isPending ? 'pending' : 'success'}</p>
      <p data-testid="percent">{data?.percent_complete}</p>
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

describe('useListingCompletenessQuery (apps/web/src/modules/listings)', () => {
  beforeEach(() => {
    getListingCompleteness.mockReset();
  });

  test('resolves the completeness score for the listing', async () => {
    getListingCompleteness.mockResolvedValue({
      data: {
        is_publish_ready: true,
        percent_complete: 88,
        required_missing: [],
        recommended_missing: ['faqs'],
      },
    });
    renderHarness(7);

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('success'),
    );
    expect(screen.getByTestId('percent')).toHaveTextContent('88');
    expect(getListingCompleteness).toHaveBeenCalledWith(7);
  });

  test('stays disabled (never calls the API) when no listingId is selected yet', () => {
    renderHarness(undefined);
    expect(getListingCompleteness).not.toHaveBeenCalled();
  });
});
