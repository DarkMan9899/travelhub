import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRemoveListingMediaMutation } from './useRemoveListingMediaMutation.js';
import { removeListingMedia } from '../../../api/listings.js';
import listingKeys from '../constants/queryKeys.js';

vi.mock('../../../api/listings.js', () => ({
  removeListingMedia: vi.fn(),
}));

function Harness() {
  const { mutate, isSuccess } = useRemoveListingMediaMutation();
  return (
    <div>
      <button type="button" onClick={() => mutate({ id: 7, mediaId: 3 })}>
        remove
      </button>
      <p data-testid="status">{isSuccess ? 'success' : 'idle'}</p>
    </div>
  );
}

describe('useRemoveListingMediaMutation (apps/web/src/modules/listings)', () => {
  let queryClient;

  beforeEach(() => {
    removeListingMedia.mockReset();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  test('calls removeListingMedia(id, mediaId) and invalidates the detail cache', async () => {
    removeListingMedia.mockResolvedValue({ data: { deleted: true } });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <Harness />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'remove' }));

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('success'),
    );
    expect(removeListingMedia).toHaveBeenCalledWith(7, 3);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: listingKeys.detail(7),
    });
  });
});
