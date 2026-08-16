import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PropTypes from 'prop-types';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ToastProvider from '../../../../../providers/ToastProvider.jsx';
import ListingReservationWidget from './ListingReservationWidget.jsx';
import { useAuth } from '../../../../../contexts/AuthContext.jsx';
import { useListingBookableUnitsQuery } from '../../../queries/useListingBookableUnitsQuery.js';
import { useListingCalendarQuery } from '../../../queries/useListingCalendarQuery.js';
import { useListingDayStatusQuery } from '../../../queries/useListingDayStatusQuery.js';
import { useCreateBookingHoldMutation } from '../../../../bookings/mutations/useCreateBookingHoldMutation.js';

vi.mock('../../../../../contexts/AuthContext.jsx', () => ({
  useAuth: vi.fn(),
}));
vi.mock('../../../queries/useListingBookableUnitsQuery.js', () => ({
  useListingBookableUnitsQuery: vi.fn(),
  default: vi.fn(),
}));
vi.mock('../../../queries/useListingCalendarQuery.js', () => ({
  useListingCalendarQuery: vi.fn(),
  default: vi.fn(),
}));
vi.mock('../../../queries/useListingDayStatusQuery.js', () => ({
  useListingDayStatusQuery: vi.fn(),
  default: vi.fn(),
}));
vi.mock(
  '../../../../bookings/mutations/useCreateBookingHoldMutation.js',
  () => ({
    useCreateBookingHoldMutation: vi.fn(),
    default: vi.fn(),
  }),
);

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

// DatePicker's own calendar-grid UX is covered by DatePicker.test.jsx;
// this widget's test only needs to drive its `onChange` contract to
// exercise the widget's OWN logic (gating, estimate, submit, redirect).
vi.mock('@travelhub/ui/components/form-controls', async () => {
  const actual = await vi.importActual(
    '@travelhub/ui/components/form-controls',
  );
  function MockDatePicker({ onChange, disabledDates = [] }) {
    return (
      <>
        <button
          type="button"
          onClick={() => onChange({ start: '2026-08-01', end: '2026-08-02' })}
        >
          pick dates
        </button>
        <div data-testid="disabled-dates">{disabledDates.join(',')}</div>
      </>
    );
  }
  MockDatePicker.propTypes = {
    onChange: PropTypes.func.isRequired,
    disabledDates: PropTypes.arrayOf(PropTypes.string),
  };
  return {
    ...actual,
    DatePicker: MockDatePicker,
  };
});

const SINGLE_UNIT = [
  { id: 1, bookable_unit_type: 'PROPERTY_UNIT', capacity: 1 },
];
const MULTI_UNIT = [
  { id: 1, bookable_unit_type: 'HOTEL_ROOM', capacity: 2 },
  { id: 2, bookable_unit_type: 'HOTEL_ROOM', capacity: 4 },
];
const CALENDAR_DAYS = [
  {
    date: '2026-08-01',
    status: 'AVAILABLE',
    price_amount: '100.00',
    price_currency: 'AMD',
  },
  {
    date: '2026-08-02',
    status: 'AVAILABLE',
    price_amount: '120.00',
    price_currency: 'AMD',
  },
];
const DAY_STATUSES = [
  {
    date: '2026-08-01',
    availability_status: 'AVAILABLE',
    remaining_count: null,
  },
  {
    date: '2026-08-02',
    availability_status: 'AVAILABLE',
    remaining_count: null,
  },
];

function renderWidget(props = {}) {
  return render(
    <MemoryRouter initialEntries={['/en/listings/10']}>
      <ToastProvider>
        <Routes>
          <Route
            path="/:locale/listings/:id"
            element={
              <ListingReservationWidget
                listingId={10}
                pricing={{ amount: '85000.00', currency: 'AMD' }}
                // eslint-disable-next-line react/jsx-props-no-spreading
                {...props}
              />
            }
          />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('ListingReservationWidget (Listing Details, Phase 7)', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    useAuth.mockReturnValue({ isAuthenticated: true });
    useListingCalendarQuery.mockReturnValue({
      data: CALENDAR_DAYS,
      refetch: vi.fn(),
    });
    useListingDayStatusQuery.mockReturnValue({
      data: DAY_STATUSES,
      refetch: vi.fn(),
    });
    useCreateBookingHoldMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
  });

  test('shows a spinner while units are pending', () => {
    useListingBookableUnitsQuery.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
    });
    renderWidget();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  test('shows a retryable error state when the units query fails', async () => {
    const refetch = vi.fn();
    useListingBookableUnitsQuery.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      refetch,
    });
    const user = userEvent.setup();
    renderWidget();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    await user.click(screen.getByRole('button'));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  test('shows the price and an honest "not bookable yet" message when the listing has zero units', () => {
    useListingBookableUnitsQuery.mockReturnValue({
      data: [],
      isPending: false,
      isError: false,
    });
    renderWidget();
    expect(
      screen.getByText(
        'Այս հայտարարությունը դեռ հասանելի չէ առցանց ամրագրման համար։',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Ուղարկել/ }),
    ).not.toBeInTheDocument();
  });

  test('auto-selects the single unit — no unit selector shown', () => {
    useListingBookableUnitsQuery.mockReturnValue({
      data: SINGLE_UNIT,
      isPending: false,
      isError: false,
    });
    renderWidget();
    expect(screen.queryByText('Միավոր')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Ուղարկել ամրագրման հայտ' }),
    ).toBeInTheDocument();
  });

  test('shows a unit selector when there is more than one unit', () => {
    useListingBookableUnitsQuery.mockReturnValue({
      data: MULTI_UNIT,
      isPending: false,
      isError: false,
    });
    renderWidget();
    expect(screen.getByText('Միավոր')).toBeInTheDocument();
  });

  test('the Request to Book button is disabled until dates are selected', () => {
    useListingBookableUnitsQuery.mockReturnValue({
      data: SINGLE_UNIT,
      isPending: false,
      isError: false,
    });
    renderWidget();
    expect(
      screen.getByRole('button', { name: 'Ուղարկել ամրագրման հայտ' }),
    ).toBeDisabled();
  });

  test('selecting dates enables submit and shows an estimated total', async () => {
    useListingBookableUnitsQuery.mockReturnValue({
      data: SINGLE_UNIT,
      isPending: false,
      isError: false,
    });
    const user = userEvent.setup();
    renderWidget();

    await user.click(screen.getByRole('button', { name: 'pick dates' }));

    expect(
      screen.getByRole('button', { name: 'Ուղարկել ամրագրման հայտ' }),
    ).toBeEnabled();
    // 100 + 120 = 220 estimated total for the two selected days.
    expect(screen.getByText(/220/)).toBeInTheDocument();
  });

  test('clicking Request to Book while unauthenticated redirects to login without creating a hold', async () => {
    useAuth.mockReturnValue({ isAuthenticated: false });
    const mutateAsync = vi.fn();
    useCreateBookingHoldMutation.mockReturnValue({
      mutateAsync,
      isPending: false,
    });
    useListingBookableUnitsQuery.mockReturnValue({
      data: SINGLE_UNIT,
      isPending: false,
      isError: false,
    });
    const user = userEvent.setup();
    renderWidget();

    await user.click(screen.getByRole('button', { name: 'pick dates' }));
    await user.click(
      screen.getByRole('button', { name: 'Ուղարկել ամրագրման հայտ' }),
    );

    expect(mutateAsync).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining('/en/auth/login?redirect='),
    );
  });

  test('clicking Request to Book while authenticated creates a hold and navigates to checkout', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({
      data: { items: [{ hold_ids: [1] }], expires_at: '2026-08-01T00:15:00Z' },
    });
    useCreateBookingHoldMutation.mockReturnValue({
      mutateAsync,
      isPending: false,
    });
    useListingBookableUnitsQuery.mockReturnValue({
      data: SINGLE_UNIT,
      isPending: false,
      isError: false,
    });
    const user = userEvent.setup();
    renderWidget();

    await user.click(screen.getByRole('button', { name: 'pick dates' }));
    await user.click(
      screen.getByRole('button', { name: 'Ուղարկել ամրագրման հայտ' }),
    );

    expect(mutateAsync).toHaveBeenCalledWith([
      {
        bookableUnitId: 1,
        dateFrom: '2026-08-01',
        dateTo: '2026-08-02',
        quantity: 1,
      },
    ]);
    expect(mockNavigate).toHaveBeenCalledWith(
      '/en/booking/checkout',
      expect.objectContaining({
        state: expect.objectContaining({ listingId: 10 }),
      }),
    );
  });

  test('shows an error toast and does not navigate when the hold request fails', async () => {
    const mutateAsync = vi.fn().mockRejectedValue(new Error('conflict'));
    useCreateBookingHoldMutation.mockReturnValue({
      mutateAsync,
      isPending: false,
    });
    useListingBookableUnitsQuery.mockReturnValue({
      data: SINGLE_UNIT,
      isPending: false,
      isError: false,
    });
    const user = userEvent.setup();
    renderWidget();

    await user.click(screen.getByRole('button', { name: 'pick dates' }));
    await user.click(
      screen.getByRole('button', { name: 'Ուղարկել ամրագրման հայտ' }),
    );

    expect(
      await screen.findByText(
        'Չհաջողվեց պահել այս ամսաթվերը։ Խնդրում ենք կրկին փորձել։',
      ),
    ).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('a stale-availability conflict (AVAILABILITY_CONFLICT) shows a specific message and refreshes the calendar', async () => {
    const conflictError = Object.assign(new Error('No capacity'), {
      code: 'AVAILABILITY_CONFLICT',
    });
    const mutateAsync = vi.fn().mockRejectedValue(conflictError);
    useCreateBookingHoldMutation.mockReturnValue({
      mutateAsync,
      isPending: false,
    });
    useListingBookableUnitsQuery.mockReturnValue({
      data: SINGLE_UNIT,
      isPending: false,
      isError: false,
    });
    const refetch = vi.fn();
    useListingCalendarQuery.mockReturnValue({
      data: CALENDAR_DAYS,
      refetch,
    });
    const refetchDayStatus = vi.fn();
    useListingDayStatusQuery.mockReturnValue({
      data: DAY_STATUSES,
      refetch: refetchDayStatus,
    });
    const user = userEvent.setup();
    renderWidget();

    await user.click(screen.getByRole('button', { name: 'pick dates' }));
    await user.click(
      screen.getByRole('button', { name: 'Ուղարկել ամրագրման հայտ' }),
    );

    expect(
      await screen.findByText(
        'Այս ամսաթվերն այլևս հասանելի չեն։ Խնդրում ենք ընտրել այլ ամսաթվեր։',
      ),
    ).toBeInTheDocument();
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(refetchDayStatus).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('disables a day whose day-status is SOLD_OUT even when the raw calendar still says AVAILABLE (Phase 18 Availability UX fix)', async () => {
    // The raw calendar's own `status` field only reflects `status_id`
    // (AVAILABLE/BLOCKED) — a day whose `quantity_available` a manual
    // block or external reservation already consumed to zero without
    // flipping `status_id` would incorrectly still show as pickable if
    // the widget trusted `useListingCalendarQuery` for this. The day-status
    // endpoint is the authoritative source instead.
    useListingDayStatusQuery.mockReturnValue({
      data: [
        {
          date: '2026-08-01',
          availability_status: 'SOLD_OUT',
          remaining_count: 0,
        },
        {
          date: '2026-08-02',
          availability_status: 'AVAILABLE',
          remaining_count: null,
        },
      ],
      refetch: vi.fn(),
    });
    useListingBookableUnitsQuery.mockReturnValue({
      data: SINGLE_UNIT,
      isPending: false,
      isError: false,
    });
    renderWidget();

    expect(screen.getByTestId('disabled-dates')).toHaveTextContent(
      '2026-08-01',
    );
    expect(screen.getByTestId('disabled-dates')).not.toHaveTextContent(
      '2026-08-02',
    );
  });

  test('a blackout-veto conflict (BLACKOUT_DATE) also shows the specific conflict message', async () => {
    const conflictError = Object.assign(new Error('Blocked'), {
      code: 'BLACKOUT_DATE',
    });
    const mutateAsync = vi.fn().mockRejectedValue(conflictError);
    useCreateBookingHoldMutation.mockReturnValue({
      mutateAsync,
      isPending: false,
    });
    useListingBookableUnitsQuery.mockReturnValue({
      data: SINGLE_UNIT,
      isPending: false,
      isError: false,
    });
    const user = userEvent.setup();
    renderWidget();

    await user.click(screen.getByRole('button', { name: 'pick dates' }));
    await user.click(
      screen.getByRole('button', { name: 'Ուղարկել ամրագրման հայտ' }),
    );

    expect(
      await screen.findByText(
        'Այս ամսաթվերն այլևս հասանելի չեն։ Խնդրում ենք ընտրել այլ ամսաթվեր։',
      ),
    ).toBeInTheDocument();
  });

  test('renders the group-scoped booking CTA copy when a category-specific bookingCtaKey is passed', () => {
    useListingBookableUnitsQuery.mockReturnValue({
      data: SINGLE_UNIT,
      isPending: false,
      isError: false,
    });
    renderWidget({
      bookingCtaKey:
        'pages.listingDetail.reservation.requestToBookByGroup.EXPERIENCE',
    });

    expect(
      screen.getByRole('button', { name: 'Ամրագրել ձեր տեղը' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Ուղարկել ամրագրման հայտ' }),
    ).not.toBeInTheDocument();
  });
});
