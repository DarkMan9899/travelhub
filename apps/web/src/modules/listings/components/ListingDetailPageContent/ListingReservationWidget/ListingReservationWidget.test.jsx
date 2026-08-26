import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
vi.mock('@desavii/ui/components/form-controls', async () => {
  const actual = await vi.importActual('@desavii/ui/components/form-controls');
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
// P2.2B fixtures: real unit_label/max_guests/base_price/bed_configuration,
// the same shape the public units DTO actually returns.
const MULTI_UNIT_LABELED = [
  {
    id: 1,
    bookable_unit_type: 'HOTEL_ROOM',
    capacity: 2,
    unit_label: 'Standard Room',
    max_guests: 2,
    base_price_amount: '50000.00',
    base_price_currency: 'AMD',
    bed_configuration: [{ type: 'QUEEN', count: 1 }],
  },
  {
    id: 2,
    bookable_unit_type: 'HOTEL_ROOM',
    capacity: 1,
    unit_label: 'Deluxe Suite',
    max_guests: 4,
    base_price_amount: '90000.00',
    base_price_currency: 'AMD',
    bed_configuration: [{ type: 'KING', count: 1 }],
  },
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

  test('selecting dates enables submit and shows a checkout-exclusive estimated total', async () => {
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
    // P2.2B: SINGLE_UNIT is a PROPERTY_UNIT (accommodation) — the picked
    // range (2026-08-01 -> 2026-08-02) is a genuine 1-night stay, so only
    // the check-in day's price (100) is charged, matching the backend's
    // own checkout-exclusive `resolveConsumedRange`. The old inclusive-
    // both-ends sum (100 + 120 = 220) double-charged the checkout day —
    // this is the exact bug P2.2B fixes, not a weakened assertion.
    expect(screen.getByText(/100\.00/)).toBeInTheDocument();
    expect(screen.queryByText(/220/)).not.toBeInTheDocument();
  });

  test('a non-accommodation unit type keeps the original inclusive-both-ends estimate', async () => {
    useListingBookableUnitsQuery.mockReturnValue({
      data: [{ id: 1, bookable_unit_type: 'VEHICLE', capacity: 1 }],
      isPending: false,
      isError: false,
    });
    const user = userEvent.setup();
    renderWidget();

    await user.click(screen.getByRole('button', { name: 'pick dates' }));

    // A VEHICLE rental is billed inclusive of the return day — 100 + 120.
    expect(screen.getByText(/220/)).toBeInTheDocument();
  });

  test('the unit selector shows each real unit_label with its known max guests, not a generic "Type #N" ordinal', async () => {
    useListingBookableUnitsQuery.mockReturnValue({
      data: MULTI_UNIT_LABELED,
      isPending: false,
      isError: false,
    });
    const user = userEvent.setup();
    renderWidget();

    await user.click(screen.getByTestId('select-trigger'));

    expect(
      screen.getByRole('option', {
        name: 'Standard Room — Ընդունում է 2 հյուր',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', {
        name: 'Deluxe Suite — Ընդունում է 4 հյուր',
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Type #1/)).not.toBeInTheDocument();
  });

  test("selecting a different room type switches the headline price to that unit's own resolved price and shows its bed configuration", async () => {
    useListingBookableUnitsQuery.mockReturnValue({
      data: MULTI_UNIT_LABELED,
      isPending: false,
      isError: false,
    });
    const user = userEvent.setup();
    renderWidget({ pricing: { amount: '85000.00', currency: 'AMD' } });

    // Before any explicit selection, the static listing price is
    // unchanged (P2.2B: "before explicit selection, preserve existing
    // behavior").
    expect(screen.getByText(/85[.,]?000/)).toBeInTheDocument();

    await user.click(screen.getByTestId('select-trigger'));
    await user.click(
      screen.getByRole('option', {
        name: 'Deluxe Suite — Ընդունում է 4 հյուր',
      }),
    );

    // The headline now reflects the SELECTED unit's own base price, not
    // the static listing price.
    expect(screen.getByText(/90[.,]?000/)).toBeInTheDocument();
    expect(screen.queryByText(/85[.,]?000/)).not.toBeInTheDocument();
    expect(screen.getByText('1 × Քինգ')).toBeInTheDocument();
  });

  test('guest count is clamped to max_guests × quantity, both directly and when a shrinking quantity lowers the cap', () => {
    useListingBookableUnitsQuery.mockReturnValue({
      data: [
        { id: 1, bookable_unit_type: 'HOTEL_ROOM', capacity: 3, max_guests: 2 },
      ],
      isPending: false,
      isError: false,
    });
    renderWidget();

    const guestsInput = screen.getByLabelText('Հյուրեր');
    fireEvent.change(guestsInput, { target: { value: '99' } });
    // 2 max_guests x 1 (default) quantity.
    expect(guestsInput).toHaveValue(2);

    const quantityInput = screen.getByLabelText('Քանակ');
    fireEvent.change(quantityInput, { target: { value: '3' } });
    expect(quantityInput).toHaveValue(3);

    fireEvent.change(guestsInput, { target: { value: '99' } });
    // 2 max_guests x 3 quantity.
    expect(guestsInput).toHaveValue(6);

    fireEvent.change(quantityInput, { target: { value: '1' } });
    // Shrinking quantity back down re-clamps the already-entered guest
    // count so the two fields never drift into an invalid combination.
    expect(guestsInput).toHaveValue(2);
  });

  test('a legacy unit with no max_guests never invents a guest-count limit', () => {
    useListingBookableUnitsQuery.mockReturnValue({
      data: [{ id: 1, bookable_unit_type: 'HOTEL_ROOM', capacity: 2 }],
      isPending: false,
      isError: false,
    });
    renderWidget();

    const guestsInput = screen.getByLabelText('Հյուրեր');
    fireEvent.change(guestsInput, { target: { value: '99' } });
    expect(guestsInput).toHaveValue(99);
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

  test('a quantity greater than 1 is sent through in the hold request, along with the resolved unit label and guest count', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({
      data: {
        items: [{ hold_ids: [1, 2] }],
        expires_at: '2026-08-01T00:15:00Z',
      },
    });
    useCreateBookingHoldMutation.mockReturnValue({
      mutateAsync,
      isPending: false,
    });
    useListingBookableUnitsQuery.mockReturnValue({
      data: [
        {
          id: 1,
          bookable_unit_type: 'HOTEL_ROOM',
          capacity: 3,
          unit_label: 'Standard Room',
          max_guests: 2,
        },
      ],
      isPending: false,
      isError: false,
    });
    const user = userEvent.setup();
    renderWidget();

    const quantityInput = screen.getByLabelText('Քանակ');
    fireEvent.change(quantityInput, { target: { value: '2' } });

    const guestsInput = screen.getByLabelText('Հյուրեր');
    fireEvent.change(guestsInput, { target: { value: '3' } });

    await user.click(screen.getByRole('button', { name: 'pick dates' }));
    await user.click(
      screen.getByRole('button', { name: 'Ուղարկել ամրագրման հայտ' }),
    );

    expect(mutateAsync).toHaveBeenCalledWith([
      {
        bookableUnitId: 1,
        dateFrom: '2026-08-01',
        dateTo: '2026-08-02',
        quantity: 2,
      },
    ]);
    expect(mockNavigate).toHaveBeenCalledWith(
      '/en/booking/checkout',
      expect.objectContaining({
        state: expect.objectContaining({
          unitLabel: 'Standard Room',
          guestCount: 3,
        }),
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
