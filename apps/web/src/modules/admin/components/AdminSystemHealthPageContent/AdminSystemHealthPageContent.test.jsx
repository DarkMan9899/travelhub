import { describe, test, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AdminSystemHealthPageContent from './AdminSystemHealthPageContent.jsx';
import { useAdminSystemHealthQuery } from '../../queries/useAdminSystemHealthQuery.js';

vi.mock('../../queries/useAdminSystemHealthQuery.js', () => ({
  useAdminSystemHealthQuery: vi.fn(),
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/hy/admin/system-health']}>
      <Routes>
        <Route
          path="/:locale/admin/system-health"
          element={<AdminSystemHealthPageContent />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AdminSystemHealthPageContent (apps/web/src/modules/admin)', () => {
  test('shows the system-health heading', () => {
    useAdminSystemHealthQuery.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
      refetch: vi.fn(),
    });
    renderPage();
    expect(
      screen.getByRole('heading', { name: 'Համակարգի վիճակ' }),
    ).toBeInTheDocument();
  });

  test('shows a retryable error state on failure', async () => {
    const refetch = vi.fn();
    useAdminSystemHealthQuery.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      refetch,
    });
    const user = userEvent.setup();
    renderPage();

    expect(
      screen.getByText('Ինչ-որ բան այն չգնաց համակարգի վիճակը բեռնելիս։'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Կրկին փորձել' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  test('renders database/cache status, environment/version, and queue rows', () => {
    useAdminSystemHealthQuery.mockReturnValue({
      data: {
        database: { status: 'up', latency_ms: 4 },
        cache: { status: 'down', latency_ms: null },
        queues: [
          {
            name: 'booking-holds.expiry-sweep',
            status: 'up',
            waiting: 2,
            active: 0,
            delayed: 5,
            failed: 0,
          },
          {
            name: 'bookings.pending-vendor-sla-sweep',
            status: 'up',
            waiting: 0,
            active: 1,
            delayed: 0,
            failed: 0,
          },
        ],
        environment: 'test',
        version: '0.1.0',
      },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });
    renderPage();

    const databaseLabel = screen.getByText('Տվյալների բազա');
    expect(
      within(databaseLabel.parentElement).getByText('Աշխատում է'),
    ).toBeInTheDocument();

    const cacheLabel = screen.getByText('Քեշ');
    expect(
      within(cacheLabel.parentElement).getByText('Անհասանելի է'),
    ).toBeInTheDocument();

    expect(screen.getByText('test')).toBeInTheDocument();
    expect(screen.getByText('0.1.0')).toBeInTheDocument();

    expect(
      screen.getByText('Ամրագրման պահման ժամկետի ստուգում'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Գործընկերոջ սպասման ժամկետի ստուգում'),
    ).toBeInTheDocument();
  });
});
