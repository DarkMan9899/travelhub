import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import FavoritesPageContent from './FavoritesPageContent.jsx';
import { listFavorites } from '../../../../api/favorites.js';

vi.mock('../../../../api/favorites.js', () => ({
  listFavorites: vi.fn(),
}));
vi.mock('../FavoriteButton/FavoriteButton.jsx', () => ({
  default: () => null,
}));

const FAVORITE_ROW = {
  favorite_id: 1,
  favorited_at: '2026-07-01T00:00:00.000Z',
  listing_id: 5,
  listing_type: 'HOTEL',
  status: 'PUBLISHED',
  slug: 'sunset-villa',
  title: 'Sunset Villa',
  city_name: 'Yerevan',
  cover_image_url: null,
  price_amount: '150.00',
  price_currency_code: 'USD',
  rating_average: 4.5,
  review_count: 3,
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/hy']}>
        <Routes>
          <Route path="/:locale" element={<FavoritesPageContent />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('FavoritesPageContent (apps/web/src/modules/favorites)', () => {
  beforeEach(() => {
    listFavorites.mockReset();
  });

  test('renders a card per favorited listing', async () => {
    listFavorites.mockResolvedValue({
      data: [FAVORITE_ROW],
      meta: { has_more: false },
    });
    renderPage();
    expect(await screen.findByText('Sunset Villa')).toBeInTheDocument();
  });

  test('shows an empty state when there are no favorites yet', async () => {
    listFavorites.mockResolvedValue({ data: [], meta: { has_more: false } });
    renderPage();
    expect(await screen.findByText('Ընտրյալներ դեռ չկան')).toBeInTheDocument();
  });

  test('shows a retryable error state when the request fails', async () => {
    listFavorites.mockRejectedValue(new Error('boom'));
    renderPage();
    expect(
      await screen.findByText('Չհաջողվեց բեռնել Ձեր ընտրյալները։'),
    ).toBeInTheDocument();
  });
});
