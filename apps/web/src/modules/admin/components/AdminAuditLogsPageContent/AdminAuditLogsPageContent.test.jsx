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
    action: 'user.suspended',
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

  test('renders an entry row with actor, action, and target', () => {
    useAdminAuditLogsQuery.mockReturnValue({
      data: { pages: [{ results: [entryFixture()] }] },
      isPending: false,
      isError: false,
      ...noopQueryExtras,
    });
    renderPage();

    expect(screen.getByText('Dev Admin')).toBeInTheDocument();
    expect(screen.getByText('user.suspended')).toBeInTheDocument();
    expect(screen.getByText('user #42')).toBeInTheDocument();
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
});
