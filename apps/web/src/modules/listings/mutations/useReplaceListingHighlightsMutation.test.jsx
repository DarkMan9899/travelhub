import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useReplaceListingHighlightsMutation } from './useReplaceListingHighlightsMutation.js';
import { replaceListingHighlights } from '../../../api/listings.js';
import listingKeys from '../constants/queryKeys.js';

vi.mock('../../../api/listings.js', () => ({
  replaceListingHighlights: vi.fn(),
}));

const HIGHLIGHTS = [{ iconCode: 'wifi', text: 'Free Wi-Fi' }];

function Harness() {
  const { mutate, isSuccess } = useReplaceListingHighlightsMutation();
  return (
    <div>
      <button
        type="button"
        onClick={() =>
          mutate({ id: 7, highlights: HIGHLIGHTS, languageCode: 'hy' })
        }
      >
        save
      </button>
      <p data-testid="status">{isSuccess ? 'success' : 'idle'}</p>
    </div>
  );
}

describe('useReplaceListingHighlightsMutation (apps/web/src/modules/listings)', () => {
  let queryClient;

  beforeEach(() => {
    replaceListingHighlights.mockReset();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  test('calls replaceListingHighlights(id, highlights, languageCode) and invalidates the detail cache', async () => {
    replaceListingHighlights.mockResolvedValue({ data: { id: 7 } });
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
    expect(replaceListingHighlights).toHaveBeenCalledWith(7, HIGHLIGHTS, 'hy');
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: listingKeys.detail(7),
    });
  });
});
