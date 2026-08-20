import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ToastProvider from '../../../../providers/ToastProvider.jsx';
import ReviewsList from './ReviewsList.jsx';
import { listListingReviews } from '../../../../api/reviews.js';
import { useAuth } from '../../../../contexts/AuthContext.jsx';
import { useReportReviewMutation } from '../../mutations/useReportReviewMutation.js';

vi.mock('../../../../api/reviews.js', () => ({
  listListingReviews: vi.fn(),
}));
vi.mock('../../../../contexts/AuthContext.jsx', () => ({ useAuth: vi.fn() }));
vi.mock('../../mutations/useReportReviewMutation.js', () => ({
  useReportReviewMutation: vi.fn(),
}));

function renderList(listingId = 3) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ReviewsList listingId={listingId} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

const REVIEW_ROW = {
  id: 1,
  customer_display_name: 'Anna K.',
  rating: 5,
  title: 'Wonderful stay',
  content: 'Everything was great.',
  vendor_response: null,
  created_at: '2026-07-01T10:00:00.000Z',
};

describe('ReviewsList (apps/web/src/modules/reviews)', () => {
  let reportMutateAsync;

  beforeEach(() => {
    listListingReviews.mockReset();
    reportMutateAsync = vi.fn().mockResolvedValue({});
    useAuth.mockReturnValue({ isAuthenticated: false });
    useReportReviewMutation.mockReturnValue({
      mutateAsync: reportMutateAsync,
      isPending: false,
    });
  });

  test('shows an empty state when the listing has no reviews yet', async () => {
    listListingReviews.mockResolvedValue({
      data: [],
      meta: { has_more: false, rating_average: null, review_count: 0 },
    });
    renderList();
    expect(await screen.findByText('Կարծիքներ դեռ չկան')).toBeInTheDocument();
  });

  test('renders the rating summary and each review row on success', async () => {
    listListingReviews.mockResolvedValue({
      data: [REVIEW_ROW],
      meta: { has_more: false, rating_average: 4.5, review_count: 3 },
    });
    renderList();

    expect(await screen.findByText('Anna K.')).toBeInTheDocument();
    expect(screen.getByText('Wonderful stay')).toBeInTheDocument();
    expect(screen.getByText('Everything was great.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /4\.5.*3/ })).toBeInTheDocument();
  });

  test('shows a retryable error state when the request fails', async () => {
    listListingReviews.mockRejectedValue(new Error('boom'));
    renderList();
    await waitFor(() =>
      expect(
        screen.getByText('Չհաջողվեց բեռնել կարծիքները։'),
      ).toBeInTheDocument(),
    );
  });

  test('renders a vendor response when present', async () => {
    listListingReviews.mockResolvedValue({
      data: [{ ...REVIEW_ROW, vendor_response: 'Thank you for staying!' }],
      meta: { has_more: false, rating_average: 5, review_count: 1 },
    });
    renderList();

    expect(
      await screen.findByText('Thank you for staying!'),
    ).toBeInTheDocument();
  });

  test('a logged-out visitor sees no Report action', async () => {
    listListingReviews.mockResolvedValue({
      data: [REVIEW_ROW],
      meta: { has_more: false, rating_average: 5, review_count: 1 },
    });
    renderList();

    await screen.findByText('Anna K.');
    expect(
      screen.queryByRole('button', { name: 'Հայտնել' }),
    ).not.toBeInTheDocument();
  });

  test('a signed-in visitor can report a review', async () => {
    useAuth.mockReturnValue({ isAuthenticated: true });
    listListingReviews.mockResolvedValue({
      data: [REVIEW_ROW],
      meta: { has_more: false, rating_average: 5, review_count: 1 },
    });
    const user = userEvent.setup();
    renderList();

    await user.click(await screen.findByRole('button', { name: 'Հայտնել' }));
    await user.click(
      screen.getByRole('button', { name: 'Ուղարկել հայտնումը' }),
    );

    await waitFor(() => {
      expect(reportMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, reasonCode: 'SPAM' }),
      );
    });
  });
});
