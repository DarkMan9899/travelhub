import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import BookingCard from './BookingCard.jsx';
import { getListing } from '../../../../api/listings.js';

vi.mock('../../../../api/listings.js', () => ({
  getListing: vi.fn(),
}));

const BASE_BOOKING = {
  id: 7,
  booking_reference: 'BK-20260101-ABCDEF23',
  listing_id: 1,
  status: 'PENDING_VENDOR',
  currency: 'AMD',
  total_amount: '85000.00',
  requested_at: '2026-07-01T10:00:00.000Z',
};

const BASE_LISTING = {
  id: 1,
  slug: 'sunset-ridge-villa',
  translations: [{ language_id: 1, title: 'Sunset Ridge Villa' }],
  media: [],
};

function renderBookingCard(booking = BASE_BOOKING) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/en']}>
        <Routes>
          <Route path="/:locale" element={<BookingCard booking={booking} />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('BookingCard (apps/web/src/modules/bookings)', () => {
  beforeEach(() => {
    getListing.mockReset();
    getListing.mockResolvedValue({ data: BASE_LISTING });
  });

  test('renders the listing title once resolved, the reference, and the status badge', async () => {
    renderBookingCard();
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Sunset Ridge Villa' }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText('BK-20260101-ABCDEF23')).toBeInTheDocument();
    expect(screen.getByText('Սպասվում է հաստատման')).toBeInTheDocument();
  });

  test('links to the booking detail route for the current locale', async () => {
    renderBookingCard();
    await waitFor(() =>
      expect(
        screen.getByRole('link', { name: /BK-20260101-ABCDEF23/ }),
      ).toHaveAttribute('href', '/en/account/bookings/7'),
    );
  });

  test('renders a placeholder, not a broken image, when the listing has no media', async () => {
    renderBookingCard();
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Sunset Ridge Villa' }),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
