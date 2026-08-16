import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import PropTypes from 'prop-types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useListingQuery } from './useListingQuery.js';
import { getListing } from '../../../api/listings.js';

vi.mock('../../../api/listings.js', () => ({
  getListing: vi.fn(),
}));

function Harness({ id = undefined }) {
  const { data, isPending } = useListingQuery(id);
  return (
    <div>
      <p data-testid="status">{isPending ? 'pending' : 'success'}</p>
      <p data-testid="slug">{data?.slug ?? ''}</p>
    </div>
  );
}

Harness.propTypes = { id: PropTypes.number };

function renderHarness(id) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Harness id={id} />
    </QueryClientProvider>,
  );
}

describe('useListingQuery (apps/web/src/modules/listings)', () => {
  beforeEach(() => {
    getListing.mockReset();
  });

  test('resolves the listing from the response envelope', async () => {
    getListing.mockResolvedValue({ data: { id: 7, slug: 'villa-ararat' } });
    renderHarness(7);

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('success'),
    );
    expect(screen.getByTestId('slug')).toHaveTextContent('villa-ararat');
    expect(getListing).toHaveBeenCalledWith(7);
  });

  test('stays disabled (never calls the API) when no id is given yet', () => {
    renderHarness(undefined);
    expect(getListing).not.toHaveBeenCalled();
  });
});
