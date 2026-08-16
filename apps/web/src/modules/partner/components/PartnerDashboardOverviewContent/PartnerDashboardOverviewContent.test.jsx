import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PropTypes from 'prop-types';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import PartnerDashboardOverviewContent from './PartnerDashboardOverviewContent.jsx';
import { usePartnerContext } from '../../../../contexts/PartnerContext.jsx';
import { useMyListingsQuery } from '../../../listings/index.js';
import { usePartnerBookingsQuery } from '../../../bookings/index.js';

vi.mock('../../../../contexts/PartnerContext.jsx', () => ({
  usePartnerContext: vi.fn(),
}));

vi.mock('../../../listings/index.js', () => {
  function MockListingStatusBadge({ status }) {
    return <span>{status}</span>;
  }
  MockListingStatusBadge.propTypes = { status: PropTypes.string.isRequired };
  return {
    useMyListingsQuery: vi.fn(),
    ListingStatusBadge: MockListingStatusBadge,
  };
});

vi.mock('../../../bookings/index.js', () => {
  function MockBookingCard({ booking }) {
    return <p>{booking.booking_reference}</p>;
  }
  MockBookingCard.propTypes = {
    // eslint-disable-next-line react/forbid-prop-types
    booking: PropTypes.object.isRequired,
  };
  return {
    usePartnerBookingsQuery: vi.fn(),
    BookingCard: MockBookingCard,
  };
});

vi.mock('../../../ai/index.js', () => ({
  AskAiButton: () => null,
}));

vi.mock('../../../payments/index.js', () => ({
  PartnerPayableBalanceCard: () => null,
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

function listingFixture(overrides) {
  return {
    id: 1,
    title: 'Seaside Villa',
    slug: 'seaside-villa',
    listing_type: 'PROPERTY',
    status: 'PUBLISHED',
    cover_image_url: null,
    created_at: '2026-07-01T00:00:00Z',
    ...overrides,
  };
}

function bookingFixture(overrides) {
  return {
    id: 1,
    booking_reference: 'BK-1',
    listing_id: 1,
    status: 'CONFIRMED',
    currency: 'AMD',
    total_amount: '1000.00',
    requested_at: '2026-01-01T00:00:00Z',
    date_from: null,
    date_to: null,
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/hy/partner']}>
      <Routes>
        <Route
          path="/:locale/partner"
          element={<PartnerDashboardOverviewContent />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PartnerDashboardOverviewContent (apps/web/src/modules/partner)', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    usePartnerContext.mockReturnValue({
      activePartnerId: 3,
      activePartner: { partner_id: 3, display_name: 'Ararat Travel' },
    });
  });

  test('greets the partner by organization name', () => {
    useMyListingsQuery.mockReturnValue({
      data: { pages: [{ results: [] }] },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });
    usePartnerBookingsQuery.mockReturnValue({
      data: { pages: [{ results: [] }] },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });
    renderPage();
    expect(
      screen.getByRole('heading', { name: 'Բարի վերադարձ, Ararat Travel' }),
    ).toBeInTheDocument();
  });

  test('shows a retryable error state when either query fails', async () => {
    const refetchListings = vi.fn();
    const refetchBookings = vi.fn();
    useMyListingsQuery.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      refetch: refetchListings,
    });
    usePartnerBookingsQuery.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: false,
      refetch: refetchBookings,
    });
    const user = userEvent.setup();
    renderPage();

    expect(
      screen.getByText('Վահանակը բեռնելիս սխալ առաջացավ։'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Կրկին փորձել' }));
    expect(refetchListings).toHaveBeenCalledTimes(1);
    expect(refetchBookings).toHaveBeenCalledTimes(1);
  });

  test('computes active/draft listing counts and pending/upcoming booking stats', () => {
    useMyListingsQuery.mockReturnValue({
      data: {
        pages: [
          {
            results: [
              listingFixture({ id: 1, status: 'PUBLISHED' }),
              listingFixture({ id: 2, status: 'PUBLISHED' }),
              listingFixture({ id: 3, status: 'DRAFT' }),
            ],
          },
        ],
      },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });
    usePartnerBookingsQuery.mockReturnValue({
      data: {
        pages: [
          {
            results: [
              bookingFixture({
                id: 1,
                status: 'CONFIRMED',
                date_from: '2099-01-01',
              }),
              bookingFixture({
                id: 2,
                status: 'PENDING_VENDOR',
                date_from: '2099-01-01',
              }),
            ],
          },
        ],
      },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });
    renderPage();

    const activeListingsLabel = screen.getByText('Ակտիվ հայտարարություններ');
    expect(
      within(activeListingsLabel.parentElement).getByText('2'),
    ).toBeInTheDocument();
    const draftListingsLabel = screen.getByText('Սևագիր հայտարարություններ');
    expect(
      within(draftListingsLabel.parentElement).getByText('1'),
    ).toBeInTheDocument();
    const pendingLabel = screen.getByText('Հաստատում սպասող ամրագրումներ');
    expect(
      within(pendingLabel.parentElement).getByText('1'),
    ).toBeInTheDocument();
  });

  test('shows the empty state and navigates to the listing wizard from its CTA', async () => {
    useMyListingsQuery.mockReturnValue({
      data: { pages: [{ results: [] }] },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });
    usePartnerBookingsQuery.mockReturnValue({
      data: { pages: [{ results: [] }] },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByText('Հայտարարություններ դեռ չկան')).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Ստեղծել հայտարարություն' }),
    );
    expect(mockNavigate).toHaveBeenCalledWith('/hy/partner/listings/new');
  });
});
