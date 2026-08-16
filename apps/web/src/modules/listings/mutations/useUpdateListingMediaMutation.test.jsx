import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useUpdateListingMediaMutation } from './useUpdateListingMediaMutation.js';
import { updateListingMedia } from '../../../api/listings.js';
import listingKeys from '../constants/queryKeys.js';

vi.mock('../../../api/listings.js', () => ({
  updateListingMedia: vi.fn(),
}));

function Harness() {
  const { mutate, isSuccess } = useUpdateListingMediaMutation();
  return (
    <div>
      <button
        type="button"
        onClick={() =>
          mutate({ id: 7, mediaId: 3, payload: { isCover: true } })
        }
      >
        set cover
      </button>
      <p data-testid="status">{isSuccess ? 'success' : 'idle'}</p>
    </div>
  );
}

describe('useUpdateListingMediaMutation (apps/web/src/modules/listings)', () => {
  let queryClient;

  beforeEach(() => {
    updateListingMedia.mockReset();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  test('calls updateListingMedia(id, mediaId, payload) and invalidates the detail cache', async () => {
    updateListingMedia.mockResolvedValue({
      data: { id: 3, isCover: true },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <Harness />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'set cover' }));

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('success'),
    );
    expect(updateListingMedia).toHaveBeenCalledWith(7, 3, { isCover: true });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: listingKeys.detail(7),
    });
  });
});
