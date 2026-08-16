import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDeleteListingMutation } from './useDeleteListingMutation.js';
import { deleteListing } from '../../../api/listings.js';
import listingKeys from '../constants/queryKeys.js';

vi.mock('../../../api/listings.js', () => ({
  deleteListing: vi.fn(),
}));

function Harness() {
  const { mutate, isSuccess } = useDeleteListingMutation();
  return (
    <div>
      <button type="button" onClick={() => mutate(7)}>
        delete
      </button>
      <p data-testid="status">{isSuccess ? 'success' : 'idle'}</p>
    </div>
  );
}

describe('useDeleteListingMutation (apps/web/src/modules/listings)', () => {
  let queryClient;

  beforeEach(() => {
    deleteListing.mockReset();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  test('calls deleteListing(id) and invalidates lists + mine caches', async () => {
    deleteListing.mockResolvedValue({ data: { id: 7 } });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <Harness />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'delete' }));

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('success'),
    );
    expect(deleteListing).toHaveBeenCalledWith(7);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: listingKeys.lists(),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: listingKeys.mines(),
    });
  });
});
