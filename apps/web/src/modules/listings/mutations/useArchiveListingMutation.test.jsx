import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useArchiveListingMutation } from './useArchiveListingMutation.js';
import { archiveListing } from '../../../api/listings.js';
import listingKeys from '../constants/queryKeys.js';

vi.mock('../../../api/listings.js', () => ({
  archiveListing: vi.fn(),
}));

function Harness() {
  const { mutate, isSuccess } = useArchiveListingMutation();
  return (
    <div>
      <button type="button" onClick={() => mutate(7)}>
        archive
      </button>
      <p data-testid="status">{isSuccess ? 'success' : 'idle'}</p>
    </div>
  );
}

describe('useArchiveListingMutation (apps/web/src/modules/listings)', () => {
  let queryClient;

  beforeEach(() => {
    archiveListing.mockReset();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  test('calls archiveListing(id) and invalidates detail + lists + mine caches', async () => {
    archiveListing.mockResolvedValue({ data: { id: 7, status: 'ARCHIVED' } });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <Harness />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'archive' }));

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('success'),
    );
    expect(archiveListing).toHaveBeenCalledWith(7);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: listingKeys.detail(7),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: listingKeys.lists(),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: listingKeys.mines(),
    });
  });
});
