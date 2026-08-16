import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ToastProvider from '../../../../providers/ToastProvider.jsx';
import ReviewForm from './ReviewForm.jsx';
import { submitReview } from '../../../../api/reviews.js';

vi.mock('../../../../api/reviews.js', () => ({
  submitReview: vi.fn(),
}));

function renderForm() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ReviewForm bookingId={7} listingId={3} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('ReviewForm (apps/web/src/modules/reviews)', () => {
  beforeEach(() => {
    submitReview.mockReset();
  });

  test('submits the selected rating, title, and content for the given booking', async () => {
    submitReview.mockResolvedValue({ data: { id: 1 } });
    renderForm();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/^Վերնագիր/), 'Great stay');
    await user.type(screen.getByLabelText(/^Ձեր կարծիքը/), 'Loved it here.');
    await user.click(screen.getByRole('button', { name: 'Ուղարկել կարծիքը' }));

    await waitFor(() =>
      expect(submitReview).toHaveBeenCalledWith({
        bookingId: 7,
        rating: 5,
        title: 'Great stay',
        content: 'Loved it here.',
      }),
    );
    expect(
      await screen.findByText('Շնորհակալություն կարծիքի համար։'),
    ).toBeInTheDocument();
  });

  test('shows an error toast when submission fails', async () => {
    submitReview.mockRejectedValue(new Error('boom'));
    renderForm();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Ուղարկել կարծիքը' }));

    expect(
      await screen.findByText(
        'Չհաջողվեց ուղարկել կարծիքը։ Խնդրում ենք փորձել կրկին։',
      ),
    ).toBeInTheDocument();
  });
});
