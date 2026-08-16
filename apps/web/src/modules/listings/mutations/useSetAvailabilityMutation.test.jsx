import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSetAvailabilityMutation } from './useSetAvailabilityMutation.js';
import { setAvailability } from '../../../api/availability.js';
import listingKeys from '../constants/queryKeys.js';

vi.mock('../../../api/availability.js', () => ({
  setAvailability: vi.fn(),
}));

function Harness() {
  const { mutate, isSuccess } = useSetAvailabilityMutation(42);
  return (
    <div>
      <button
        type="button"
        onClick={() =>
          mutate({
            unitId: 5,
            dateFrom: '2026-08-01',
            dateTo: '2026-08-05',
            status: 'BLOCKED',
          })
        }
      >
        set availability
      </button>
      <p data-testid="status">{isSuccess ? 'success' : 'idle'}</p>
    </div>
  );
}

describe('useSetAvailabilityMutation (apps/web/src/modules/listings)', () => {
  let queryClient;

  beforeEach(() => {
    setAvailability.mockReset();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  test('calls setAvailability(payload) and invalidates the listing calendar cache', async () => {
    setAvailability.mockResolvedValue({ data: [{ date: '2026-08-01' }] });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <Harness />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'set availability' }));

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('success'),
    );
    expect(setAvailability).toHaveBeenCalledWith({
      unitId: 5,
      dateFrom: '2026-08-01',
      dateTo: '2026-08-05',
      status: 'BLOCKED',
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: [...listingKeys.details(), 42, 'calendar'],
    });
  });
});
