import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AdminInventoryPageContent from './AdminInventoryPageContent.jsx';
import {
  useListingQuery,
  useListingBookableUnitsQuery,
} from '../../../listings/index.js';
import {
  useUnitBreakdownQuery,
  useUnitLedgerQuery,
  useUnitHoldsQuery,
  useInventoryBlocksQuery,
  useExternalReservationsQuery,
  useInventoryConnectionsQuery,
  useConnectionSyncRunsQuery,
  useConnectionConflictsQuery,
} from '../../../availability/index.js';

vi.mock('../../../listings/index.js', async () => {
  const actual = await vi.importActual('../../../listings/index.js');
  return {
    ...actual,
    useListingQuery: vi.fn(),
    useListingBookableUnitsQuery: vi.fn(),
  };
});

vi.mock('../../../availability/index.js', async () => {
  const actual = await vi.importActual('../../../availability/index.js');
  return {
    ...actual,
    useUnitBreakdownQuery: vi.fn(),
    useUnitLedgerQuery: vi.fn(),
    useUnitHoldsQuery: vi.fn(),
    useInventoryBlocksQuery: vi.fn(),
    useExternalReservationsQuery: vi.fn(),
    useInventoryConnectionsQuery: vi.fn(),
    useConnectionSyncRunsQuery: vi.fn(),
    useConnectionConflictsQuery: vi.fn(),
  };
});

const PENDING_QUERY = { data: undefined, isPending: true, isError: false };
const EMPTY_LIST_QUERY = { data: [], isPending: false, isError: false };

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/hy/admin/inventory']}>
      <Routes>
        <Route
          path="/:locale/admin/inventory"
          element={<AdminInventoryPageContent />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AdminInventoryPageContent (apps/web/src/modules/admin)', () => {
  test('shows the no-lookup empty state before any listing id is entered', () => {
    useListingQuery.mockReturnValue(PENDING_QUERY);
    useListingBookableUnitsQuery.mockReturnValue(EMPTY_LIST_QUERY);
    useUnitBreakdownQuery.mockReturnValue(EMPTY_LIST_QUERY);
    useUnitLedgerQuery.mockReturnValue(EMPTY_LIST_QUERY);
    useInventoryBlocksQuery.mockReturnValue(EMPTY_LIST_QUERY);
    useExternalReservationsQuery.mockReturnValue(EMPTY_LIST_QUERY);
    useInventoryConnectionsQuery.mockReturnValue(EMPTY_LIST_QUERY);
    useUnitHoldsQuery.mockReturnValue(EMPTY_LIST_QUERY);
    useConnectionSyncRunsQuery.mockReturnValue(EMPTY_LIST_QUERY);
    useConnectionConflictsQuery.mockReturnValue(EMPTY_LIST_QUERY);
    renderPage();

    expect(
      screen.getByText('Մուտքագրեք հայտարարության ID՝ սկսելու համար'),
    ).toBeInTheDocument();
  });

  test('shows a not-found error state when the looked-up listing errors', async () => {
    useListingQuery.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
    });
    useListingBookableUnitsQuery.mockReturnValue(EMPTY_LIST_QUERY);
    useUnitBreakdownQuery.mockReturnValue(EMPTY_LIST_QUERY);
    useUnitLedgerQuery.mockReturnValue(EMPTY_LIST_QUERY);
    useInventoryBlocksQuery.mockReturnValue(EMPTY_LIST_QUERY);
    useExternalReservationsQuery.mockReturnValue(EMPTY_LIST_QUERY);
    useInventoryConnectionsQuery.mockReturnValue(EMPTY_LIST_QUERY);
    useUnitHoldsQuery.mockReturnValue(EMPTY_LIST_QUERY);
    useConnectionSyncRunsQuery.mockReturnValue(EMPTY_LIST_QUERY);
    useConnectionConflictsQuery.mockReturnValue(EMPTY_LIST_QUERY);
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Հայտարարության ID'), '9999');
    await user.click(screen.getByRole('button', { name: /Փնտրել/ }));

    expect(screen.getByText('Հայտարարությունը չի գտնվել')).toBeInTheDocument();
  });

  test('renders the unit breakdown table once a listing and its units resolve', async () => {
    useListingQuery.mockReturnValue({
      data: { id: 42, title: 'Panoramic Ejmiatsin Hotel', partner_id: 3 },
      isPending: false,
      isError: false,
    });
    useListingBookableUnitsQuery.mockReturnValue({
      data: [{ id: 1, bookable_unit_type: 'HOTEL_ROOM', capacity: 5 }],
      isPending: false,
      isError: false,
    });
    useUnitBreakdownQuery.mockReturnValue({
      data: [
        {
          date: '2026-09-01',
          total: 5,
          available: 4,
          confirmed: 0,
          held: 1,
          external: 0,
          manual: 0,
        },
      ],
      isPending: false,
      isError: false,
    });
    useUnitLedgerQuery.mockReturnValue(EMPTY_LIST_QUERY);
    useInventoryBlocksQuery.mockReturnValue(EMPTY_LIST_QUERY);
    useExternalReservationsQuery.mockReturnValue(EMPTY_LIST_QUERY);
    useInventoryConnectionsQuery.mockReturnValue(EMPTY_LIST_QUERY);
    useUnitHoldsQuery.mockReturnValue(EMPTY_LIST_QUERY);
    useConnectionSyncRunsQuery.mockReturnValue(EMPTY_LIST_QUERY);
    useConnectionConflictsQuery.mockReturnValue(EMPTY_LIST_QUERY);
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Հայտարարության ID'), '42');
    await user.click(screen.getByRole('button', { name: /Փնտրել/ }));

    expect(screen.getByText('Panoramic Ejmiatsin Hotel')).toBeInTheDocument();
    expect(screen.getByText('2026-09-01')).toBeInTheDocument();
  });

  test('shows active holds in the Holds tab, and sync history/conflicts once a connection is selected', async () => {
    useListingQuery.mockReturnValue({
      data: { id: 42, title: 'Panoramic Ejmiatsin Hotel', partner_id: 3 },
      isPending: false,
      isError: false,
    });
    useListingBookableUnitsQuery.mockReturnValue({
      data: [{ id: 1, bookable_unit_type: 'HOTEL_ROOM', capacity: 5 }],
      isPending: false,
      isError: false,
    });
    useUnitBreakdownQuery.mockReturnValue(EMPTY_LIST_QUERY);
    useUnitLedgerQuery.mockReturnValue(EMPTY_LIST_QUERY);
    useInventoryBlocksQuery.mockReturnValue(EMPTY_LIST_QUERY);
    useExternalReservationsQuery.mockReturnValue(EMPTY_LIST_QUERY);
    useUnitHoldsQuery.mockReturnValue({
      data: [
        {
          id: 7,
          bookable_unit_id: 1,
          user_id: 9,
          date_from: '2026-09-05',
          date_to: '2026-09-06',
          expires_at: '2026-09-05T00:15:00Z',
        },
      ],
      isPending: false,
      isError: false,
    });
    useInventoryConnectionsQuery.mockReturnValue({
      data: [
        {
          id: 5,
          name: 'Airbnb calendar',
          connector_type: 'ICAL',
          status: 'ACTIVE',
          last_successful_sync_at: null,
        },
      ],
      isPending: false,
      isError: false,
    });
    useConnectionSyncRunsQuery.mockReturnValue(EMPTY_LIST_QUERY);
    useConnectionConflictsQuery.mockReturnValue(EMPTY_LIST_QUERY);
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Հայտարարության ID'), '42');
    await user.click(screen.getByRole('button', { name: /Փնտրել/ }));

    await user.click(screen.getByRole('tab', { name: /Պահումներ/ }));
    expect(screen.getByText('2026-09-05 – 2026-09-06')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Կապակցումներ' }));
    expect(screen.getByText('Airbnb calendar')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Մանրամասներ' }));
    expect(useConnectionSyncRunsQuery).toHaveBeenCalledWith(
      5,
      expect.objectContaining({ enabled: true }),
    );

    await user.click(
      screen.getByRole('tab', { name: 'Համաժամեցման պատմություն' }),
    );
    expect(
      screen.getByText('Համաժամեցման գործարկումներ դեռ գրանցված չեն։'),
    ).toBeInTheDocument();
  });
});
