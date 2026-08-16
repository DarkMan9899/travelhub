import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ReviewsList from './ReviewsList.jsx';
import { listListingReviews } from '../../../../api/reviews.js';

vi.mock('../../../../api/reviews.js', () => ({
  listListingReviews: vi.fn(),
}));

function renderList(listingId = 3) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ReviewsList listingId={listingId} />
    </QueryClientProvider>,
  );
}

const REVIEW_ROW = {
  id: 1,
  customer_display_name: 'Anna K.',
  rating: 5,
  title: 'Wonderful stay',
  content: 'Everything was great.',
  created_at: '2026-07-01T10:00:00.000Z',
};

describe('ReviewsList (apps/web/src/modules/reviews)', () => {
  beforeEach(() => {
    listListingReviews.mockReset();
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
});
