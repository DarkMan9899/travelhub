import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ToastProvider from '../../../../providers/ToastProvider.jsx';
import ConfirmProvider from '../../../../providers/ConfirmProvider.jsx';
import AdminInventoryPageContent from './AdminInventoryPageContent.jsx';
import { useListingBookableUnitsQuery } from '../../../listings/index.js';
import { useAdminListingDetailQuery } from '../../queries/useAdminListingDetailQuery.js';
import {
  useUnitBreakdownQuery,
  useUnitLedgerQuery,
  useUnitHoldsQuery,
  useInventoryBlocksQuery,
  useExternalReservationsQuery,
  useInventoryConnectionsQuery,
  useConnectionSyncRunsQuery,
  useConnectionConflictsQuery,
  useAdminInventoryOverviewQuery,
  useAdminInventoryConflictsOverviewQuery,
  useTestInventoryConnectionMutation,
  useSyncInventoryConnectionMutation,
  useDisconnectInventoryConnectionMutation,
  useResolveConnectionConflictMutation,
  useReleaseInventoryBlockMutation,
  useCancelExternalReservationMutation,
} from '../../../availability/index.js';
import { useAuth } from '../../../../contexts/AuthContext.jsx';

vi.mock('../../../listings/index.js', async () => {
  const actual = await vi.importActual('../../../listings/index.js');
  return {
    ...actual,
    useListingBookableUnitsQuery: vi.fn(),
  };
});

vi.mock('../../queries/useAdminListingDetailQuery.js', () => ({
  useAdminListingDetailQuery: vi.fn(),
}));

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
    useAdminInventoryOverviewQuery: vi.fn(),
    useAdminInventoryConflictsOverviewQuery: vi.fn(),
    useTestInventoryConnectionMutation: vi.fn(),
    useSyncInventoryConnectionMutation: vi.fn(),
    useDisconnectInventoryConnectionMutation: vi.fn(),
    useResolveConnectionConflictMutation: vi.fn(),
    useReleaseInventoryBlockMutation: vi.fn(),
    useCancelExternalReservationMutation: vi.fn(),
  };
});

vi.mock('../../../../contexts/AuthContext.jsx', () => ({ useAuth: vi.fn() }));

const PENDING_QUERY = { data: undefined, isPending: true, isError: false };
const EMPTY_LIST_QUERY = { data: [], isPending: false, isError: false };
const NOOP_MUTATION = {
  mutateAsync: vi.fn().mockResolvedValue({ data: {} }),
  isPending: false,
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/hy/admin/inventory']}>
      <ToastProvider>
        <ConfirmProvider>
          <Routes>
            <Route
              path="/:locale/admin/inventory"
              element={<AdminInventoryPageContent />}
            />
          </Routes>
        </ConfirmProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('AdminInventoryPageContent (apps/web/src/modules/admin)', () => {
  beforeEach(() => {
    useAuth.mockReturnValue({ permissions: ['inventory.view_all'] });
    useListingBookableUnitsQuery.mockReturnValue(EMPTY_LIST_QUERY);
    useUnitBreakdownQuery.mockReturnValue(EMPTY_LIST_QUERY);
    useUnitLedgerQuery.mockReturnValue(EMPTY_LIST_QUERY);
    useInventoryBlocksQuery.mockReturnValue(EMPTY_LIST_QUERY);
    useExternalReservationsQuery.mockReturnValue(EMPTY_LIST_QUERY);
    useInventoryConnectionsQuery.mockReturnValue(EMPTY_LIST_QUERY);
    useUnitHoldsQuery.mockReturnValue(EMPTY_LIST_QUERY);
    useConnectionSyncRunsQuery.mockReturnValue(EMPTY_LIST_QUERY);
    useConnectionConflictsQuery.mockReturnValue(EMPTY_LIST_QUERY);
    useAdminInventoryOverviewQuery.mockReturnValue(EMPTY_LIST_QUERY);
    useAdminInventoryConflictsOverviewQuery.mockReturnValue(EMPTY_LIST_QUERY);
    useTestInventoryConnectionMutation.mockReturnValue(NOOP_MUTATION);
    useSyncInventoryConnectionMutation.mockReturnValue(NOOP_MUTATION);
    useDisconnectInventoryConnectionMutation.mockReturnValue(NOOP_MUTATION);
    useResolveConnectionConflictMutation.mockReturnValue(NOOP_MUTATION);
    useReleaseInventoryBlockMutation.mockReturnValue(NOOP_MUTATION);
    useCancelExternalReservationMutation.mockReturnValue(NOOP_MUTATION);
  });

  test('shows the no-lookup empty state before any listing id is entered', () => {
    useAdminListingDetailQuery.mockReturnValue(PENDING_QUERY);
    renderPage();

    expect(
      screen.getByText('Մուտքագրեք հայտարարության ID՝ սկսելու համար'),
    ).toBeInTheDocument();
  });

  test('shows a not-found error state when the looked-up listing errors', async () => {
    useAdminListingDetailQuery.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
    });
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Հայտարարության ID'), '9999');
    await user.click(screen.getByRole('button', { name: /Փնտրել/ }));

    expect(screen.getByText('Հայտարարությունը չի գտնվել')).toBeInTheDocument();
  });

  test('renders the unit breakdown table once a listing and its units resolve, using the admin-only detail query', async () => {
    useAdminListingDetailQuery.mockReturnValue({
      data: {
        id: 42,
        partner_id: 3,
        slug: 'panoramic-ejmiatsin-hotel',
        translations: [
          { language_code: 'hy', title: 'Panoramic Ejmiatsin Hotel' },
        ],
      },
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
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Հայտարարության ID'), '42');
    await user.click(screen.getByRole('button', { name: /Փնտրել/ }));

    expect(screen.getByText('Panoramic Ejmiatsin Hotel')).toBeInTheDocument();
    expect(screen.getByText('2026-09-01')).toBeInTheDocument();
    // Real fix: the admin-only detail query, never the public one that
    // hid unpublished/draft listings from this page.
    expect(useAdminListingDetailQuery).toHaveBeenCalledWith(42);
  });

  test('shows a date-only unit correctly, never inventing a time slot', async () => {
    useAdminListingDetailQuery.mockReturnValue({
      data: {
        id: 42,
        partner_id: 3,
        slug: 'panoramic-ejmiatsin-hotel',
        translations: [
          { language_code: 'hy', title: 'Panoramic Ejmiatsin Hotel' },
        ],
      },
      isPending: false,
      isError: false,
    });
    useListingBookableUnitsQuery.mockReturnValue({
      data: [
        {
          id: 1,
          bookable_unit_type: 'HOTEL_ROOM',
          capacity: 5,
          time_slot_start: null,
          time_slot_end: null,
        },
      ],
      isPending: false,
      isError: false,
    });
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Հայտարարության ID'), '42');
    await user.click(screen.getByRole('button', { name: /Փնտրել/ }));

    expect(
      screen.getByText('Միայն ամսաթվով միավոր — ֆիքսված ժամ չկա'),
    ).toBeInTheDocument();
  });

  test("shows a time-slot unit's real departure window", async () => {
    useAdminListingDetailQuery.mockReturnValue({
      data: {
        id: 55,
        partner_id: 4,
        slug: 'dilijan-trail-tour',
        translations: [{ language_code: 'hy', title: 'Dilijan Trail Tour' }],
      },
      isPending: false,
      isError: false,
    });
    useListingBookableUnitsQuery.mockReturnValue({
      data: [
        {
          id: 9,
          bookable_unit_type: 'TOUR_DEPARTURE',
          capacity: 12,
          time_slot_start: '09:00:00',
          time_slot_end: '13:00:00',
        },
      ],
      isPending: false,
      isError: false,
    });
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Հայտարարության ID'), '55');
    await user.click(screen.getByRole('button', { name: /Փնտրել/ }));

    expect(
      screen.getByText('Ժամային միավոր — մեկնում 09:00–13:00'),
    ).toBeInTheDocument();
  });

  test('shows active holds in the Holds tab, and offers Test/Sync/Disconnect once a connection is selected, gated on inventory.manage_all', async () => {
    useAuth.mockReturnValue({
      permissions: ['inventory.view_all', 'inventory.manage_all'],
    });
    useAdminListingDetailQuery.mockReturnValue({
      data: {
        id: 42,
        partner_id: 3,
        slug: 'panoramic-ejmiatsin-hotel',
        translations: [
          { language_code: 'hy', title: 'Panoramic Ejmiatsin Hotel' },
        ],
      },
      isPending: false,
      isError: false,
    });
    useListingBookableUnitsQuery.mockReturnValue({
      data: [{ id: 1, bookable_unit_type: 'HOTEL_ROOM', capacity: 5 }],
      isPending: false,
      isError: false,
    });
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
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Հայտարարության ID'), '42');
    await user.click(screen.getByRole('button', { name: /Փնտրել/ }));

    await user.click(screen.getByRole('tab', { name: /Պահումներ/ }));
    expect(screen.getByText('2026-09-05 – 2026-09-06')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Կապակցումներ' }));
    expect(screen.getByText('Airbnb calendar')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Փորձարկել' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Համաժամեցնել հիմա' }),
    ).toBeInTheDocument();

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

  test('write actions are hidden without inventory.manage_all', async () => {
    useAuth.mockReturnValue({ permissions: ['inventory.view_all'] });
    useAdminListingDetailQuery.mockReturnValue({
      data: {
        id: 42,
        partner_id: 3,
        slug: 'panoramic-ejmiatsin-hotel',
        translations: [
          { language_code: 'hy', title: 'Panoramic Ejmiatsin Hotel' },
        ],
      },
      isPending: false,
      isError: false,
    });
    useListingBookableUnitsQuery.mockReturnValue({
      data: [{ id: 1, bookable_unit_type: 'HOTEL_ROOM', capacity: 5 }],
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
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Հայտարարության ID'), '42');
    await user.click(screen.getByRole('button', { name: /Փնտրել/ }));
    await user.click(screen.getByRole('tab', { name: 'Կապակցումներ' }));

    expect(
      screen.queryByRole('button', { name: 'Փորձարկել' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Անջատել' }),
    ).not.toBeInTheDocument();
  });

  test('an unrecognized/unimplemented connector type shows a real "not supported" state instead of an actionable Test/Sync button', async () => {
    useAuth.mockReturnValue({
      permissions: ['inventory.view_all', 'inventory.manage_all'],
    });
    useAdminListingDetailQuery.mockReturnValue({
      data: {
        id: 42,
        partner_id: 3,
        slug: 'panoramic-ejmiatsin-hotel',
        translations: [
          { language_code: 'hy', title: 'Panoramic Ejmiatsin Hotel' },
        ],
      },
      isPending: false,
      isError: false,
    });
    useListingBookableUnitsQuery.mockReturnValue({
      data: [{ id: 1, bookable_unit_type: 'HOTEL_ROOM', capacity: 5 }],
      isPending: false,
      isError: false,
    });
    useInventoryConnectionsQuery.mockReturnValue({
      data: [
        {
          id: 6,
          name: 'CSV feed',
          connector_type: 'CSV',
          status: 'ACTIVE',
          last_successful_sync_at: null,
        },
      ],
      isPending: false,
      isError: false,
    });
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Հայտարարության ID'), '42');
    await user.click(screen.getByRole('button', { name: /Փնտրել/ }));
    await user.click(screen.getByRole('tab', { name: 'Կապակցումներ' }));

    expect(screen.getByText('Դեռ չի աջակցվում')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Փորձարկել' }),
    ).not.toBeInTheDocument();
  });

  test('the admin-wide overview shows active connections and unresolved conflicts across every partner, before any lookup', () => {
    useAdminListingDetailQuery.mockReturnValue(PENDING_QUERY);
    useAdminInventoryOverviewQuery.mockReturnValue({
      data: [
        {
          id: 2,
          partner_id: 1,
          partner_display_name: 'Yerevan Boutique Hospitality',
          listing_id: 81,
          connector_type: 'ICAL',
          status: 'ERROR',
          last_error: 'This iCal connection has no feedUrl configured.',
          last_successful_sync_at: null,
        },
      ],
      isPending: false,
      isError: false,
    });
    useAdminInventoryConflictsOverviewQuery.mockReturnValue({
      data: [
        {
          id: 1,
          connection_id: 2,
          partner_id: 1,
          partner_display_name: 'Yerevan Boutique Hospitality',
          listing_id: 81,
          conflict_type: 'AMBIGUOUS_MAPPING',
          external_event_uid: 'unmapped-room-22',
          created_at: '2026-09-02T07:12:41.000Z',
        },
      ],
      isPending: false,
      isError: false,
    });
    renderPage();

    expect(
      screen.getAllByText('Yerevan Boutique Hospitality').length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText('This iCal connection has no feedUrl configured.'),
    ).toBeInTheDocument();
    expect(screen.getByText('unmapped-room-22')).toBeInTheDocument();
  });
});
