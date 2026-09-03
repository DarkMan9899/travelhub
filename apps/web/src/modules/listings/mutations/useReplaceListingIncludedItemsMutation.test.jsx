import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useReplaceListingIncludedItemsMutation } from './useReplaceListingIncludedItemsMutation.js';
import { replaceListingIncludedItems } from '../../../api/listings.js';
import listingKeys from '../constants/queryKeys.js';

vi.mock('../../../api/listings.js', () => ({
  replaceListingIncludedItems: vi.fn(),
}));

const ITEMS = [{ itemText: 'Breakfast', isIncluded: true }];

function Harness() {
  const { mutate, isSuccess } = useReplaceListingIncludedItemsMutation();
  return (
    <div>
      <button
        type="button"
        onClick={() => mutate({ id: 7, items: ITEMS, languageCode: 'hy' })}
      >
        save
      </button>
      <p data-testid="status">{isSuccess ? 'success' : 'idle'}</p>
    </div>
  );
}

describe('useReplaceListingIncludedItemsMutation (apps/web/src/modules/listings)', () => {
  let queryClient;

  beforeEach(() => {
    replaceListingIncludedItems.mockReset();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  test('calls replaceListingIncludedItems(id, items, languageCode) and invalidates the detail cache', async () => {
    replaceListingIncludedItems.mockResolvedValue({ data: { id: 7 } });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <Harness />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'save' }));

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('success'),
    );
    expect(replaceListingIncludedItems).toHaveBeenCalledWith(7, ITEMS, 'hy');
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: listingKeys.detail(7),
    });
  });
});
