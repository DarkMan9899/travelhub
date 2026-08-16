import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useUnpublishListingMutation } from './useUnpublishListingMutation.js';
import { unpublishListing } from '../../../api/listings.js';
import listingKeys from '../constants/queryKeys.js';

vi.mock('../../../api/listings.js', () => ({
  unpublishListing: vi.fn(),
}));

function Harness() {
  const { mutate, isSuccess } = useUnpublishListingMutation();
  return (
    <div>
      <button type="button" onClick={() => mutate(7)}>
        unpublish
      </button>
      <p data-testid="status">{isSuccess ? 'success' : 'idle'}</p>
    </div>
  );
}

describe('useUnpublishListingMutation (apps/web/src/modules/listings)', () => {
  let queryClient;

  beforeEach(() => {
    unpublishListing.mockReset();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  test('calls unpublishListing(id) and invalidates the detail + lists cache', async () => {
    unpublishListing.mockResolvedValue({ data: { id: 7, status: 'DRAFT' } });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <Harness />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'unpublish' }));

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('success'),
    );
    expect(unpublishListing).toHaveBeenCalledWith(7);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: listingKeys.detail(7),
    });
  });
});
