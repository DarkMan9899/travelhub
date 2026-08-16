import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useUpdateListingMutation } from './useUpdateListingMutation.js';
import { updateListing } from '../../../api/listings.js';
import listingKeys from '../constants/queryKeys.js';

vi.mock('../../../api/listings.js', () => ({
  updateListing: vi.fn(),
}));

function Harness() {
  const { mutate, isSuccess } = useUpdateListingMutation();
  return (
    <div>
      <button
        type="button"
        onClick={() => mutate({ id: 7, payload: { slug: 'new-slug' } })}
      >
        update
      </button>
      <p data-testid="status">{isSuccess ? 'success' : 'idle'}</p>
    </div>
  );
}

describe('useUpdateListingMutation (apps/web/src/modules/listings)', () => {
  let queryClient;

  beforeEach(() => {
    updateListing.mockReset();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  test('calls updateListing(id, payload) and invalidates the detail + lists cache', async () => {
    updateListing.mockResolvedValue({ data: { id: 7, slug: 'new-slug' } });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <Harness />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'update' }));

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('success'),
    );
    expect(updateListing).toHaveBeenCalledWith(7, { slug: 'new-slug' });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: listingKeys.detail(7),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: listingKeys.lists(),
    });
  });
});
