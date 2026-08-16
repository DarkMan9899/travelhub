import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ToastProvider from '../../../../providers/ToastProvider.jsx';
import PartnerCalendarPageContent from './PartnerCalendarPageContent.jsx';
import { usePartnerContext } from '../../../../contexts/PartnerContext.jsx';
import {
  useMyListingsQuery,
  useListingCalendarQuery,
  useSetAvailabilityMutation,
} from '../../../listings/index.js';
import {
  useBookableUnitsQuery,
  useUnitBreakdownQuery,
  useInventoryBlocksQuery,
  useExternalReservationsQuery,
  useCreateInventoryBlockMutation,
  useReleaseInventoryBlockMutation,
  useCreateExternalReservationMutation,
  useCancelExternalReservationMutation,
} from '../../../availability/index.js';

vi.mock('../../../../contexts/PartnerContext.jsx', () => ({
  usePartnerContext: vi.fn(),
}));

vi.mock('../../../listings/index.js', async () => {
  const actual = await vi.importActual('../../../listings/index.js');
  return {
    ...actual,
    useMyListingsQuery: vi.fn(),
    useListingCalendarQuery: vi.fn(),
    useSetAvailabilityMutation: vi.fn(),
  };
});

vi.mock('../../../availability/index.js', async () => {
  const actual = await vi.importActual('../../../availability/index.js');
  return {
    ...actual,
    useBookableUnitsQuery: vi.fn(),
    useUnitBreakdownQuery: vi.fn(),
    useInventoryBlocksQuery: vi.fn(),
    useExternalReservationsQuery: vi.fn(),
    useCreateInventoryBlockMutation: vi.fn(),
    useReleaseInventoryBlockMutation: vi.fn(),
    useCreateExternalReservationMutation: vi.fn(),
    useCancelExternalReservationMutation: vi.fn(),
  };
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/hy/partner/calendar']}>
      <ToastProvider>
        <Routes>
          <Route
            path="/:locale/partner/calendar"
            element={<PartnerCalendarPageContent />}
          />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );
}

const EMPTY_LIST_QUERY = { data: [], isPending: false, isError: false };
const NOOP_MUTATION = { mutateAsync: vi.fn(), isPending: false };

describe('PartnerCalendarPageContent (apps/web/src/modules/partner)', () => {
  let mutateAsync;

  beforeEach(() => {
    // OWNER bypasses the capability matrix entirely (roleHasCapability),
    // matching the real server-side rule — grants every action tab so
    // these tests exercise the full component, not a permission-gated
    // subset.
    usePartnerContext.mockReturnValue({
      activePartnerId: 3,
      activePartner: { role: 'OWNER' },
    });
    mutateAsync = vi.fn().mockResolvedValue({});
    useSetAvailabilityMutation.mockReturnValue({
      mutateAsync,
      isPending: false,
    });
    useUnitBreakdownQuery.mockReturnValue(EMPTY_LIST_QUERY);
    useInventoryBlocksQuery.mockReturnValue(EMPTY_LIST_QUERY);
    useExternalReservationsQuery.mockReturnValue(EMPTY_LIST_QUERY);
    useCreateInventoryBlockMutation.mockReturnValue(NOOP_MUTATION);
    useReleaseInventoryBlockMutation.mockReturnValue(NOOP_MUTATION);
    useCreateExternalReservationMutation.mockReturnValue(NOOP_MUTATION);
    useCancelExternalReservationMutation.mockReturnValue(NOOP_MUTATION);
  });

  test('shows an empty state when the partner has no listings', () => {
    useMyListingsQuery.mockReturnValue({
      data: { pages: [{ results: [] }] },
      isPending: false,
    });
    useBookableUnitsQuery.mockReturnValue({ data: [], isPending: false });
    useListingCalendarQuery.mockReturnValue({
      data: [],
      isPending: false,
      isError: false,
    });
    renderPage();
    expect(screen.getByText('Հայտարարություններ դեռ չկան')).toBeInTheDocument();
  });

  test('shows a "no units" empty state when the selected listing has none', () => {
    useMyListingsQuery.mockReturnValue({
      data: {
        pages: [
          { results: [{ id: 1, title: 'Seaside Villa', status: 'PUBLISHED' }] },
        ],
      },
      isPending: false,
    });
    useBookableUnitsQuery.mockReturnValue({ data: [], isPending: false });
    useListingCalendarQuery.mockReturnValue({
      data: [],
      isPending: false,
      isError: false,
    });
    renderPage();
    expect(
      screen.getByText('Այս հայտարարությունը չունի ամրագրվող միավորներ'),
    ).toBeInTheDocument();
  });

  test('renders the calendar grid once a unit is available', () => {
    useMyListingsQuery.mockReturnValue({
      data: {
        pages: [
          { results: [{ id: 1, title: 'Seaside Villa', status: 'PUBLISHED' }] },
        ],
      },
      isPending: false,
    });
    useBookableUnitsQuery.mockReturnValue({
      data: [{ id: 5, bookable_unit_type: 'PROPERTY_UNIT' }],
      isPending: false,
    });
    useListingCalendarQuery.mockReturnValue({
      data: [{ date: '2026-07-01', status: 'BLOCKED' }],
      isPending: false,
      isError: false,
    });
    renderPage();
    expect(screen.getByRole('grid')).toBeInTheDocument();
    expect(useListingCalendarQuery).toHaveBeenCalledWith(
      1,
      5,
      expect.objectContaining({
        from: expect.any(String),
        to: expect.any(String),
      }),
    );
  });

  test('selecting a date range shows the apply form; applying calls the mutation and toasts success', async () => {
    useMyListingsQuery.mockReturnValue({
      data: {
        pages: [
          { results: [{ id: 1, title: 'Seaside Villa', status: 'PUBLISHED' }] },
        ],
      },
      isPending: false,
    });
    useBookableUnitsQuery.mockReturnValue({
      data: [{ id: 5, bookable_unit_type: 'PROPERTY_UNIT' }],
      isPending: false,
    });
    useListingCalendarQuery.mockReturnValue({
      data: [],
      isPending: false,
      isError: false,
    });
    const user = userEvent.setup();
    renderPage();

    const cells = screen.getAllByRole('gridcell', { name: /2026/ });
    const firstEnabledCell = cells.find(
      (cell) => !cell.hasAttribute('disabled'),
    );
    await user.click(firstEnabledCell);

    expect(screen.getByRole('button', { name: 'Կիրառել' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Կիրառել' }));

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ unitId: 5, status: 'AVAILABLE' }),
      ),
    );
    expect(
      await screen.findByText('Հասանելիությունը թարմացվել է։'),
    ).toBeInTheDocument();
  });

  test('typing a custom block quantity and notes sends the typed values, not the change event', async () => {
    useMyListingsQuery.mockReturnValue({
      data: {
        pages: [
          { results: [{ id: 1, title: 'Seaside Villa', status: 'PUBLISHED' }] },
        ],
      },
      isPending: false,
    });
    useBookableUnitsQuery.mockReturnValue({
      data: [{ id: 5, bookable_unit_type: 'PROPERTY_UNIT' }],
      isPending: false,
    });
    useListingCalendarQuery.mockReturnValue({
      data: [],
      isPending: false,
      isError: false,
    });
    const createBlock = vi.fn().mockResolvedValue({});
    useCreateInventoryBlockMutation.mockReturnValue({
      mutateAsync: createBlock,
      isPending: false,
    });
    const user = userEvent.setup();
    renderPage();

    const cells = screen.getAllByRole('gridcell', { name: /2026/ });
    const firstEnabledCell = cells.find(
      (cell) => !cell.hasAttribute('disabled'),
    );
    await user.click(firstEnabledCell);
    await user.click(screen.getByRole('tab', { name: /Արգելափակել/ }));

    const quantityInput = screen.getByLabelText('Արգելափակվող քանակ');
    await user.clear(quantityInput);
    await user.type(quantityInput, '3');
    const notesInput = screen.getByLabelText('Նշումներ (ընտրովի)');
    await user.type(notesInput, 'Roof repair');

    await user.click(screen.getByRole('button', { name: 'Արգելափակել' }));

    await waitFor(() =>
      expect(createBlock).toHaveBeenCalledWith(
        expect.objectContaining({ quantity: 3, notes: 'Roof repair' }),
      ),
    );
  });
});
