import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PropTypes from 'prop-types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCreateListingMutation } from './useCreateListingMutation.js';
import { createListing } from '../../../api/listings.js';
import listingKeys from '../constants/queryKeys.js';

vi.mock('../../../api/listings.js', () => ({
  createListing: vi.fn(),
}));

function Harness({ payload }) {
  const { mutate, data, isSuccess } = useCreateListingMutation();
  return (
    <div>
      <button type="button" onClick={() => mutate(payload)}>
        create
      </button>
      <p data-testid="status">{isSuccess ? 'success' : 'idle'}</p>
      <p data-testid="id">{data?.data?.id ?? ''}</p>
    </div>
  );
}

// eslint-disable-next-line react/forbid-prop-types -- test harness forwards an arbitrary payload shape
Harness.propTypes = { payload: PropTypes.object.isRequired };

describe('useCreateListingMutation (apps/web/src/modules/listings)', () => {
  let queryClient;

  beforeEach(() => {
    createListing.mockReset();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  test('calls createListing with the payload and invalidates the lists cache', async () => {
    createListing.mockResolvedValue({ data: { id: 42, status: 'DRAFT' } });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const user = userEvent.setup();
    const payload = { partnerId: 1, listingType: 'HOTEL', translations: [] };

    render(
      <QueryClientProvider client={queryClient}>
        <Harness payload={payload} />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'create' }));

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('success'),
    );
    expect(createListing).toHaveBeenCalledWith(payload);
    expect(screen.getByTestId('id')).toHaveTextContent('42');
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: listingKeys.lists(),
    });
  });
});
