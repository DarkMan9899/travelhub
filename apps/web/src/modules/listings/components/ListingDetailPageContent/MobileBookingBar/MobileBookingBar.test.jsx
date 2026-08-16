import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import MobileBookingBar from './MobileBookingBar.jsx';

// This test only needs to prove MobileBookingBar's own contract (bar
// content, opening the drawer, forwarding props) — the reservation
// widget's own booking logic is already covered by
// ListingReservationWidget.test.jsx.
vi.mock('../ListingReservationWidget/ListingReservationWidget.jsx', () => ({
  default: ({ listingId, bookingCtaKey }) => (
    <div data-testid="reservation-widget">
      {`widget for listing ${listingId} (${bookingCtaKey})`}
    </div>
  ),
}));

// This project's test setup defaults i18next to Armenian (hy) — mirrors
// the exact locale-string convention every other component test in this
// module already uses, rather than English.
const REQUEST_TO_BOOK = 'Ուղարկել ամրագրման հայտ';
const RESERVE_YOUR_SPOT = 'Ամրագրել ձեր տեղը';
const NO_UNITS_AVAILABLE =
  'Այս հայտարարությունը դեռ հասանելի չէ առցանց ամրագրման համար։';

const PRICING = { amount: 120, currency: 'USD', pricing_model: 'PER_NIGHT' };

function renderBar({ listingId, pricing, bookingCtaKey }) {
  return render(
    <MemoryRouter initialEntries={['/en/listings/7']}>
      <Routes>
        <Route
          path="/:locale/listings/:id"
          element={
            <MobileBookingBar
              listingId={listingId}
              pricing={pricing}
              bookingCtaKey={bookingCtaKey}
            />
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('MobileBookingBar', () => {
  test('renders the price and CTA button, with the drawer closed by default', () => {
    renderBar({
      listingId: 7,
      pricing: PRICING,
      bookingCtaKey: 'pages.listingDetail.reservation.requestToBook',
    });
    expect(screen.getByText(/120/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: REQUEST_TO_BOOK }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('reservation-widget')).not.toBeInTheDocument();
  });

  test('shows a "no units" message instead of a price when pricing is null', () => {
    renderBar({
      listingId: 7,
      pricing: null,
      bookingCtaKey: 'pages.listingDetail.reservation.requestToBook',
    });
    expect(screen.getByText(NO_UNITS_AVAILABLE)).toBeInTheDocument();
  });

  test('tapping the CTA opens the drawer with the reservation widget for this listing', async () => {
    const user = userEvent.setup();
    renderBar({
      listingId: 7,
      pricing: PRICING,
      bookingCtaKey: 'pages.listingDetail.reservation.requestToBook',
    });

    await user.click(screen.getByRole('button', { name: REQUEST_TO_BOOK }));

    expect(screen.getByTestId('reservation-widget')).toHaveTextContent(
      'widget for listing 7',
    );
  });

  test('uses the group-scoped booking CTA copy when a category-specific key is passed', () => {
    renderBar({
      listingId: 7,
      pricing: PRICING,
      bookingCtaKey:
        'pages.listingDetail.reservation.requestToBookByGroup.EXPERIENCE',
    });
    expect(
      screen.getByRole('button', { name: RESERVE_YOUR_SPOT }),
    ).toBeInTheDocument();
  });
});
