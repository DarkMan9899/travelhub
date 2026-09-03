import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useReplaceListingItineraryMutation } from './useReplaceListingItineraryMutation.js';
import { replaceListingItinerarySteps } from '../../../api/listings.js';
import listingKeys from '../constants/queryKeys.js';

vi.mock('../../../api/listings.js', () => ({
  replaceListingItinerarySteps: vi.fn(),
}));

const STEPS = [{ title: 'Pickup', durationMinutes: 30 }];

function Harness() {
  const { mutate, isSuccess } = useReplaceListingItineraryMutation();
  return (
    <div>
      <button
        type="button"
        onClick={() => mutate({ id: 7, steps: STEPS, languageCode: 'hy' })}
      >
        save
      </button>
      <p data-testid="status">{isSuccess ? 'success' : 'idle'}</p>
    </div>
  );
}

describe('useReplaceListingItineraryMutation (apps/web/src/modules/listings)', () => {
  let queryClient;

  beforeEach(() => {
    replaceListingItinerarySteps.mockReset();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  test('calls replaceListingItinerarySteps(id, steps, languageCode) and invalidates the detail cache', async () => {
    replaceListingItinerarySteps.mockResolvedValue({ data: { id: 7 } });
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
    expect(replaceListingItinerarySteps).toHaveBeenCalledWith(7, STEPS, 'hy');
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: listingKeys.detail(7),
    });
  });
});
