import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import SearchResultCard from './SearchResultCard.jsx';

// FavoriteButton has its own dedicated test file — a trivial stub here
// keeps this file focused on SearchResultCard's own rendering and avoids
// needing an AuthProvider/QueryClientProvider just to satisfy
// FavoriteButton's internal hooks.
vi.mock(
  '../../../favorites/components/FavoriteButton/FavoriteButton.jsx',
  () => ({
    default: () => null,
  }),
);

const RESULT = {
  id: 7,
  listing_type: 'HOTEL',
  title: 'Yerevan Grand Hotel',
  summary: 'A central hotel with mountain views.',
  city_name: 'Yerevan',
  cover_image_url: 'https://example.test/cover.jpg',
  media_count: 1,
  price_amount: null,
  price_currency_code: null,
};

function renderCard(result = RESULT) {
  return render(
    <MemoryRouter initialEntries={['/en']}>
      <Routes>
        <Route path="/:locale" element={<SearchResultCard result={result} />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SearchResultCard (apps/web/src/modules/search)', () => {
  test('links to the listing detail route', () => {
    renderCard();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/en/listings/7');
  });

  test('renders the fields the search DTO actually returns', () => {
    renderCard();
    expect(
      screen.getByRole('heading', { name: 'Yerevan Grand Hotel' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Yerevan')).toBeInTheDocument();
    expect(
      screen.getByText('A central hotel with mountain views.'),
    ).toBeInTheDocument();
  });

  test('falls back to a placeholder when there is no cover image', () => {
    renderCard({ ...RESULT, cover_image_url: null });
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  test('omits the location line when city_name is absent', () => {
    renderCard({ ...RESULT, city_name: null });
    expect(screen.queryByText('Yerevan')).not.toBeInTheDocument();
  });

  test('shows a gallery-count indicator only when media_count is more than one', () => {
    renderCard({ ...RESULT, media_count: 4 });
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  test('renders no gallery-count indicator for zero or one photo', () => {
    renderCard({ ...RESULT, media_count: 1 });
    expect(screen.queryByText('1')).not.toBeInTheDocument();
  });

  test('renders a price when price_amount is present (Phase 10: real listing_pricing join)', () => {
    renderCard({
      ...RESULT,
      price_amount: '99.00',
      price_currency_code: 'USD',
    });
    expect(screen.getByText(/99/)).toBeInTheDocument();
  });

  test('renders no price when price_amount is null (never fabricated)', () => {
    renderCard(RESULT);
    expect(screen.queryByText(/^[\d$֏₽]/)).not.toBeInTheDocument();
  });
});
