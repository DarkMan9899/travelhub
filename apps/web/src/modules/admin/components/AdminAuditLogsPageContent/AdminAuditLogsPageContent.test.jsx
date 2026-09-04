import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AdminAuditLogsPageContent from './AdminAuditLogsPageContent.jsx';
import { useAdminAuditLogsQuery } from '../../queries/useAdminAuditLogsQuery.js';

vi.mock('../../queries/useAdminAuditLogsQuery.js', () => ({
  useAdminAuditLogsQuery: vi.fn(),
}));

function entryFixture(overrides) {
  return {
    id: 7,
    actor_id: 1,
    actor_name: 'Dev Admin',
    action: 'user.status_changed',
    target_type: 'user',
    target_id: 42,
    before_snapshot: null,
    after_snapshot: null,
    ip_address: null,
    created_at: '2026-08-01T10:00:00.000Z',
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/hy/admin/audit-logs']}>
      <Routes>
        <Route
          path="/:locale/admin/audit-logs"
          element={<AdminAuditLogsPageContent />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

const noopQueryExtras = {
  refetch: vi.fn(),
  fetchNextPage: vi.fn(),
  hasNextPage: false,
  isFetchingNextPage: false,
};

describe('AdminAuditLogsPageContent (apps/web/src/modules/admin)', () => {
  test('shows a retryable error state', async () => {
    const refetch = vi.fn();
    useAdminAuditLogsQuery.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      ...noopQueryExtras,
      refetch,
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Կրկին փորձել' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  test('renders an entry row with actor, a localized action label (never the raw code), and a localized target', () => {
    useAdminAuditLogsQuery.mockReturnValue({
      data: { pages: [{ results: [entryFixture()] }] },
      isPending: false,
      isError: false,
      ...noopQueryExtras,
    });
    renderPage();

    expect(screen.getByText('Dev Admin')).toBeInTheDocument();
    expect(
      screen.getByText('Փոխվել է օգտատիրոջ կարգավիճակը'),
    ).toBeInTheDocument();
    expect(screen.queryByText('user.status_changed')).not.toBeInTheDocument();
    expect(screen.getByText('Օգտատեր #42')).toBeInTheDocument();
  });

  test('an unmapped action falls back to a humanized label, never the raw dotted code', () => {
    useAdminAuditLogsQuery.mockReturnValue({
      data: {
        pages: [
          { results: [entryFixture({ action: 'wallet.balance_adjusted' })] },
        ],
      },
      isPending: false,
      isError: false,
      ...noopQueryExtras,
    });
    renderPage();

    expect(screen.getByText('wallet: balance adjusted')).toBeInTheDocument();
    expect(
      screen.queryByText('wallet.balance_adjusted'),
    ).not.toBeInTheDocument();
  });

  test('falls back to the system-actor label when actor_name is null', () => {
    useAdminAuditLogsQuery.mockReturnValue({
      data: {
        pages: [
          { results: [entryFixture({ actor_id: null, actor_name: null })] },
        ],
      },
      isPending: false,
      isError: false,
      ...noopQueryExtras,
    });
    renderPage();

    expect(screen.getByText('Համակարգ')).toBeInTheDocument();
  });

  test('calls fetchNextPage when Load more is clicked', async () => {
    const fetchNextPage = vi.fn();
    useAdminAuditLogsQuery.mockReturnValue({
      data: { pages: [{ results: [entryFixture()] }] },
      isPending: false,
      isError: false,
      ...noopQueryExtras,
      fetchNextPage,
      hasNextPage: true,
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Բեռնել ավելին' }));
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });

  test('opening Details shows the before/after snapshot, with any sensitive-looking key redacted', async () => {
    useAdminAuditLogsQuery.mockReturnValue({
      data: {
        pages: [
          {
            results: [
              entryFixture({
                ip_address: '203.0.113.7',
                before_snapshot: { statusCode: 'ACTIVE' },
                after_snapshot: {
                  statusCode: 'SUSPENDED',
                  apiSecret: 'sk_live_should_never_show',
                },
              }),
            ],
          },
        ],
      },
      isPending: false,
      isError: false,
      ...noopQueryExtras,
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Մանրամասներ' }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('203.0.113.7');
    expect(dialog).toHaveTextContent('user.status_changed');
    expect(dialog).toHaveTextContent('"statusCode": "ACTIVE"');
    expect(dialog).toHaveTextContent('"statusCode": "SUSPENDED"');
    expect(dialog).toHaveTextContent('[redacted]');
    expect(dialog).not.toHaveTextContent('sk_live_should_never_show');
  });

  test('the actor/target ID and date-range filters are wired to the query', () => {
    useAdminAuditLogsQuery.mockReturnValue({
      data: { pages: [{ results: [] }] },
      isPending: false,
      isError: false,
      ...noopQueryExtras,
    });
    renderPage();

    expect(useAdminAuditLogsQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: '',
        targetId: '',
        dateFrom: '',
        dateTo: '',
      }),
    );
  });
});
