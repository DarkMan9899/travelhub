import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAttachListingMediaMutation } from './useAttachListingMediaMutation.js';
import { attachListingMedia } from '../../../api/listings.js';
import listingKeys from '../constants/queryKeys.js';

vi.mock('../../../api/listings.js', () => ({
  attachListingMedia: vi.fn(),
}));

const FILE = new File(['x'], 'villa.png', { type: 'image/png' });

function Harness() {
  const { mutate, isSuccess } = useAttachListingMediaMutation();
  return (
    <div>
      <button type="button" onClick={() => mutate({ id: 7, file: FILE })}>
        attach
      </button>
      <p data-testid="status">{isSuccess ? 'success' : 'idle'}</p>
    </div>
  );
}

describe('useAttachListingMediaMutation (apps/web/src/modules/listings)', () => {
  let queryClient;

  beforeEach(() => {
    attachListingMedia.mockReset();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  test('calls attachListingMedia(id, file) and invalidates the detail cache', async () => {
    attachListingMedia.mockResolvedValue({ data: { id: 1, url: '/media/1' } });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <Harness />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'attach' }));

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('success'),
    );
    expect(attachListingMedia).toHaveBeenCalledWith(7, FILE);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: listingKeys.detail(7),
    });
  });
});
