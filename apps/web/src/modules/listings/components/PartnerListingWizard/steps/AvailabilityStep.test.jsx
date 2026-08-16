import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AvailabilityStep from './AvailabilityStep.jsx';
import {
  useBookableUnitsQuery,
  useBlackoutsQuery,
  useRegisterBookableUnitMutation,
  useCreateBlackoutMutation,
  useRemoveBlackoutMutation,
} from '../../../../availability/index.js';
import { useUpdateListingMutation } from '../../../mutations/useUpdateListingMutation.js';

vi.mock('../../../../availability/index.js', () => ({
  BOOKABLE_UNIT_TYPES: ['HOTEL_ROOM', 'PROPERTY_UNIT'],
  useBookableUnitsQuery: vi.fn(),
  useBlackoutsQuery: vi.fn(),
  useRegisterBookableUnitMutation: vi.fn(),
  useCreateBlackoutMutation: vi.fn(),
  useRemoveBlackoutMutation: vi.fn(),
}));
vi.mock('../../../mutations/useUpdateListingMutation.js', () => ({
  useUpdateListingMutation: vi.fn(),
}));

// `AvailabilityStep` reads the URL's `:locale` segment (to pass a
// locale-aware `DatePicker`), so every render needs a Router context.
function renderStep(props) {
  return render(
    <MemoryRouter initialEntries={['/hy/partner/listings/new']}>
      <Routes>
        <Route
          path="/:locale/partner/listings/new"
          element={
            // eslint-disable-next-line react/jsx-props-no-spreading -- test harness forwards per-test overrides
            <AvailabilityStep {...props} />
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AvailabilityStep (PartnerListingWizard)', () => {
  let registerUnitMutate;
  let createBlackoutMutate;
  let removeBlackoutMutate;
  let updateListingMutateAsync;

  beforeEach(() => {
    registerUnitMutate = vi.fn();
    createBlackoutMutate = vi.fn();
    removeBlackoutMutate = vi.fn();
    updateListingMutateAsync = vi.fn().mockResolvedValue({ data: {} });

    useBookableUnitsQuery.mockReturnValue({ data: [] });
    useBlackoutsQuery.mockReturnValue({ data: [] });
    useRegisterBookableUnitMutation.mockReturnValue({
      mutate: registerUnitMutate,
      isPending: false,
    });
    useCreateBlackoutMutation.mockReturnValue({
      mutate: createBlackoutMutate,
      isPending: false,
    });
    useRemoveBlackoutMutation.mockReturnValue({
      mutate: removeBlackoutMutate,
      isPending: false,
    });
    useUpdateListingMutation.mockReturnValue({
      mutateAsync: updateListingMutateAsync,
      isPending: false,
      error: null,
    });
  });

  test('offers unit registration when no unit exists yet', async () => {
    const user = userEvent.setup();
    renderStep({ listingId: 7, onNext: vi.fn() });

    await user.click(
      screen.getByRole('button', {
        name: 'Գրանցել միավոր',
      }),
    );
    expect(registerUnitMutate).toHaveBeenCalledWith({
      listingId: 7,
      bookableUnitType: 'HOTEL_ROOM',
    });
  });

  test('shows a registered-unit summary instead of the register form once a unit exists', () => {
    useBookableUnitsQuery.mockReturnValue({ data: [{ id: 1 }] });
    renderStep({ listingId: 7, onNext: vi.fn() });
    expect(
      screen.queryByRole('button', {
        name: 'Գրանցել միավոր',
      }),
    ).not.toBeInTheDocument();
  });

  test('lists existing blackout ranges and removes one on click', async () => {
    const user = userEvent.setup();
    useBlackoutsQuery.mockReturnValue({
      data: [{ id: 9, date_from: '2026-08-01', date_to: '2026-08-05' }],
    });
    renderStep({ listingId: 7, onNext: vi.fn() });

    expect(screen.getByText(/2026-08-01/)).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', {
        name: 'Հեռացնել',
      }),
    );
    expect(removeBlackoutMutate).toHaveBeenCalledWith({ id: 9, listingId: 7 });
  });

  test('the add-blackout button is disabled until a full range is picked', () => {
    renderStep({ listingId: 7, onNext: vi.fn() });
    expect(
      screen.getByRole('button', {
        name: 'Ավելացնել արգելափակում',
      }),
    ).toBeDisabled();
  });

  test('Continue with no booking-rule fields filled in skips the updateListing PATCH', async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();
    renderStep({ listingId: 7, onNext });
    await user.click(screen.getByRole('button', { name: 'Շարունակել' }));
    expect(updateListingMutateAsync).not.toHaveBeenCalled();
    expect(onNext).toHaveBeenCalled();
  });

  test('Continue with booking-rule fields filled in calls updateListing with parsed integers', async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();
    renderStep({ listingId: 7, onNext });

    await user.type(
      screen.getByLabelText('Նվազագույն մնալու տևողություն (գիշեր)'),
      '2',
    );
    await user.type(
      screen.getByLabelText('Առավելագույն մնալու տևողություն (գիշեր)'),
      '14',
    );

    await user.click(screen.getByRole('button', { name: 'Շարունակել' }));

    await waitFor(() => expect(updateListingMutateAsync).toHaveBeenCalled());
    expect(updateListingMutateAsync).toHaveBeenCalledWith({
      id: 7,
      payload: {
        bookingRules: {
          minimumStayNights: 2,
          maximumStayNights: 14,
          advanceBookingMinHours: undefined,
          advanceBookingMaxDays: undefined,
        },
      },
    });
    expect(onNext).toHaveBeenCalled();
  });
});
