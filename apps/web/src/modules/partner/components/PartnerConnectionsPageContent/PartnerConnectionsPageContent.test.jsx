import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ToastProvider from '../../../../providers/ToastProvider.jsx';
import ConfirmProvider from '../../../../providers/ConfirmProvider.jsx';
import PartnerConnectionsPageContent from './PartnerConnectionsPageContent.jsx';
import { usePartnerContext } from '../../../../contexts/PartnerContext.jsx';
import { useMyListingsQuery } from '../../../listings/index.js';
import {
  useBookableUnitsQuery,
  useInventoryConnectionsQuery,
  useConnectionSyncRunsQuery,
  useConnectionConflictsQuery,
  useCreateInventoryConnectionMutation,
  useDisconnectInventoryConnectionMutation,
  useSetInventoryConnectionMappingMutation,
  useTestInventoryConnectionMutation,
  useSyncInventoryConnectionMutation,
  useResolveConnectionConflictMutation,
} from '../../../availability/index.js';

vi.mock('../../../../contexts/PartnerContext.jsx', () => ({
  usePartnerContext: vi.fn(),
}));

vi.mock('../../../listings/index.js', async () => {
  const actual = await vi.importActual('../../../listings/index.js');
  return {
    ...actual,
    useMyListingsQuery: vi.fn(),
  };
});

vi.mock('../../../availability/index.js', async () => {
  const actual = await vi.importActual('../../../availability/index.js');
  return {
    ...actual,
    useBookableUnitsQuery: vi.fn(),
    useInventoryConnectionsQuery: vi.fn(),
    useConnectionSyncRunsQuery: vi.fn(),
    useConnectionConflictsQuery: vi.fn(),
    useCreateInventoryConnectionMutation: vi.fn(),
    useDisconnectInventoryConnectionMutation: vi.fn(),
    useSetInventoryConnectionMappingMutation: vi.fn(),
    useTestInventoryConnectionMutation: vi.fn(),
    useSyncInventoryConnectionMutation: vi.fn(),
    useResolveConnectionConflictMutation: vi.fn(),
  };
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/hy/partner/connections']}>
      <ToastProvider>
        <ConfirmProvider>
          <Routes>
            <Route
              path="/:locale/partner/connections"
              element={<PartnerConnectionsPageContent />}
            />
          </Routes>
        </ConfirmProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

const EMPTY_LIST_QUERY = { data: [], isPending: false, isError: false };
const NOOP_MUTATION = { mutateAsync: vi.fn(), isPending: false };

const CONNECTION = {
  id: 7,
  name: 'Airbnb calendar',
  connector_type: 'MANUAL',
  direction: 'IMPORT',
  status: 'ACTIVE',
  export_token: null,
  last_successful_sync_at: null,
  listing_id: 1,
};

describe('PartnerConnectionsPageContent (apps/web/src/modules/partner)', () => {
  beforeEach(() => {
    usePartnerContext.mockReturnValue({
      activePartnerId: 3,
      activePartner: { role: 'OWNER' },
    });
    useMyListingsQuery.mockReturnValue({
      data: {
        pages: [{ results: [{ id: 1, title: 'Seaside Villa' }] }],
      },
      isPending: false,
    });
    useBookableUnitsQuery.mockReturnValue({ data: [], isPending: false });
    useConnectionSyncRunsQuery.mockReturnValue(EMPTY_LIST_QUERY);
    useConnectionConflictsQuery.mockReturnValue(EMPTY_LIST_QUERY);
    useCreateInventoryConnectionMutation.mockReturnValue({
      ...NOOP_MUTATION,
      mutateAsync: vi.fn().mockResolvedValue({}),
    });
    useDisconnectInventoryConnectionMutation.mockReturnValue(NOOP_MUTATION);
    useSetInventoryConnectionMappingMutation.mockReturnValue(NOOP_MUTATION);
    useTestInventoryConnectionMutation.mockReturnValue({
      ...NOOP_MUTATION,
      // `apiClient` never unwraps the `{success, data, meta, error}`
      // envelope — every mutation resolves to that full shape.
      mutateAsync: vi
        .fn()
        .mockResolvedValue({ data: { ok: true, message: 'OK' } }),
    });
    useSyncInventoryConnectionMutation.mockReturnValue({
      ...NOOP_MUTATION,
      mutateAsync: vi.fn().mockResolvedValue({ data: { status: 'SUCCESS' } }),
    });
    useResolveConnectionConflictMutation.mockReturnValue(NOOP_MUTATION);
  });

  test('shows an empty state when the partner has no connections', () => {
    useInventoryConnectionsQuery.mockReturnValue(EMPTY_LIST_QUERY);
    renderPage();
    expect(
      screen.getByText('Կապակցումներ դեռ կարգավորված չեն։'),
    ).toBeInTheDocument();
  });

  test('renders the connection list with its status and actions', () => {
    useInventoryConnectionsQuery.mockReturnValue({
      data: [CONNECTION],
      isPending: false,
      isError: false,
    });
    renderPage();
    expect(screen.getByText('Airbnb calendar')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Փորձարկել' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Համաժամեցնել հիմա' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Անջատել' })).toBeInTheDocument();
  });

  test('clicking Test calls the test mutation for that connection', async () => {
    useInventoryConnectionsQuery.mockReturnValue({
      data: [CONNECTION],
      isPending: false,
      isError: false,
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Փորձարկել' }));

    await waitFor(() =>
      expect(
        useTestInventoryConnectionMutation().mutateAsync,
      ).toHaveBeenCalledWith({ id: 7 }),
    );
  });

  test('selecting a connection shows the sync history / conflicts / mapping tabs', async () => {
    useInventoryConnectionsQuery.mockReturnValue({
      data: [CONNECTION],
      isPending: false,
      isError: false,
    });
    useConnectionSyncRunsQuery.mockReturnValue({
      data: [
        {
          id: 1,
          started_at: '2026-01-01T00:00:00.000Z',
          trigger_code: 'MANUAL',
          status: 'SUCCESS',
          records_created: 2,
          records_skipped: 0,
          error_message: null,
        },
      ],
      isPending: false,
      isError: false,
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Մանրամասներ' }));

    expect(
      screen.getByRole('tab', { name: 'Համաժամեցման պատմություն' }),
    ).toBeInTheDocument();
    expect(screen.getByText('2 ստեղծված, 0 բաց թողնված')).toBeInTheDocument();
  });

  test('creating a connection with a typed name sends the typed value, not the change event', async () => {
    useInventoryConnectionsQuery.mockReturnValue(EMPTY_LIST_QUERY);
    const createConnection = vi.fn().mockResolvedValue({});
    useCreateInventoryConnectionMutation.mockReturnValue({
      mutateAsync: createConnection,
      isPending: false,
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(
      screen.getByRole('button', { name: 'Ավելացնել կապակցում' }),
    );
    const nameInput = screen.getByLabelText(/^Անուն/);
    await user.type(nameInput, 'Booking.com feed');
    await user.click(screen.getByRole('button', { name: 'Ստեղծել կապակցում' }));

    await waitFor(() =>
      expect(createConnection).toHaveBeenCalledWith(
        expect.objectContaining({
          partnerId: 3,
          name: 'Booking.com feed',
          connectorType: 'MANUAL',
          direction: 'IMPORT',
        }),
      ),
    );
  });
});
