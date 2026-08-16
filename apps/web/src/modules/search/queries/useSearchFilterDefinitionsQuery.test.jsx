import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import PropTypes from 'prop-types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSearchFilterDefinitionsQuery } from './useSearchFilterDefinitionsQuery.js';
import { getSearchFilterDefinitions } from '../../../api/search.js';

vi.mock('../../../api/search.js', () => ({
  getSearchFilterDefinitions: vi.fn(),
}));

function Harness({ categoryId = undefined }) {
  const { data, isPending } = useSearchFilterDefinitionsQuery(categoryId);
  return (
    <div>
      <p data-testid="status">{isPending ? 'pending' : 'success'}</p>
      <p data-testid="groupCodes">
        {(data ?? []).map((group) => group.code).join(',')}
      </p>
    </div>
  );
}

Harness.propTypes = { categoryId: PropTypes.number };

function renderHarness(categoryId) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Harness categoryId={categoryId} />
    </QueryClientProvider>,
  );
}

describe('useSearchFilterDefinitionsQuery (apps/web/src/modules/search)', () => {
  beforeEach(() => {
    getSearchFilterDefinitions.mockReset();
  });

  test('resolves the groups array from the response envelope', async () => {
    getSearchFilterDefinitions.mockResolvedValue({
      data: { groups: [{ code: 'RATING', definitions: [] }] },
    });
    renderHarness(1);
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('success'),
    );
    expect(screen.getByTestId('groupCodes')).toHaveTextContent('RATING');
    expect(getSearchFilterDefinitions).toHaveBeenCalledWith({ categoryId: 1 });
  });

  test('a different categoryId is a different query key (real backend refetch)', async () => {
    getSearchFilterDefinitions
      .mockResolvedValueOnce({
        data: { groups: [{ code: 'RATING', definitions: [] }] },
      })
      .mockResolvedValueOnce({
        data: { groups: [{ code: 'ROOMS', definitions: [] }] },
      });

    const { rerender } = renderHarness(1);
    await waitFor(() =>
      expect(screen.getByTestId('groupCodes')).toHaveTextContent('RATING'),
    );

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    rerender(
      <QueryClientProvider client={queryClient}>
        <Harness categoryId={2} />
      </QueryClientProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('groupCodes')).toHaveTextContent('ROOMS'),
    );
    expect(getSearchFilterDefinitions).toHaveBeenCalledWith({ categoryId: 2 });
  });
});
