import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useReplaceListingFaqsMutation } from './useReplaceListingFaqsMutation.js';
import { replaceListingFaqs } from '../../../api/listings.js';
import listingKeys from '../constants/queryKeys.js';

vi.mock('../../../api/listings.js', () => ({
  replaceListingFaqs: vi.fn(),
}));

const FAQS = [{ question: 'Is parking free?', answer: 'Yes.' }];

function Harness() {
  const { mutate, isSuccess } = useReplaceListingFaqsMutation();
  return (
    <div>
      <button type="button" onClick={() => mutate({ id: 7, faqs: FAQS })}>
        save
      </button>
      <p data-testid="status">{isSuccess ? 'success' : 'idle'}</p>
    </div>
  );
}

describe('useReplaceListingFaqsMutation (apps/web/src/modules/listings)', () => {
  let queryClient;

  beforeEach(() => {
    replaceListingFaqs.mockReset();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  test('calls replaceListingFaqs(id, faqs) and invalidates the detail cache', async () => {
    replaceListingFaqs.mockResolvedValue({ data: { id: 7 } });
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
    expect(replaceListingFaqs).toHaveBeenCalledWith(7, FAQS);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: listingKeys.detail(7),
    });
  });
});
